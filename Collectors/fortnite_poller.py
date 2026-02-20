from __future__ import annotations

import logging
import time
from datetime import datetime

import requests

from config import FORTNITE_ISLAND_CODE, FORTNITE_POLL_INTERVAL_SECONDS
from uploader_queue import push_metric

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

ISLAND_CODE = FORTNITE_ISLAND_CODE
BASE_URL = f"https://api.fortnite.com/ecosystem/v1/islands/{ISLAND_CODE}/metrics/minute"
REPORTING_URL = "http://localhost:8002/metrics/"
DEVICE_ID = "fortnite-island"

METRICS = {
    "peak-ccu": "peak_ccu",
    "unique-players": "unique_players",
}


def get_last_recorded_at() -> datetime | None:
    """Query the Reporting API for the most recent fortnite metric timestamp."""
    try:
        resp = requests.get(
            REPORTING_URL,
            params={"source": "fortnite", "limit": 1},
            timeout=5,
        )
        resp.raise_for_status()
        results = resp.json()
        if results:
            return datetime.fromisoformat(results[0]["recorded_at"])
    except requests.RequestException as exc:
        logger.warning("Could not fetch last recorded_at: %s", exc)
    return None


def fetch_intervals(endpoint: str) -> list[dict]:
    """Fetch all intervals from the Fortnite API for the given metric."""
    url = f"{BASE_URL}/{endpoint}"
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    return resp.json().get("intervals", [])


def parse_interval_time(interval: dict) -> datetime:
    """Parse the timestamp from an interval entry."""
    raw = interval.get("time") or interval.get("start") or interval.get("timestamp")
    return datetime.fromisoformat(raw)


def poll_and_queue() -> None:
    last_recorded = get_last_recorded_at()
    if last_recorded is None:
        logger.info("No existing fortnite data in DB, will queue all non-null intervals")
    else:
        logger.info("Last recorded_at in DB: %s", last_recorded.isoformat())

    for endpoint, metric_name in METRICS.items():
        queued = 0
        try:
            intervals = fetch_intervals(endpoint)
            for interval in intervals:
                value = interval.get("value")
                if value is None:
                    continue

                interval_time = parse_interval_time(interval)
                if last_recorded is not None and interval_time <= last_recorded:
                    continue

                payload = {
                    "device_id": DEVICE_ID,
                    "source": "fortnite",
                    "metric_name": metric_name,
                    "value": float(value),
                    "unit": "players",
                    "recorded_at": interval_time.isoformat(),
                }
                push_metric(payload)
                queued += 1

            logger.info("%s: queued %d new interval(s)", metric_name, queued)
        except requests.RequestException as exc:
            logger.warning("Failed %s: %s", metric_name, exc)


def main() -> None:
    logger.info("Fortnite poller started (island=%s, interval=%ss)", ISLAND_CODE, FORTNITE_POLL_INTERVAL_SECONDS)
    while True:
        logger.info("Polling Fortnite metrics...")
        poll_and_queue()
        time.sleep(FORTNITE_POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
