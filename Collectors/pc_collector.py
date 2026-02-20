from __future__ import annotations

import logging
import platform
import time

import psutil

from config import UPLOAD_INTERVAL_SECONDS
from uploader_queue import push_metric

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

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
        logger.info("Queued %s=%s", metric["metric_name"], metric["value"])


def main() -> None:
    logger.info("PC collector started (device_id=%s, interval=%ss)", DEVICE_ID, UPLOAD_INTERVAL_SECONDS)
    while True:
        logger.info("Collecting metrics...")
        metrics = collect_metrics()
        queue_metrics(metrics)
        time.sleep(UPLOAD_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
