from __future__ import annotations

import time
from datetime import datetime

import requests

ISLAND_CODE = "3225-0366-8885"
BASE_URL = f"https://api.fortnite.com/ecosystem/v1/islands/{ISLAND_CODE}/metrics/minute"
AGGREGATOR_URL = "http://localhost:8001/metrics/"
REPORTING_URL = "http://localhost:8002/metrics/"
DEVICE_ID = "fortnite-island"
INTERVAL_SECONDS = 600  # 10 minutes

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
        print(f"  Could not fetch last recorded_at: {exc}")
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


def poll_and_post() -> None:
    last_recorded = get_last_recorded_at()
    if last_recorded is None:
        print("  No existing fortnite data in DB, will post all non-null intervals")
    else:
        print(f"  Last recorded_at in DB: {last_recorded.isoformat()}")

    for endpoint, metric_name in METRICS.items():
        posted = 0
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
                resp = requests.post(AGGREGATOR_URL, json=payload, timeout=5)
                resp.raise_for_status()
                posted += 1

            print(f"  {metric_name}: posted {posted} new interval(s)")
        except requests.RequestException as exc:
            print(f"  Failed {metric_name}: {exc}")


def main() -> None:
    print(f"Fortnite poller started (island={ISLAND_CODE}, interval={INTERVAL_SECONDS}s)")
    while True:
        print("Polling Fortnite metrics...")
        poll_and_post()
        time.sleep(INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
