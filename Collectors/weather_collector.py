from __future__ import annotations

import threading
import time

import requests

import config
import command_listener
from logger import get_logger
from uploader_queue import push_metric

logger = get_logger(__name__)

_restart = threading.Event()

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

WEATHER_VARIABLES = [
    "temperature_2m",
    "relative_humidity_2m",
    "wind_speed_10m",
    "precipitation",
]

UNITS = {
    "temperature_2m":      "celsius",
    "relative_humidity_2m": "percent",
    "wind_speed_10m":      "km/h",
    "precipitation":       "mm",
}


def _handle_set_interval(value: str) -> None:
    try:
        seconds = int(value)
        config.WEATHER_COLLECT_INTERVAL_SECONDS = seconds
        logger.info("Weather collect interval updated to %ds", seconds)
        _restart.set()
    except ValueError:
        logger.warning("set_interval: invalid value %r", value)


def collect_metrics() -> list[dict]:
    params = {
        "latitude": config.WEATHER_LATITUDE,
        "longitude": config.WEATHER_LONGITUDE,
        "current": ",".join(WEATHER_VARIABLES),
        "timezone": "UTC",
    }
    try:
        resp = requests.get(OPEN_METEO_URL, params=params, timeout=10)
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.error("Failed to fetch weather data: %s", exc)
        return []

    body = resp.json()
    current = body.get("current", {})
    recorded_at: str | None = current.get("time")
    if not recorded_at:
        logger.warning("No 'time' field in Open-Meteo response")
        return []

    # Open-Meteo returns bare ISO without timezone (e.g. "2024-01-01T12:00")
    # Append Z so downstream parsing treats it as UTC.
    if not recorded_at.endswith("Z") and "+" not in recorded_at:
        recorded_at += "Z"

    metrics: list[dict] = []
    for variable in WEATHER_VARIABLES:
        value = current.get(variable)
        if value is None:
            logger.warning("Missing variable %r in Open-Meteo response", variable)
            continue
        metrics.append({
            "device_id": config.WEATHER_DEVICE_ID,
            "source": "weather",
            "metric_name": variable,
            "value": float(value),
            "unit": UNITS[variable],
            "recorded_at": recorded_at,
        })

    return metrics


def queue_metrics(metrics: list[dict]) -> None:
    for metric in metrics:
        push_metric(metric)
        logger.info(
            "Queued %s = %s %s",
            metric["metric_name"], metric["value"], metric["unit"],
        )


def main() -> None:
    command_listener.register_handler("set_interval", _handle_set_interval)
    command_listener.start(device_id=config.WEATHER_DEVICE_ID)

    logger.info(
        "Weather collector started (device_id=%s, lat=%s, lon=%s, interval=%ss)",
        config.WEATHER_DEVICE_ID,
        config.WEATHER_LATITUDE,
        config.WEATHER_LONGITUDE,
        config.WEATHER_COLLECT_INTERVAL_SECONDS,
    )

    while True:
        logger.info("Fetching weather metrics...")
        metrics = collect_metrics()
        if metrics:
            queue_metrics(metrics)
            logger.info("Queued %d weather metric(s)", len(metrics))
        else:
            logger.info("No weather metrics collected")
        _restart.clear()
        elapsed = 0
        while elapsed < config.WEATHER_COLLECT_INTERVAL_SECONDS and not _restart.is_set():
            time.sleep(1)
            elapsed += 1


if __name__ == "__main__":
    main()
