from __future__ import annotations

import platform
import time
from datetime import datetime, timezone

import psutil

import config
import command_listener
from logger import get_logger
from uploader_queue import push_metric

logger = get_logger(__name__)

DEVICE_ID = platform.node()


def _handle_set_interval(value: str) -> None:
    try:
        seconds = int(value)
        config.PC_COLLECT_INTERVAL_SECONDS = seconds
        logger.info("Interval updated to %ds", seconds)
    except ValueError:
        logger.warning("set_interval: invalid value %r", value)


def collect_metrics() -> list[dict]:
    now = datetime.now(timezone.utc).isoformat()

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
            "recorded_at": now,
        },
        {
            "device_id": DEVICE_ID,
            "source": "pc",
            "metric_name": "ram_usage_percent",
            "value": psutil.virtual_memory().percent,
            "unit": "percent",
            "recorded_at": now,
        },
        {
            "device_id": DEVICE_ID,
            "source": "pc",
            "metric_name": "process_count",
            "value": float(len(psutil.pids())),
            "recorded_at": now,
        },
        {
            "device_id": DEVICE_ID,
            "source": "pc",
            "metric_name": "thread_count",
            "value": float(thread_count),
            "recorded_at": now,
        },
    ]


def queue_metrics(metrics: list[dict]) -> None:
    for metric in metrics:
        push_metric(metric)
        logger.info("Queued %s=%s", metric["metric_name"], metric["value"])


def main() -> None:
    command_listener.register_handler("set_interval", _handle_set_interval)
    command_listener.start(device_id=platform.node())

    logger.info(
        "PC collector started (device_id=%s, interval=%ss)",
        DEVICE_ID, config.PC_COLLECT_INTERVAL_SECONDS,
    )
    while True:
        logger.info("Collecting metrics...")
        metrics = collect_metrics()
        queue_metrics(metrics)
        time.sleep(config.PC_COLLECT_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
