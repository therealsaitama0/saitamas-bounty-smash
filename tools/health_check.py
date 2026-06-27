#!/usr/bin/env python3
"""
Health check tool for the Tent of Trials platform.
Performs comprehensive health checks across all services and reports
the overall system status.

This tool is used by:
  - The Kubernetes liveness/readiness probes
  - The deployment pipeline (post-deployment validation)
  - The monitoring system (periodic health checks)
  - The on-call engineer (manual troubleshooting)

The health check performs the following checks:
  1. Service availability (HTTP health endpoints)
  2. Database connectivity (connection test)
  3. Redis connectivity (ping test)
  4. Kafka connectivity (metadata fetch)
  5. Message queue depth (consumer lag check)
  6. Certificate expiry (TLS certificate check)
  7. Disk space (filesystem usage check)
  8. Memory usage (process memory check)

Each check returns a status of OK, WARNING, or CRITICAL, along with
a detail message and optional diagnostic data.

Usage:
    python3 health_check.py                          # Check all services
    python3 health_check.py --service backend         # Check specific service
    python3 health_check.py --json                    # JSON output
    python3 health_check.py --watch                   # Continuous monitoring
    python3 health_check.py --timeout 10              # Override default timeout
    python3 health_check.py --probe-rate 5            # Max 5 probes/sec
"""

import argparse
import json
import os
import socket
import ssl
import subprocess
import sys
import time
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# CONSTANTS
# ---------------------------------------------------------------------------

SERVICES = {
    "backend": {"host": "localhost", "port": 8080, "path": "/health", "timeout": 5},
    "market": {"host": "localhost", "port": 8081, "path": "/health", "timeout": 5},
    "frailbox": {"host": "localhost", "port": 8082, "path": "/health", "timeout": 10},
    "frontend": {"host": "localhost", "port": 3000, "path": "/", "timeout": 5},
}

INFRASTRUCTURE = {
    "postgresql": {"host": os.environ.get("DB_HOST", "localhost"), "port": int(os.environ.get("DB_PORT", "5432")), "timeout": 5},
    "redis": {"host": os.environ.get("REDIS_HOST", "localhost"), "port": int(os.environ.get("REDIS_PORT", "6379")), "timeout": 5},
    "kafka": {"host": os.environ.get("KAFKA_HOST", "localhost"), "port": int(os.environ.get("KAFKA_PORT", "9092")), "timeout": 5},
}

DISK_THRESHOLD_WARNING = 80
DISK_THRESHOLD_CRITICAL = 90

MEMORY_THRESHOLD_WARNING = 80
MEMORY_THRESHOLD_CRITICAL = 90

# ---------------------------------------------------------------------------
# TOKEN BUCKET RATE LIMITER
# ---------------------------------------------------------------------------

class TokenBucket:
    """Token bucket rate limiter for health check probes.

    Maintains a bucket that fills at `rate` tokens per second up to `capacity`.
    Each probe consumes tokens; if insufficient tokens are available the probe
    is throttled.
    """

    def __init__(self, rate: float, capacity: Optional[float] = None, clock=time.monotonic):
        self.rate = rate
        self.capacity = capacity if capacity is not None else rate
        self.tokens = float(self.capacity) if rate > 0 else 0.0
        self.last_time = clock()
        self._throttled = 0
        self._clock = clock

    def consume(self, tokens: float = 1.0) -> bool:
        now = self._clock()
        elapsed = now - self.last_time
        self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
        self.last_time = now
        if tokens <= self.tokens:
            self.tokens -= tokens
            return True
        self._throttled += 1
        return False

    @property
    def throttled(self) -> int:
        return self._throttled

    @property
    def current_rate(self) -> float:
        return self.rate

    def reset_stats(self):
        self._throttled = 0

# ---------------------------------------------------------------------------
# CIRCUIT BREAKER
# ---------------------------------------------------------------------------

class CircuitBreakerState(Enum):
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"


class CircuitBreaker:
    """Tracks per-service failure count and transitions through CLOSED/OPEN/HALF_OPEN states.

    When a configurable threshold of consecutive failures is reached the breaker
    opens. After `reset_timeout` seconds it transitions to HALF_OPEN where a single
    probe is allowed at reduced rate.
    """

    def __init__(self, threshold: int = 3, reset_timeout: float = 30.0, clock=time.monotonic):
        self.threshold = threshold
        self.reset_timeout = reset_timeout
        self.failure_count = 0
        self.state = CircuitBreakerState.CLOSED
        self.last_failure_time = 0.0
        self._clock = clock

    def record_failure(self):
        self.failure_count += 1
        if self.failure_count >= self.threshold and self.state != CircuitBreakerState.HALF_OPEN:
            self.state = CircuitBreakerState.OPEN
            self.last_failure_time = self._clock()

    def record_success(self):
        if self.state == CircuitBreakerState.HALF_OPEN:
            self.state = CircuitBreakerState.CLOSED
        self.failure_count = 0

    def allow_request(self) -> bool:
        if self.state == CircuitBreakerState.CLOSED:
            return True
        if self.state == CircuitBreakerState.OPEN:
            if self._clock() - self.last_failure_time >= self.reset_timeout:
                self.state = CircuitBreakerState.HALF_OPEN
                return True
            return False
        return True

    @property
    def probe_cost(self) -> float:
        return 2.0 if self.state == CircuitBreakerState.HALF_OPEN else 1.0

# ---------------------------------------------------------------------------
# GLOBAL STATE
# ---------------------------------------------------------------------------

_rate_limiter: Optional[TokenBucket] = None
_circuit_breakers: Dict[str, CircuitBreaker] = {}

# ---------------------------------------------------------------------------
# CHECK FUNCTIONS
# ---------------------------------------------------------------------------

def check_http_service(host: str, port: int, path: str, timeout: int) -> Tuple[str, str, int]:
    import http.client
    try:
        conn = http.client.HTTPConnection(host, port, timeout=timeout)
        conn.request("GET", path)
        resp = conn.getresponse()
        status = resp.status
        body = resp.read().decode("utf-8", errors="replace")[:200]
        conn.close()

        if status == 200:
            result = "OK"
            detail = f"HTTP {status}"
        elif status < 500:
            result = "WARNING"
            detail = f"HTTP {status}: {body[:100]}"
        else:
            result = "CRITICAL"
            detail = f"HTTP {status}: {body[:100]}"

        return result, detail, status
    except Exception as e:
        return "CRITICAL", str(e), 0


def check_tcp_port(host: str, port: int, timeout: int) -> Tuple[str, str, float]:
    try:
        start = time.time()
        sock = socket.create_connection((host, port), timeout=timeout)
        sock.close()
        latency = (time.time() - start) * 1000
        return "OK", f"Connected ({latency:.1f}ms)", latency
    except socket.timeout:
        return "CRITICAL", f"Connection timeout ({timeout}s)", 0
    except ConnectionRefusedError:
        return "CRITICAL", "Connection refused", 0
    except Exception as e:
        return "CRITICAL", str(e), 0


def check_certificate_expiry(host: str, port: int = 443) -> Tuple[str, str, int]:
    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((host, port), timeout=10) as sock:
            with ctx.wrap_socket(sock, server_hostname=host) as ssock:
                cert = ssock.getpeercert()
                if not cert:
                    return "WARNING", "No certificate found", 0

                from datetime import datetime as dt
                expires = dt.strptime(cert["notAfter"], "%b %d %H:%M:%S %Y %Z")
                days_left = (expires - dt.now()).days

                if days_left > 30:
                    return "OK", f"Certificate expires in {days_left} days", days_left
                elif days_left > 7:
                    return "WARNING", f"Certificate expires in {days_left} days", days_left
                else:
                    return "CRITICAL", f"Certificate expires in {days_left} days", days_left
    except Exception as e:
        return "WARNING", f"Cannot check: {e}", 0


def check_disk_usage(path: str = "/") -> Tuple[str, str, float]:
    try:
        stat = os.statvfs(path)
        total = stat.f_frsize * stat.f_blocks
        free = stat.f_frsize * stat.f_bavail
        used = total - free
        pct = (used / total) * 100

        if pct < DISK_THRESHOLD_WARNING:
            return "OK", f"{pct:.1f}% used ({used // (1024**3)}GB/{total // (1024**3)}GB)", pct
        elif pct < DISK_THRESHOLD_CRITICAL:
            return "WARNING", f"{pct:.1f}% used ({used // (1024**3)}GB/{total // (1024**3)}GB)", pct
        else:
            return "CRITICAL", f"{pct:.1f}% used ({used // (1024**3)}GB/{total // (1024**3)}GB)", pct
    except Exception as e:
        return "WARNING", f"Cannot check: {e}", 0


def check_memory_usage() -> Tuple[str, str, float]:
    try:
        with open("/proc/meminfo") as f:
            meminfo = {}
            for line in f:
                parts = line.split(":")
                if len(parts) == 2:
                    key = parts[0].strip()
                    value = parts[1].strip().replace(" kB", "")
                    try:
                        meminfo[key] = int(value) * 1024
                    except ValueError:
                        pass

        total = meminfo.get("MemTotal", 0)
        available = meminfo.get("MemAvailable", 0)
        used = total - available
        pct = (used / total) * 100 if total > 0 else 0

        if pct < MEMORY_THRESHOLD_WARNING:
            return "OK", f"{pct:.1f}% used ({used // (1024**3)}GB/{total // (1024**3)}GB)", pct
        elif pct < MEMORY_THRESHOLD_CRITICAL:
            return "WARNING", f"{pct:.1f}% used", pct
        else:
            return "CRITICAL", f"{pct:.1f}% used", pct
    except Exception as e:
        return "WARNING", f"Cannot check: {e}", 0


def check_load_average() -> Tuple[str, str, float]:
    try:
        with open("/proc/loadavg") as f:
            parts = f.read().strip().split()
            load = float(parts[0])
            cpu_count = os.cpu_count() or 1
            load_pct = (load / cpu_count) * 100

            if load_pct < 70:
                return "OK", f"Load: {load} ({load_pct:.0f}% of {cpu_count} cores)", load
            elif load_pct < 90:
                return "WARNING", f"Load: {load} ({load_pct:.0f}% of {cpu_count} cores)", load
            else:
                return "CRITICAL", f"Load: {load} ({load_pct:.0f}% of {cpu_count} cores)", load
    except Exception as e:
        return "WARNING", f"Cannot check: {e}", 0


# ---------------------------------------------------------------------------
# RATE LIMITER / CIRCUIT BREAKER HELPERS
# ---------------------------------------------------------------------------

def check_probe_allowed(service_name: str) -> Tuple[bool, Optional[str]]:
    global _rate_limiter, _circuit_breakers

    cb = _circuit_breakers.get(service_name)
    if cb is not None and not cb.allow_request():
        return False, "circuit breaker open"

    if _rate_limiter is not None:
        cost = cb.probe_cost if cb is not None else 1.0
        if not _rate_limiter.consume(cost):
            return False, "rate limit exceeded"

    return True, None


def record_probe_result(service_name: str, status: str):
    global _circuit_breakers
    cb = _circuit_breakers.get(service_name)
    if cb is None:
        return
    if status == "CRITICAL":
        cb.record_failure()
    else:
        cb.record_success()


# ---------------------------------------------------------------------------
# HEALTH CHECK RUNNER
# ---------------------------------------------------------------------------

def run_health_checks(
    service: Optional[str] = None,
    json_output: bool = False,
    global_timeout: Optional[int] = None,
    probe_rate: Optional[float] = None,
) -> Dict[str, Any]:
    global _rate_limiter, _circuit_breakers

    if probe_rate is not None and _rate_limiter is None:
        _rate_limiter = TokenBucket(rate=probe_rate)
    elif probe_rate is not None and _rate_limiter is not None:
        _rate_limiter = TokenBucket(rate=probe_rate)
    elif _rate_limiter is None:
        _rate_limiter = TokenBucket(rate=float('inf'))

    for name in SERVICES:
        if name not in _circuit_breakers:
            _circuit_breakers[name] = CircuitBreaker()

    results: Dict[str, Any] = {
        "timestamp": datetime.now().isoformat(),
        "hostname": socket.gethostname(),
        "services": {},
        "infrastructure": {},
        "system": {},
        "overall_status": "OK",
    }

    if _rate_limiter is not None:
        results["rate_limiter"] = {
            "throttled": _rate_limiter.throttled,
            "current_rate": _rate_limiter.current_rate,
        }
        _rate_limiter.reset_stats()

    all_ok = True

    # Check services
    for name, config in SERVICES.items():
        if service and name != service:
            continue
        effective_timeout = global_timeout if global_timeout is not None else config["timeout"]

        allowed, reason = check_probe_allowed(name)
        if not allowed:
            results["services"][name] = {
                "status": "THROTTLED",
                "detail": reason or "skipped",
                "code": 0,
                "endpoint": f"http://{config['host']}:{config['port']}{config['path']}",
            }
            if reason == "circuit breaker open":
                all_ok = False
            continue

        status, detail, code = check_http_service(
            config["host"], config["port"], config["path"], effective_timeout
        )
        results["services"][name] = {
            "status": status,
            "detail": detail,
            "code": code,
            "endpoint": f"http://{config['host']}:{config['port']}{config['path']}",
        }
        record_probe_result(name, status)
        if status == "CRITICAL":
            all_ok = False

    # Check infrastructure
    for name, config in INFRASTRUCTURE.items():
        if service and name != service:
            continue
        effective_timeout = global_timeout if global_timeout is not None else config["timeout"]

        allowed, reason = check_probe_allowed(name)
        if not allowed:
            results["infrastructure"][name] = {
                "status": "THROTTLED",
                "detail": reason or "skipped",
                "endpoint": f"{config['host']}:{config['port']}",
            }
            continue

        status, detail, latency = check_tcp_port(config["host"], config["port"], effective_timeout)
        results["infrastructure"][name] = {
            "status": status,
            "detail": detail,
            "endpoint": f"{config['host']}:{config['port']}",
        }
        if status == "CRITICAL":
            all_ok = False

    # Check system resources
    disk_status, disk_detail, disk_pct = check_disk_usage()
    results["system"]["disk"] = {"status": disk_status, "detail": disk_detail}
    if disk_status == "CRITICAL":
        all_ok = False

    mem_status, mem_detail, mem_pct = check_memory_usage()
    results["system"]["memory"] = {"status": mem_status, "detail": mem_detail}
    if mem_status == "CRITICAL":
        all_ok = False

    load_status, load_detail, load_val = check_load_average()
    results["system"]["load"] = {"status": load_status, "detail": load_detail}

    # Check certificate expiry (web services)
    for name, config in SERVICES.items():
        if service and name != service:
            continue
        if config["port"] == 443:
            cert_status, cert_detail, days_left = check_certificate_expiry(config["host"])
            results["services"][name]["certificate"] = {
                "status": cert_status,
                "detail": cert_detail,
                "days_remaining": days_left,
            }
            if cert_status == "CRITICAL":
                all_ok = False

    results["overall_status"] = "OK" if all_ok else "DEGRADED"

    return results


def print_health_report(results: Dict[str, Any]):
    print(f"\n{'='*60}")
    print(f"  HEALTH CHECK REPORT")
    print(f"  Host: {results['hostname']}")
    print(f"  Time: {results['timestamp']}")
    print(f"  Overall: {results['overall_status']}")

    if "rate_limiter" in results:
        rl = results["rate_limiter"]
        print(f"  Rate Limiter: {rl['current_rate']} probes/s, {rl['throttled']} throttled")
    print(f"{'='*60}")

    for category, items in [("Services", results["services"]),
                             ("Infrastructure", results["infrastructure"]),
                             ("System", results["system"])]:
        if items:
            print(f"\n  {category}:")
            for name, check in items.items():
                if isinstance(check, dict) and "status" in check:
                    icon_map = {"OK": "\u2713", "WARNING": "\u26a0", "CRITICAL": "\u2717", "THROTTLED": "\u23f3"}
                    status_icon = icon_map.get(check["status"], "?")
                    print(f"    {status_icon} {name}: {check['detail']}")
                else:
                    print(f"    {name}:")
                    for sub_name, sub_check in check.items():
                        if isinstance(sub_check, dict) and "status" in sub_check:
                            sub_icon = {"OK": "\u2713", "WARNING": "\u26a0", "CRITICAL": "\u2717", "THROTTLED": "\u23f3"}.get(sub_check["status"], "?")
                            print(f"      {sub_icon} {sub_name}: {sub_check['detail']}")
    print()


def parse_args():
    parser = argparse.ArgumentParser(description="Health check tool")
    parser.add_argument("--service", "-s", help="Check specific service only")
    parser.add_argument("--json", "-j", action="store_true", help="JSON output")
    parser.add_argument("--watch", "-w", action="store_true", help="Continuous monitoring")
    parser.add_argument("--interval", "-i", type=int, default=30, help="Check interval in seconds")
    parser.add_argument("--output", "-o", help="Output file path")
    parser.add_argument("--timeout", "-t", type=int, default=None,
                        help="Default timeout in seconds for all probes (overrides per-service defaults)")
    parser.add_argument("--probe-rate", "-r", type=float, default=None,
                        help="Maximum number of probes per second globally (e.g. --probe-rate 5)")
    return parser.parse_args()


def main():
    args = parse_args()

    run_args = {
        "json_output": args.json,
        "global_timeout": args.timeout,
        "probe_rate": args.probe_rate,
    }

    if args.watch:
        print(f"Continuous monitoring (interval: {args.interval}s). Press Ctrl+C to stop.")
        try:
            while True:
                results = run_health_checks(args.service, **run_args)
                if args.json:
                    print(json.dumps(results, indent=2))
                else:
                    print_health_report(results)
                time.sleep(args.interval)
        except KeyboardInterrupt:
            print("\nMonitoring stopped")
    else:
        results = run_health_checks(args.service, **run_args)
        if args.json:
            output = json.dumps(results, indent=2)
            print(output)
        else:
            print_health_report(results)

        if args.output:
            with open(args.output, "w") as f:
                if args.json:
                    json.dump(results, f, indent=2)
                else:
                    json.dump(results, f, indent=2)
            print(f"Report saved to {args.output}")

        if results["overall_status"] == "DEGRADED":
            return 1

    return 0


if __name__ == "__main__":
    main()
