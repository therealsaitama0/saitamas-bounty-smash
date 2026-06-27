#!/usr/bin/env python3

import json
import sys
import time
import unittest
from unittest.mock import patch, MagicMock

from health_check import (
    TokenBucket,
    CircuitBreaker,
    CircuitBreakerState,
    check_http_service,
    check_tcp_port,
    run_health_checks,
    parse_args,
    _rate_limiter,
    _circuit_breakers,
)


class TestTokenBucket(unittest.TestCase):

    def test_consume_allows_when_tokens_available(self):
        bucket = TokenBucket(rate=10, capacity=10, clock=time.monotonic)
        self.assertTrue(bucket.consume(5))
        self.assertAlmostEqual(bucket.tokens, 5.0)

    def test_consume_blocks_when_empty(self):
        clock = iter([0.0, 0.0, 0.0])
        bucket = TokenBucket(rate=1, capacity=1, clock=lambda: next(clock))
        self.assertTrue(bucket.consume(1))
        self.assertFalse(bucket.consume(1))
        self.assertEqual(bucket.throttled, 1)

    def test_consume_refills_over_time(self):
        clock = iter([0.0, 0.0, 0.0, 1.0, 1.0])
        bucket = TokenBucket(rate=5, capacity=5, clock=lambda: next(clock))
        bucket.consume(5)
        self.assertFalse(bucket.consume(1))
        self.assertTrue(bucket.consume(5))
        self.assertAlmostEqual(bucket.tokens, 0.0)

    def test_tokens_capped_at_capacity(self):
        clock = iter([0.0, 100.0])
        bucket = TokenBucket(rate=1, capacity=5, clock=lambda: next(clock))
        # After 100s of inactivity, tokens are capped at 5, not 105
        self.assertTrue(bucket.consume(5))
        self.assertAlmostEqual(bucket.tokens, 0.0)

    def test_throttled_count_tracks_blocked_consumes(self):
        clock = iter([0.0, 0.0, 0.0, 0.0])
        bucket = TokenBucket(rate=1, capacity=1, clock=lambda: next(clock))
        bucket.consume(1)
        bucket.consume(1)
        bucket.consume(1)
        self.assertEqual(bucket.throttled, 2)

    def test_zero_rate_blocks_all_consumes(self):
        bucket = TokenBucket(rate=0, capacity=0)
        self.assertFalse(bucket.consume(1))

    def test_current_rate_property(self):
        bucket = TokenBucket(rate=7.5)
        self.assertEqual(bucket.current_rate, 7.5)

    def test_reset_stats_clears_throttled(self):
        clock = iter([0.0, 0.0, 0.0])
        bucket = TokenBucket(rate=1, capacity=1, clock=lambda: next(clock))
        bucket.consume(1)
        bucket.consume(1)
        self.assertEqual(bucket.throttled, 1)
        bucket.reset_stats()
        self.assertEqual(bucket.throttled, 0)


class TestCircuitBreaker(unittest.TestCase):

    def test_initial_state_is_closed(self):
        cb = CircuitBreaker(threshold=3, reset_timeout=30)
        self.assertEqual(cb.state, CircuitBreakerState.CLOSED)
        self.assertTrue(cb.allow_request())

    def test_opens_after_threshold_failures(self):
        cb = CircuitBreaker(threshold=3, reset_timeout=30)
        cb.record_failure()
        cb.record_failure()
        cb.record_failure()
        self.assertEqual(cb.state, CircuitBreakerState.OPEN)
        self.assertFalse(cb.allow_request())

    def test_half_open_after_reset_timeout(self):
        clock = iter([0.0, 35.0])
        cb = CircuitBreaker(threshold=2, reset_timeout=30, clock=lambda: next(clock))
        cb.record_failure()
        cb.record_failure()
        self.assertEqual(cb.state, CircuitBreakerState.OPEN)
        self.assertTrue(cb.allow_request())
        self.assertEqual(cb.state, CircuitBreakerState.HALF_OPEN)

    def test_half_open_transitions_to_closed_on_success(self):
        clock = iter([0.0, 31.0])
        cb = CircuitBreaker(threshold=2, reset_timeout=30, clock=lambda: next(clock))
        cb.record_failure()
        cb.record_failure()
        cb.allow_request()
        self.assertEqual(cb.state, CircuitBreakerState.HALF_OPEN)
        cb.record_success()
        self.assertEqual(cb.state, CircuitBreakerState.CLOSED)

    def test_half_open_probe_cost_is_double(self):
        clock = iter([0.0, 31.0])
        cb = CircuitBreaker(threshold=1, reset_timeout=30, clock=lambda: next(clock))
        self.assertEqual(cb.probe_cost, 1.0)
        cb.record_failure()
        self.assertEqual(cb.state, CircuitBreakerState.OPEN)
        cb.allow_request()
        self.assertEqual(cb.state, CircuitBreakerState.HALF_OPEN)
        self.assertEqual(cb.probe_cost, 2.0)

    def test_closed_probe_cost_is_one(self):
        cb = CircuitBreaker()
        self.assertEqual(cb.probe_cost, 1.0)

    def test_success_resets_failure_count(self):
        cb = CircuitBreaker(threshold=3)
        cb.record_failure()
        cb.record_failure()
        cb.record_success()
        cb.record_failure()
        self.assertTrue(cb.allow_request())
        self.assertEqual(cb.state, CircuitBreakerState.CLOSED)


class TestCheckHttpService(unittest.TestCase):

    @patch("http.client.HTTPConnection")
    def test_check_http_service_ok(self, mock_conn):
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = b"OK"
        mock_conn_instance = MagicMock()
        mock_conn_instance.getresponse.return_value = mock_resp
        mock_conn.return_value = mock_conn_instance

        status, detail, code = check_http_service("localhost", 8080, "/health", 5)
        self.assertEqual(status, "OK")
        self.assertEqual(code, 200)

    @patch("http.client.HTTPConnection")
    def test_check_http_service_timeout(self, mock_conn):
        mock_conn_instance = MagicMock()
        mock_conn_instance.request.side_effect = Exception("Connection timed out")
        mock_conn.return_value = mock_conn_instance

        status, detail, code = check_http_service("localhost", 8080, "/health", 1)
        self.assertEqual(status, "CRITICAL")
        self.assertEqual(code, 0)


class TestCheckTcpPort(unittest.TestCase):

    @patch("socket.create_connection")
    def test_check_tcp_port_ok(self, mock_create):
        mock_sock = MagicMock()
        mock_create.return_value = mock_sock
        status, detail, latency = check_tcp_port("localhost", 5432, 5)
        self.assertEqual(status, "OK")
        self.assertGreater(latency, 0)

    @patch("socket.create_connection")
    def test_check_tcp_port_refused(self, mock_create):
        mock_create.side_effect = ConnectionRefusedError
        status, detail, latency = check_tcp_port("localhost", 5432, 5)
        self.assertEqual(status, "CRITICAL")
        self.assertEqual(detail, "Connection refused")


class TestRateLimiterIntegration(unittest.TestCase):

    def tearDown(self):
        global _rate_limiter, _circuit_breakers
        import health_check
        health_check._rate_limiter = None
        health_check._circuit_breakers = {}

    def test_rate_limiter_appears_in_report(self):
        with patch("health_check.check_http_service") as mock_check:
            mock_check.return_value = ("OK", "OK", 200)
            result = run_health_checks(service="backend", probe_rate=10)
            self.assertIn("rate_limiter", result)
            self.assertEqual(result["rate_limiter"]["current_rate"], 10)

    def test_throttled_services_show_throttled_status(self):
        with patch("health_check.check_http_service") as mock_check:
            mock_check.return_value = ("OK", "OK", 200)
            result = run_health_checks(
                service="backend",
                probe_rate=0,
            )
            svc = result["services"].get("backend", {})
            self.assertEqual(svc.get("status"), "THROTTLED")


class TestHalfOpenRateReduction(unittest.TestCase):

    def tearDown(self):
        import health_check
        health_check._rate_limiter = None
        health_check._circuit_breakers = {}

    def test_half_open_reduces_probe_rate_to_50_pct(self):
        import health_check
        cb = CircuitBreaker(threshold=1, reset_timeout=0.1)
        health_check._circuit_breakers = {"backend": cb}

        with patch("health_check.check_http_service") as mock_check:
            mock_check.return_value = ("CRITICAL", "fail", 500)

            run_health_checks(service="backend", probe_rate=100)

            self.assertEqual(cb.state, CircuitBreakerState.OPEN)

            time.sleep(0.15)
            cb.allow_request()
            self.assertEqual(cb.state, CircuitBreakerState.HALF_OPEN)

            self.assertEqual(cb.probe_cost, 2.0)


if __name__ == "__main__":
    runner = unittest.TextTestRunner(verbosity=2)
    suite = unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__])
    result = runner.run(suite)
    total = result.testsRun
    passed = total - len(result.failures) - len(result.errors)
    print(f"\n  health-check: {passed}/{total} tests passed")
    sys.exit(0 if result.wasSuccessful() else 1)
