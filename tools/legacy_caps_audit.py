#!/usr/bin/env python3
# LEGACY caps audit marker for audit tooling.
"""Audit that files mentioning legacy have an uppercase LEGACY comment."""

from __future__ import annotations

import argparse
import fnmatch
import sys
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]

SKIP_DIRS = {
    ".git",
    ".github",
    ".idea",
    ".vscode",
    "__pycache__",
    "build",
    "dist",
    "node_modules",
    "target",
}

SKIP_PATTERNS = {
    "*.class",
    "*.d",
    "*.exe",
    "*.hi",
    "*.hie",
    "*.logd",
    "*.o",
    "*.png",
    "*.pyc",
    "*.pyo",
    "*.sum",
    "*.tsbuildinfo",
    "Cargo.lock",
    "package-lock.json",
}

COMMENT_PREFIXES = (
    "#",
    "//",
    "/*",
    "*",
    "<!--",
    "--",
    ";",
)

INLINE_COMMENT_MARKERS = (
    "#",
    "//",
    "/*",
    "<!--",
    "--",
)

PROSE_EXTENSIONS = {
    ".md",
    ".rst",
    ".txt",
}


def iter_files(root: Path) -> Iterable[Path]:
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        parts = set(path.relative_to(root).parts[:-1])
        if parts & SKIP_DIRS:
            continue
        if any(fnmatch.fnmatch(path.name, pattern) for pattern in SKIP_PATTERNS):
            continue
        yield path


def read_text(path: Path) -> str | None:
    try:
        data = path.read_bytes()
    except OSError:
        return None

    if b"\0" in data[:4096]:
        return None

    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        return None


def has_legacy_comment(path: Path, text: str) -> bool:
    if path.suffix.lower() in PROSE_EXTENSIONS:
        return "LEGACY" in text

    for line in text.splitlines():
        legacy_index = line.find("LEGACY")
        if legacy_index == -1:
            continue

        stripped = line.lstrip()
        if any(stripped.startswith(prefix) for prefix in COMMENT_PREFIXES):
            return True

        for marker in INLINE_COMMENT_MARKERS:
            marker_index = line.find(marker)
            if marker_index != -1 and marker_index < legacy_index:
                return True

    return False


def audit(root: Path) -> list[Path]:
    violations: list[Path] = []
    for path in iter_files(root):
        text = read_text(path)
        if text is None or "legacy" not in text.lower():
            continue
        if not has_legacy_comment(path, text):
            violations.append(path.relative_to(root))
    return violations


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Verify files mentioning legacy also include an uppercase LEGACY comment."
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=ROOT,
        help="Repository root to audit (defaults to this repository).",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = args.root.resolve()
    violations = audit(root)

    if violations:
        print("Files mentioning legacy without an uppercase LEGACY comment:")
        for path in violations:
            print(f"  - {path.as_posix()}")
        return 1

    print("All files mentioning legacy include an uppercase LEGACY comment.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
