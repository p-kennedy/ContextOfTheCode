from __future__ import annotations

import time
from datetime import datetime

import requests

import config
import command_listener
from logger import get_logger
from uploader_queue import push_metric

logger = get_logger(__name__)

ISLAND_CODE = config.FORTNITE_ISLAND_CODE
BASE_URL = f"https://api.fortnite.com/ecosystem/v1/islands/{ISLAND_CODE}/metrics/minute"
DEVICE_ID = "fortnite-island"

METRICS = {
    "peak-ccu": "peak_ccu",
    "unique-players": "unique_players",
}


def _handle_set_interval(value: str) -> None:
    try:
        seconds = int(value)
        config.FORTNITE_POLL_INTERVAL_SECONDS = seconds
        logger.info("Fortnite poll interval updated to %ds", seconds)
    except ValueError:
        logger.warning("set_interval: invalid value %r", value)


def get_last_recorded_at(metric_name: str) -> datetime | None:
    """Query the Reporting API for the most recent recorded_at for a specific metric."""
    try:
        resp = requests.get(
            f"{config.REPORTING_URL}/metrics/history",
            params={"source": "fortnite", "metric_name": metric_name, "limit": 1},
            timeout=5,
        )
        resp.raise_for_status()
        results = resp.json()
        if results:
            return datetime.fromisoformat(results[0]["recorded_at"])
    except requests.RequestException as exc:
        logger.warning("Could not fetch last recorded_at for %s: %s", metric_name, exc)
    return None


def fetch_intervals(endpoint: str) -> list[dict]:
    url = f"{BASE_URL}/{endpoint}"
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    return resp.json().get("intervals", [])


def parse_interval_time(interval: dict) -> datetime:
    raw = interval.get("time") or interval.get("start") or interval.get("timestamp")
    return datetime.fromisoformat(raw)


def poll_and_queue() -> None:
    for endpoint, metric_name in METRICS.items():
        last_recorded = get_last_recorded_at(metric_name)
        if last_recorded is None:
            logger.info("%s: no existing data, will queue all non-null intervals", metric_name)
        else:
            logger.info("%s: last recorded_at = %s", metric_name, last_recorded.isoformat())

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
    command_listener.register_handler("set_interval", _handle_set_interval)
    command_listener.start()

    logger.info(
        "Fortnite poller started (island=%s, interval=%ss)",
        ISLAND_CODE, config.FORTNITE_POLL_INTERVAL_SECONDS,
    )
    while True:
        logger.info("Polling Fortnite metrics...")
        poll_and_queue()
        time.sleep(config.FORTNITE_POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
