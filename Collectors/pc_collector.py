from __future__ import annotations

import platform
import time

import psutil
import requests

AGGREGATOR_URL = "http://localhost:8001/metrics/"
DEVICE_ID = platform.node()
INTERVAL_SECONDS = 30


def collect_metrics() -> list[dict]:
    thread_count = 0
    for process in psutil.process_iter():
        try:
            thread_count += process.num_threads()
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    return [
        {
            "device_id": DEVICE_ID,
            "source": "pc",
            "metric_name": "cpu_percent",
            "value": psutil.cpu_percent(interval=0.2),
            "unit": "percent",
        },
        {
            "device_id": DEVICE_ID,
            "source": "pc",
            "metric_name": "ram_usage_percent",
            "value": psutil.virtual_memory().percent,
            "unit": "percent",
        },
        {
            "device_id": DEVICE_ID,
            "source": "pc",
            "metric_name": "process_count",
            "value": float(len(psutil.pids())),
        },
        {
            "device_id": DEVICE_ID,
            "source": "pc",
            "metric_name": "thread_count",
            "value": float(thread_count),
        },
    ]


def post_metrics(metrics: list[dict]) -> None:
    for metric in metrics:
        try:
            resp = requests.post(AGGREGATOR_URL, json=metric, timeout=5)
            resp.raise_for_status()
            print(f"  Posted {metric['metric_name']}={metric['value']}")
        except requests.RequestException as exc:
            print(f"  Failed to post {metric['metric_name']}: {exc}")


def main() -> None:
    print(f"PC collector started (device_id={DEVICE_ID}, interval={INTERVAL_SECONDS}s)")
    while True:
        print(f"Collecting metrics...")
        metrics = collect_metrics()
        post_metrics(metrics)
        time.sleep(INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
