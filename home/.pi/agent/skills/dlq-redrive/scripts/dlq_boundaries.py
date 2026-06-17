#!/usr/bin/env python3
"""Show per-partition 24h-boundary vs committed offsets for a DLQ topic.

Usage (run from a data-platform worktree, env already exported per SKILL.md):
    uv run python <skill>/scripts/dlq_boundaries.py <DLQ_BROKER_TOPIC> [GROUP] [WINDOW_HOURS]

GROUP defaults to data-platform-dlq-redrive-<claim derived from topic by stripping
the Crossplane suffix>. WINDOW_HOURS defaults to 24.

Prints a table and a TARGET_OFFSETS={...} line (feed to dlq_pin_offsets.py).
`target = max(committed, first-offset-with-ts>=cutoff)` per partition: the point a
last-window redrive should resume from without re-driving already-driven messages.
"""

from __future__ import annotations

import os
import re
import sys
import time

sys.path.insert(0, "libs/kafka/src")
from confluent_kafka import Consumer, TopicPartition  # noqa: E402
from kafka.auth import build_security_config  # noqa: E402

_SUFFIX = re.compile(r"-[a-z0-9]{5}-[a-z0-9]{5}$")


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    dlq = sys.argv[1]
    claim = _SUFFIX.sub("", dlq)
    group = sys.argv[2] if len(sys.argv) > 2 else f"data-platform-dlq-redrive-{claim}"
    window_h = float(sys.argv[3]) if len(sys.argv) > 3 else 24.0

    bs = os.environ["KAFKA_BOOTSTRAP_SERVERS"]
    region = os.environ.get("KAFKA_AWS_REGION", "us-east-2")
    sec = build_security_config(
        security_protocol="SASL_SSL",
        sasl_mechanism="AWS_MSK_IAM",
        sasl_username="",
        sasl_password="",
        ssl_cafile=None,
        aws_region=region,
    )
    cfg = {"bootstrap.servers": bs, "broker.address.family": "v4", **sec}

    now = int(time.time() * 1000)
    cutoff = now - int(window_h * 3600 * 1000)
    print(f"now_ms={now}  cutoff(now-{window_h}h)_ms={cutoff}  ({time.ctime(cutoff / 1000)})")
    print(f"dlq={dlq}  group={group}")

    c = Consumer({**cfg, "group.id": group, "enable.auto.commit": False})
    try:
        md = c.list_topics(dlq, timeout=20)
        parts = sorted(md.topics[dlq].partitions.keys())
        otf = {tp.partition: tp.offset for tp in c.offsets_for_times([TopicPartition(dlq, p, cutoff) for p in parts], timeout=30)}
        committed = {tp.partition: tp.offset for tp in c.committed([TopicPartition(dlq, p) for p in parts], timeout=30)}

        print(f"{'part':>4} {'low':>10} {'high':>10} {'committed':>10} {'boundary':>10} {'target':>10}")
        target: dict[int, int] = {}
        for p in parts:
            lo, hi = c.get_watermark_offsets(TopicPartition(dlq, p), timeout=15)
            b = otf.get(p, -1)
            boundary = hi if b in (-1, None) else b  # no msg newer than cutoff -> nothing to drive
            com = committed.get(p)
            com_val = 0 if com in (None, -1, -1001) else com  # -1001 = no committed offset
            tgt = max(com_val, boundary)
            target[p] = tgt
            com_disp = "none" if com in (None, -1, -1001) else str(com)
            print(f"{p:>4} {lo:>10} {hi:>10} {com_disp:>10} {boundary:>10} {tgt:>10}  -> would redrive {max(0, hi - tgt)} msgs")
        print("TARGET_OFFSETS=" + repr(target))
    finally:
        c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
