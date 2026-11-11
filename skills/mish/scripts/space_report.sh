#!/usr/bin/env sh
# Read-only disk-space report: scan a root, then summarize top-N and extensions.
# Usage: space_report.sh [root]   (default: /)
set -eu

ROOT="${1:-/}"

# Keep the scan output private and avoid a predictable /tmp path (symlink
# attacks when this script is run as root).
umask 077
TMP_FILE="$(mktemp "${TMPDIR:-/tmp}/mish-scan.XXXXXX")"
trap 'rm -f "$TMP_FILE"' EXIT HUP INT TERM

echo "Scanning ${ROOT} (read-only)…"
mish scan "${ROOT}" --json > "$TMP_FILE"

echo
echo "== Top 25 by allocated size =="
mish top "${ROOT}" -n 25 --metric alloc --json

echo
echo "== Extension breakdown =="
mish ext "${ROOT}" --json
