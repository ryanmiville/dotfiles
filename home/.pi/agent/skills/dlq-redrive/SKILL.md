---
name: dlq-redrive
description: Redrive messages from a data-platform Kafka DLQ topic back to its live topic in prod, with optional last-24h windowing, and monitor progress. Use when the user asks to redrive/replay a DLQ, drain a dead-letter queue, reprocess DLQ'd op-data messages, or recover from a DLQ backlog in prod-us/prod-eu.
---

# DLQ Redrive (data-platform)

Re-produces DLQ messages verbatim (value/key/headers/event-time) to the live topic via
`tools/dlq_redrive.py`. Mapping (claim → broker topics) comes from `services/*/helm/<env>_<market>.yaml`.
Stable consumer group `data-platform-dlq-redrive-<claim>` makes runs resumable and idempotent.

## Critical constraints

- **Serialize runs.** Never run two redrives for the same DLQ at once (the tool's pause logic is process-local).
- **24h timestamp guard.** Live topics set `message.timestamp.before.max.ms=86400000` (24h). Re-producing a
  message whose Kafka `CreateTime` is >24h old is **rejected `INVALID_TIMESTAMP`** → that partition pauses.
  So a plain redrive only works for messages produced in the last 24h. For older backlogs, see "Older than 24h".
- Run on VPN. Prod auth is AWS_MSK_IAM with `AWS_PROFILE=prod`.

## Setup (prod-us)

```bash
cd <any-worktree>/data-platform              # must contain tools/dlq_redrive.py
export AWS_PROFILE=prod
aws sts get-caller-identity | head           # confirm creds
BS="$(kubectl --context us-c2 -n data-platform get cm kafka-config-prod-us -o jsonpath='{.data.KAFKA_BOOTSTRAP_SERVERS}')"
export KAFKA_SECURITY_PROTOCOL=SASL_SSL KAFKA_SASL_MECHANISM=AWS_MSK_IAM KAFKA_AWS_REGION=us-east-2 KAFKA_BOOTSTRAP_SERVERS="$BS"
```
Find the claim name: `grep -E 'KAFKA_(TOPICS|DLQ_TOPIC)' services/<svc>/helm/prod_us.yaml`.
op-data: claim `op-data-prod-us-dlq`, owner `op-data-processor`.

## Workflow

1. **Dry run** (verify connectivity + see what would forward):
   ```bash
   uv run python tools/dlq_redrive.py --env prod --market us --dlq <claim> --dry-run --max-messages 5
   ```
2. **Check the 24h window** — compute per-partition boundary offsets and compare to the group's committed
   offsets: `scripts/dlq_boundaries.py <DLQ_BROKER_TOPIC>`. If `target == committed` on every partition, a
   plain redrive already starts at the 24h boundary (no pinning needed). If any `target > committed`, pin
   offsets first (see "Last 24h only").
3. **Run live, in background, and monitor**:
   ```bash
   LOG=/tmp/dlq_redrive_$(date +%H%M%S).log; echo "$LOG" > /tmp/dlq_redrive_logpath
   nohup env AWS_PROFILE=prod KAFKA_SECURITY_PROTOCOL=SASL_SSL KAFKA_SASL_MECHANISM=AWS_MSK_IAM \
     KAFKA_AWS_REGION=us-east-2 KAFKA_BOOTSTRAP_SERVERS="$BS" \
     uv run python tools/dlq_redrive.py --env prod --market us --dlq <claim> > "$LOG" 2>&1 &
   ```
   Poll: `scripts/dlq_progress.sh` (forwarded / rejected / paused / last-offset / running?). Expect ~600 msg/min.
4. **Verify done** — rerun `scripts/dlq_boundaries.py`; every partition should show `would redrive 0 msgs`
   and `committed == high`. Confirm `errors=0` in the run summary.

## Last 24h only (pin offsets)

When `target > committed` (older un-driven messages exist), pin the group's committed offsets to the 24h
boundary so the redrive skips the stale tail: `scripts/dlq_pin_offsets.py <DLQ_BROKER_TOPIC> '<json target dict>'`,
then run step 3. The `TARGET_OFFSETS={...}` line printed by `dlq_boundaries.py` is the input.

## Older than 24h (full backlog)

Only if explicitly required. Temporarily raise the live topic's `message.timestamp.before.max.ms` (e.g. to
365d), redrive, then **revert to `86400000` immediately**. See [REFERENCE.md](REFERENCE.md). Riskier — prefer the
24h window unless the user wants the whole backlog.

## Why CreateTime ≈ event time

op-data-emitter and the `_dlq` produce both send with no explicit timestamp → Kafka stamps `now()` at produce.
Near-real-time emission makes `CreateTime ≈ payload.timestamp`. An 11-day-old `CreateTime` means a genuine
backlog produced 11 days ago, not old event-time on a fresh record.
