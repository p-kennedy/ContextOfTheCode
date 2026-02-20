from __future__ import annotations

import platform
import time

import psutil

from config import UPLOAD_INTERVAL_SECONDS
from uploader_queue import push_metric

DEVICE_ID = platform.node()


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


def queue_metrics(metrics: list[dict]) -> None:
    for metric in metrics:
        push_metric(metric)
        print(f"  Queued {metric['metric_name']}={metric['value']}")


def main() -> None:
    print(f"PC collector started (device_id={DEVICE_ID}, interval={UPLOAD_INTERVAL_SECONDS}s)")
    while True:
        print(f"Collecting metrics...")
        metrics = collect_metrics()
        queue_metrics(metrics)
        time.sleep(UPLOAD_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
