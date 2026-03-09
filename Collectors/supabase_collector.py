from __future__ import annotations

import threading
import time

from supabase import create_client, Client

import config
import command_listener
from logger import get_logger
from uploader_queue import push_metric

logger = get_logger(__name__)

_restart = threading.Event()

COLLECT_DEVICE_ID = config.SUPABASE_COLLECTOR_DEVICE_ID

METRIC_NAMES = {"balance", "bet_amount", "win_rate", "player_total", "dealer_total"}


def _handle_set_interval(value: str) -> None:
    try:
        seconds = int(value)
        config.SUPABASE_COLLECT_INTERVAL_SECONDS = seconds
        logger.info("Supabase collect interval updated to %ds", seconds)
        _restart.set()
    except ValueError:
        logger.warning("set_interval: invalid value %r", value)


def _load_cursors(
    supabase: Client,
) -> tuple[dict[str, str], set[str]]:
    """
    Query the metrics table for the latest recorded_at per device_id and collect
    the ids of all rows at that exact timestamp. Returns:
      - cursors:  {device_id: latest_recorded_at_iso}
      - seen_ids: set of row ids already processed at the cursor timestamp,
                  so the first poll after a restart doesn't re-queue them.
    """
    cursors: dict[str, str] = {}
    seen_ids: set[str] = {}
    try:
        # Pass 1: find the latest recorded_at per device.
        response = (
            supabase.table("metrics")
            .select("id, device_id, recorded_at")
            .in_("metric_name", list(METRIC_NAMES))
            .order("recorded_at", desc=True)
            .execute()
        )
        seen_ids = set()
        for row in response.data:
            device_id = row["device_id"]
            if device_id not in cursors:
                cursors[device_id] = row["recorded_at"]
            # Collect ids of every row that sits exactly at the cursor timestamp
            # for this device — those are the ones a gte query would return again.
            if row["recorded_at"] == cursors[device_id]:
                seen_ids.add(row["id"])
    except Exception as exc:
        logger.warning("Could not load initial cursors from Supabase: %s", exc)
    logger.info(
        "Loaded cursors for %d device(s), pre-seeded %d seen id(s)",
        len(cursors), len(seen_ids),
    )
    return cursors, seen_ids


def collect_metrics(
    supabase: Client,
    cursors: dict[str, str],
    seen_ids: set[str],
) -> list[dict]:
    """
    Fetch rows from the metrics table that are at or newer than the oldest cursor,
    skip any row id already in seen_ids, process the rest, then advance cursors
    and update seen_ids in place.
    """
    metrics: list[dict] = []
    try:
        query = (
            supabase.table("metrics")
            .select("id, device_id, metric_name, value, unit, recorded_at")
            .in_("metric_name", list(METRIC_NAMES))
            .order("recorded_at", desc=False)
        )

        # Use gte so rows sharing the cursor timestamp are included; seen_ids
        # filters out the ones already processed at that exact timestamp.
        if cursors:
            oldest_cursor = min(cursors.values())
            query = query.gte("recorded_at", oldest_cursor)

        response = query.execute()

        for row in response.data:
            row_id = row["id"]

            # Skip rows we have already processed.
            if row_id in seen_ids:
                continue

            device_id = row["device_id"]
            recorded_at = row["recorded_at"]

            # Per-device guard: skip rows behind this device's own cursor.
            if device_id in cursors and recorded_at < cursors[device_id]:
                continue

            metrics.append({
                "device_id": device_id,
                "source": "android",
                "metric_name": row["metric_name"],
                "value": float(row["value"]),
                "unit": row["unit"],
                "recorded_at": recorded_at,
            })

            seen_ids.add(row_id)

            # Advance this device's cursor; clear seen_ids for older timestamps.
            if device_id not in cursors or recorded_at > cursors[device_id]:
                cursors[device_id] = recorded_at

    except Exception as exc:
        logger.error("Error collecting Supabase metrics: %s", exc)

    return metrics


def queue_metrics(metrics: list[dict]) -> None:
    for metric in metrics:
        push_metric(metric)
        logger.info("Queued %s / %s = %s", metric["device_id"], metric["metric_name"], metric["value"])


def main() -> None:
    command_listener.register_handler("set_interval", _handle_set_interval)
    command_listener.start(device_id=COLLECT_DEVICE_ID)

    supabase: Client = create_client(config.SUPABASE_URL, config.SUPABASE_ANON_KEY)
    cursors, seen_ids = _load_cursors(supabase)

    logger.info(
        "Supabase collector started (interval=%ss, tracking metrics: %s)",
        config.SUPABASE_COLLECT_INTERVAL_SECONDS,
        ", ".join(sorted(METRIC_NAMES)),
    )

    while True:
        logger.info("Polling Supabase metrics...")
        metrics = collect_metrics(supabase, cursors, seen_ids)
        if metrics:
            queue_metrics(metrics)
            logger.info("Queued %d new row(s) across %d device(s)", len(metrics), len({m["device_id"] for m in metrics}))
        else:
            logger.info("No new rows")
        _restart.clear()
        elapsed = 0
        while elapsed < config.SUPABASE_COLLECT_INTERVAL_SECONDS and not _restart.is_set():
            time.sleep(1)
            elapsed += 1


if __name__ == "__main__":
    main()