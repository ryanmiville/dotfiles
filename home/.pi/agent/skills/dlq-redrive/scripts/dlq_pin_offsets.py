#!/usr/bin/env python3
"""Pin the redrive consumer group's committed offsets to a 24h boundary.

Usage (env exported per SKILL.md):
    uv run python <skill>/scripts/dlq_pin_offsets.py <DLQ_BROKER_TOPIC> '<TARGET_OFFSETS json>' [GROUP]

TARGET_OFFSETS is the dict printed by dlq_boundaries.py, e.g. '{0: 6648, 5: 33364}'.
Commits those offsets to GROUP (default derived from the topic claim) so a subsequent
plain redrive resumes from the boundary, skipping the stale (>window) tail.

Only run this when dlq_boundaries.py shows target > committed on some partition;
otherwise it is a no-op at best and could re-drive messages at worst.
"""

from __future__ import annotations

import ast
import os
import re
import sys

sys.path.insert(0, "libs/kafka/src")
from confluent_kafka import Consumer, TopicPartition  # noqa: E402
from kafka.auth import build_security_config  # noqa: E402

_SUFFIX = re.compile(r"-[a-z0-9]{5}-[a-z0-9]{5}$")


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    dlq = sys.argv[1]
    target: dict[int, int] = {int(k): int(v) for k, v in ast.literal_eval(sys.argv[2]).items()}
    claim = _SUFFIX.sub("", dlq)
    group = sys.argv[3] if len(sys.argv) > 3 else f"data-platform-dlq-redrive-{claim}"

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

    print(f"dlq={dlq}  group={group}  pinning {target}")
    c = Consumer({**cfg, "group.id": group, "enable.auto.commit": False})
    try:
        tps = [TopicPartition(dlq, p, off) for p, off in target.items()]
        c.commit(offsets=tps, asynchronous=False)
        got = c.committed([TopicPartition(dlq, p) for p in target], timeout=20)
        for tp in sorted(got, key=lambda x: x.partition):
            print(f"  p{tp.partition} committed={tp.offset}")
        print("offsets pinned")
    finally:
        c.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
