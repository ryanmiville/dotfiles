---
name: data-platform-health
description: Assess health of data-platform services in prod-us using Datadog MCP and helm values. Use when user asks about data-platform health, status, errors, consumer lag, DLQ activity, or postgres performance in production.
---

# Data Platform Prod-US Health Check

## Quick Start

Steps 1-2 parallelizable. Steps 3-7 parallelizable after step 1 completes.

### Step 1 — Identify active services

```bash
for f in /Users/ryanmiville/dev/work/data-platform/services/*/helm/prod_us.yaml; do
  svc=$(echo "$f" | sed 's|.*/services/\([^/]*\)/helm/.*|\1|')
  rc=$(grep -E '^\s*replicaCount:' "$f" 2>/dev/null | awk '{print $2}')
  group=$(grep 'KAFKA_GROUP_ID:' "$f" 2>/dev/null | awk '{print $2}')
  echo "$svc | replicas=$rc | group=$group"
done
```

Services with `replicaCount: 0` or no helm file are **decomm'd** — ignore their consumer lag.

### Step 2 — Monitor overview (single most valuable call)

```
tool: datadog_search_datadog_monitors
args: {"query": "data-platform prod-us", "limit": 30}
```

This returns all monitors with current status. Any in `Alert` or `Warn` state need investigation.

### Step 3 — Consumer lag (message count + time lag)

Two scalar metric queries (one call, two entries in `queries`):
```
queries: [
  "max:kafka.consumer_lag{env:prod AND market:us AND consumer_group:data-platform-*} by {consumer_group,topic}",
  "max:aws.kafka.estimated_max_time_lag{consumer_group:data-platform-*,env:prod,market:us} by {consumer_group}"
]
response_format: scalar
from: now-1h
```

Cross-reference with Step 1 to **filter out decomm'd consumer groups**.

### Step 4 — Error logs

```
tool: datadog_search_datadog_logs
query: "env:prod market:us service:(<active-services-OR-list>) status:(error OR critical)"
timeRange: past_4_hours
```

### Step 5 — DLQ activity

```
tool: datadog_search_datadog_logs
query: "env:prod market:us service:(<active-services-OR-list>) (\"sent to DLQ\" OR \"dead letter\")"
timeRange: past_1_day
```

### Step 6 — PostgreSQL (Aurora) health

Single call with all RDS metrics batched:

```
queries: [
  "avg:aws.rds.cpuutilization{env:prod AND market:us AND dbinstanceidentifier:prod-aurora-instance-*} by {dbinstanceidentifier}",
  "max:aws.rds.database_connections{env:prod AND market:us AND dbinstanceidentifier:prod-aurora-instance-*} by {dbinstanceidentifier}",
  "min:aws.rds.freeable_memory{env:prod AND market:us AND dbinstanceidentifier:prod-aurora-instance-*} by {dbinstanceidentifier}",
  "avg:aws.rds.disk_queue_depth{env:prod AND market:us AND dbinstanceidentifier:prod-aurora-instance-*} by {dbinstanceidentifier}",
  "max:aws.rds.aurora_replica_lag{env:prod AND market:us AND dbinstanceidentifier:prod-aurora-instance-*} by {dbinstanceidentifier}",
  "max:aws.rds.read_latency{env:prod AND market:us AND dbinstanceidentifier:prod-aurora-instance-*} by {dbinstanceidentifier}",
  "max:aws.rds.write_latency{env:prod AND market:us AND dbinstanceidentifier:prod-aurora-instance-*} by {dbinstanceidentifier}"
]
response_format: scalar
from: now-1h
```

Also check for deadlocks:

```
tool: datadog_search_datadog_logs
query: "source:postgresql env:prod market:us \"deadlock detected\" h3-etl"
timeRange: past_1_day
```

### Step 7 — Pod health

```
queries: ["max:kubernetes_state.container.restarts{kube_namespace:data-platform AND env:prod AND market:us} by {pod_name}"]
response_format: scalar
from: now-4h
```

## Reporting

Present as table-driven summary. See [REFERENCE.md](REFERENCE.md) for thresholds and known issues.
