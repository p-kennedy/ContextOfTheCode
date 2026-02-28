from __future__ import annotations

import os

AGGREGATOR_URL: str = os.getenv("AGGREGATOR_URL", "http://200.69.13.70:5008")
REPORTING_URL: str = os.getenv("REPORTING_URL", "http://200.69.13.70:5009")

REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))

REDIS_PUBSUB_HOST: str = os.getenv("REDIS_PUBSUB_HOST", "200.69.13.70")
REDIS_PUBSUB_PORT: int = int(os.getenv("REDIS_PUBSUB_PORT", "5010"))

FORTNITE_ISLAND_CODE: str = os.getenv("FORTNITE_ISLAND_CODE", "3225-0366-8885")

# Mutable at runtime — command_listener updates these in place via the module dict
PC_COLLECT_INTERVAL_SECONDS: int = int(os.getenv("PC_COLLECT_INTERVAL_SECONDS", "30"))
FORTNITE_POLL_INTERVAL_SECONDS: int = int(os.getenv("FORTNITE_POLL_INTERVAL_SECONDS", "600"))
UPLOAD_INTERVAL_SECONDS: int = int(os.getenv("UPLOAD_INTERVAL_SECONDS", "30"))
