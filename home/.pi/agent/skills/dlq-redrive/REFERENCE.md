# DLQ Redrive — Reference

## How the tool works (`tools/dlq_redrive.py`)

- Reads the DLQ broker topic, re-produces each message **verbatim** (value, key, headers, and
  CREATE_TIME timestamp) to the live topic. LOG_APPEND_TIME / unavailable timestamps are left for the
  broker to stamp.
- Mapping is resolved at runtime from `services/<svc>/helm/<env>_<market>.yaml` — the `env.KAFKA_TOPICS`
  (live) and `env.KAFKA_DLQ_TOPIC` (DLQ) pairs. The helm values ARE the source of truth; no registry file.
- Operators pass the **claim** name (`--dlq op-data-prod-us-dlq`); the tool strips the Crossplane suffix
  (`-5char-5char`) from broker names to match. No flag overrides the live destination.
- Defense in depth: an admin `list_topics` pre-check confirms both broker topics exist before subscribing.
- Idempotent producer (`enable.idempotence=True`, acks=all). Stable group
  `data-platform-dlq-redrive-<claim>` → resumable across runs and Crossplane topic recreations.
- OTel counters `h3.dlq_redrive.records_forwarded` / `h3.dlq_redrive.errors` (no-op unless a meter
  provider is initialized; inside a pod the collector forwards them to Datadog).

### Failure semantics

On any per-message failure (produce raise, flush-undelivered, delivery rejected, or commit-after-deliver),
the tool **pauses that partition** and stops committing it, so the DLQ offset never advances past an
unprocessed message (Kafka's committed offset is a single per-partition high-water mark). Other partitions
continue. A commit-after-deliver failure means the message landed on the live topic but the offset wasn't
recorded → a rerun **duplicates** that one message. Rerun after fixing the upstream cause to resume.

### Useful flags

- `--dry-run` — consume + log, no produce/commit.
- `--max-messages N`, `--max-runtime SEC` — bounded runs (good for probing).
- `--idle-timeout SEC` (default 30) — stop after no new message. `0` means "stop on first empty poll",
  NOT "no timeout"; use a big value (e.g. 86400) to keep waiting for traffic.
- `--bootstrap-servers`, `--broker-address-family {any,v4,v6}` (default v4; MSK/Strimzi advertise v4).
- `--helm-dir` — for in-pod use after `tar xzf` of the services helm tree.

## The 24h `INVALID_TIMESTAMP` guard

Live topics set `message.timestamp.before.max.ms = 86400000` (24h). A redrive **re-produces**, so messages
whose CreateTime is >24h old are rejected and pause the partition. This guard only fires on *produce* — normal
consume→Postgres ingestion never hits it, which is why the original DLQ'ing wasn't caused by age.

### Option A — last-24h only (preferred)

Pin the redrive group's committed offsets to the 24h boundary (`dlq_boundaries.py` → `dlq_pin_offsets.py`),
then run normally. Often no pinning is needed: if a prior run already committed past everything >24h old,
`committed == boundary` and a plain rerun resumes exactly at the window edge.

### Option B — full backlog (only if explicitly required)

Temporarily relax the **live** topic guard, redrive, then revert. Use the kafka admin client:

```python
import os, sys; sys.path.insert(0, "libs/kafka/src")
from confluent_kafka.admin import AdminClient, ConfigResource, ConfigEntry, AlterConfigOpType
from kafka.auth import build_security_config
bs = os.environ["KAFKA_BOOTSTRAP_SERVERS"]
sec = build_security_config(security_protocol="SASL_SSL", sasl_mechanism="AWS_MSK_IAM",
                            sasl_username="", sasl_password="", ssl_cafile=None, aws_region="us-east-2")
admin = AdminClient({"bootstrap.servers": bs, "broker.address.family": "v4", **sec})
TOPIC = "op-data-prod-us-d29xn-sc5dk"  # the LIVE topic, not the DLQ

# relax to 365d
res = ConfigResource(ConfigResource.Type.TOPIC, TOPIC)
res.add_incremental_config(ConfigEntry("message.timestamp.before.max.ms", "31536000000",
                                       incremental_operation=AlterConfigOpType.SET))
for _, f in admin.incremental_alter_configs([res]).items():
    f.result()

# ... run the redrive ...

# REVERT (do this immediately after — leaving it relaxed is a standing risk)
res = ConfigResource(ConfigResource.Type.TOPIC, TOPIC)
res.add_incremental_config(ConfigEntry("message.timestamp.before.max.ms", "86400000",
                                       incremental_operation=AlterConfigOpType.SET))
for _, f in admin.incremental_alter_configs([res]).items():
    f.result()
```

Config alters propagate over a few seconds; poll `describe_configs` to confirm before/after.

## Environments

| env | market | kube context | namespace | bootstrap configmap |
|-----|--------|--------------|-----------|---------------------|
| prod | us | `us-c2` | `data-platform` | `kafka-config-prod-us` |
| prod | eu | (look up) | `data-platform` | `kafka-config-prod-eu` |

`KAFKA_AWS_REGION=us-east-2` for prod-us. List DLQ claims across services:
```bash
for f in services/*/helm/prod_us.yaml; do
  d=$(grep -E 'KAFKA_DLQ_TOPIC:' "$f" | awk '{print $2}')
  [ -n "$d" ] && echo "$(basename "$(dirname "$(dirname "$f")")"): $d"
done
```

## Observed reference run (prod-us op-data, 2026-06-17)

10,568 messages forwarded (all partition 5, last-24h window), 0 errors, ~18.7 min, ~600 msg/min. No pinning
needed (committed already at the 24h boundary from the prior 2026-06-15 run); no `INVALID_TIMESTAMP`.
