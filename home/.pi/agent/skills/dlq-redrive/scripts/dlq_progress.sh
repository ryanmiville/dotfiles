#!/usr/bin/env bash
# Poll progress of a running dlq_redrive.py (log path stored in /tmp/dlq_redrive_logpath).
# Usage: dlq_progress.sh [log_path]
set -euo pipefail
LOG="${1:-$(cat /tmp/dlq_redrive_logpath 2>/dev/null)}"
[ -z "${LOG:-}" ] && { echo "no log path (pass one or write /tmp/dlq_redrive_logpath)"; exit 2; }
[ -f "$LOG" ] || { echo "log not found: $LOG"; exit 2; }

echo "log: $LOG"
echo "forwarded: $(grep -c ' forwarded ' "$LOG" || true)  rejected/failed: $(grep -cE 'REJECTED|FAILED|UNDELIVERED' "$LOG" || true)  paused: $(grep -c 'Paused ' "$LOG" || true)"
echo "last offset: $(grep ' forwarded ' "$LOG" | grep -oE 'p[0-9]+@[0-9]+' | tail -1 || true)"
echo "running? $(pgrep -f tools/dlq_redrive.py >/dev/null && echo yes || echo no)"
# Surface any problems and the latest lines.
grep -E "REJECTED|FAILED|UNDELIVERED|Paused |Done:" "$LOG" | tail -5 || true
echo "--- tail ---"
tail -3 "$LOG" | grep -vE "GETSUBSCRIPTIONS|Loading cached SSO|Built |Building " || true
