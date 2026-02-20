from __future__ import annotations

import os

AGGREGATOR_URL: str = os.getenv("AGGREGATOR_URL", "http://localhost:8001")
REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
UPLOAD_INTERVAL_SECONDS: int = int(os.getenv("UPLOAD_INTERVAL_SECONDS", "30"))
FORTNITE_ISLAND_CODE: str = os.getenv("FORTNITE_ISLAND_CODE", "3225-0366-8885")
FORTNITE_POLL_INTERVAL_SECONDS: int = int(os.getenv("FORTNITE_POLL_INTERVAL_SECONDS", "600"))
