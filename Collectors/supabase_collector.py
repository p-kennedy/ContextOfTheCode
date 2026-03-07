from __future__ import annotations

import time
from datetime import datetime, timezone

from supabase import create_client, Client

import config
import command_listener
from logger import get_logger
from uploader_queue import push_metric

logger = get_logger(__name__)

DEVICE_ID = "supabase-database"


def _handle_set_interval(value: str) -> None:
    try:
        seconds = int(value)
        config.SUPABASE_COLLECT_INTERVAL_SECONDS = seconds
        logger.info("Supabase collect interval updated to %ds", seconds)
    except ValueError:
        logger.warning("set_interval: invalid value %r", value)


def collect_metrics() -> list[dict]:
    now = datetime.now(timezone.utc).isoformat()

    supabase: Client = create_client(config.SUPABASE_URL, config.SUPABASE_ANON_KEY)

    metrics = []

    try:
        # Example metric, can be changed to whatever metrics we actually get
        response = supabase.table('users').select('*', count='exact').execute()
        user_count = response.count
        metrics.append({
            "device_id": DEVICE_ID,
            "source": "supabase",
            "metric_name": "user_count",
            "value": float(user_count),
            "unit": "count",
            "recorded_at": now,
        })

        response = supabase.table('orders').select('total').execute()
        orders = response.data
        if orders:
            avg_order_value = sum(order['total'] for order in orders) / len(orders)
            metrics.append({
                "device_id": DEVICE_ID,
                "source": "supabase",
                "metric_name": "avg_order_value",
                "value": avg_order_value,
                "unit": "currency",
                "recorded_at": now,
            })

    except Exception as exc:
        logger.error("Error collecting Supabase metrics: %s", exc)

    return metrics


def queue_metrics(metrics: list[dict]) -> None:
    for metric in metrics:
        push_metric(metric)
        logger.info("Queued %s=%s", metric["metric_name"], metric["value"])


def main() -> None:
    command_listener.register_handler("set_supabase_interval", _handle_set_interval)
    command_listener.start()

    logger.info(
        "Supabase collector started (device_id=%s, interval=%ss)",
        DEVICE_ID, config.SUPABASE_COLLECT_INTERVAL_SECONDS,
    )
    while True:
        logger.info("Collecting Supabase metrics...")
        metrics = collect_metrics()
        queue_metrics(metrics)
        time.sleep(config.SUPABASE_COLLECT_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
