# Reference: Data Platform Health Check

## Datadog MCP API Notes

### Metric queries require structured format

Use `datadog_get_datadog_metric` with these required fields:
- `queries`: array of raw query strings
- `response_format`: `"scalar"` for current-state snapshots
- `from` / `to`: e.g. `"now-1h"` / `"now"`

Do **not** use a bare `query` parameter — it will error.

### Tag patterns

| Scope | Tags |
|-------|------|
| Kafka / K8s | `env:prod AND market:us` |
| RDS Aurora | `env:prod AND market:us AND dbinstanceidentifier:prod-aurora-instance-*` |
| K8s namespace | `kube_namespace:data-platform` |
| Consumer groups | `consumer_group:data-platform-*` |

## Monitor Thresholds (as of 2026-06)

| Monitor | Threshold | Status to watch |
|---------|-----------|-----------------|
| Consumer lag (msg count) | > 50,000 messages | Alert |
| Consumer time lag | > 60 seconds sustained 5min | Alert |
| Pod bad phase | Pending/Failed > 15min | Alert |
| Pod restart rate | > 2 restarts in 10min | Alert |
| Pod memory over request | > 200% | Alert |
| Memory anomaly | 2σ above hourly baseline | Alert |
| CPU anomaly | 2σ above hourly baseline | Alert |
| Op ID error grouping | ≥ 5 errors per op in 15min | Alert |
| RDS connection saturation | > 4,000 connections | Alert |
| RDS CPU sustained | > 70% avg 5min | Alert |
| RDS freeable memory | < 20 GiB (crit) / 50 GiB (warn) | Alert/Warn |
| RDS disk queue | > 200 avg 5min | Alert |
| RDS replica lag | > 10,000 ms | Alert |
| PG deadlocks | > 0 in 15min | Alert |
| PG idle-in-transaction | > 200 sessions avg 30min | Alert |

## Known Stale Consumer Groups

These consumer groups exist on MSK but their services are decomm'd. They will report lag but should be **ignored** in assessments:

- `data-platform-neo-pg-agg` — decomm'd, no helm file, typically 200k+ lag
- `data-platform-analyze-passwords` — replicaCount: 0
- `data-platform-internal-build-findings` — replicaCount: 0
- `data-platform-internal-reporting-updater` — replicaCount: 0
- `data-platform-reconciliation` — replicaCount: 0
- `data-platform-webapp-activity-emitter` — decomm'd, no helm file
- `data-platform-internal-agg` — decomm'd, no helm file

The `data-platform-neo-pg-agg` group is the primary cause of the consumer lag monitor firing. It should be deleted from MSK or excluded from the monitor.

## Pipeline Topology

```
op-data (SQS) → op-data-processor
                  ├──→ [neo-delta topic] → host-observed → [host-observed topic] → host-matching
                  │                      → implant-telemetry
                  │                      → xform-op-data → [xform-neo-delta topic] → action-log-lifecycle-emitter
                  │                                                                → internal-finding-emitter
                  │                                                                → webapp-finding-emitter
                  └──→ [host-observed topic] → host-matching
```

## Aurora Instance Roles

- `prod-aurora-instance-01` — writer (write_latency > 0, no replica lag)
- `prod-aurora-instance-02` — reader
- `prod-aurora-instance-03` — reader

Identify the writer by: has write_latency > 0, no aurora_replica_lag metric.
