from __future__ import annotations

import logging
import time

import requests

from config import AGGREGATOR_URL, UPLOAD_INTERVAL_SECONDS
from uploader_queue import pop_metric, push_metric, queue_length

_METRICS_ENDPOINT = AGGREGATOR_URL.rstrip("/") + "/metrics/"

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)


def upload_cycle() -> None:
    total = queue_length()
    if total == 0:
        log.info("No metrics in queue, skipping cycle")
        return

    uploaded = 0
    failed = 0

    for _ in range(total):
        metric = pop_metric()
        if metric is None:
            break
        try:
            resp = requests.post(_METRICS_ENDPOINT, json=metric, timeout=5)
            resp.raise_for_status()
            uploaded += 1
        except requests.RequestException as exc:
            log.warning("Failed to POST metric, re-queuing: %s", exc)
            push_metric(metric)
            failed += 1

    log.info("Upload cycle complete: %d uploaded, %d re-queued", uploaded, failed)


def main() -> None:
    log.info("Uploader started (interval=%ds, target=%s)", UPLOAD_INTERVAL_SECONDS, _METRICS_ENDPOINT)
    while True:
        upload_cycle()
        time.sleep(UPLOAD_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
