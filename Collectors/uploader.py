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
    requeued = 0
    discarded = 0

    for _ in range(total):
        metric = pop_metric()
        if metric is None:
            break
        try:
            resp = requests.post(_METRICS_ENDPOINT, json=metric, timeout=5)
            resp.raise_for_status()
            uploaded += 1
        except requests.HTTPError as exc:
            status = exc.response.status_code
            body = exc.response.text
            if 400 <= status < 500:
                log.warning("Discarding metric (HTTP %d): %s | metric=%s", status, body, metric)
                discarded += 1
            else:
                log.warning("Server error (HTTP %d), re-queuing: %s | metric=%s", status, body, metric)
                push_metric(metric)
                requeued += 1
        except requests.RequestException as exc:
            log.warning("Connection failure, re-queuing: %s | metric=%s", exc, metric)
            push_metric(metric)
            requeued += 1

    log.info("Upload cycle complete: %d uploaded, %d re-queued, %d discarded", uploaded, requeued, discarded)


def main() -> None:
    log.info("Uploader started (interval=%ds, target=%s)", UPLOAD_INTERVAL_SECONDS, _METRICS_ENDPOINT)
    while True:
        upload_cycle()
        time.sleep(UPLOAD_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
