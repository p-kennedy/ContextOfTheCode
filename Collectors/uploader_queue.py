from __future__ import annotations

import json
from typing import Optional

import redis

from config import REDIS_HOST, REDIS_PORT

METRICS_QUEUE = "metrics_queue"
MESSAGES_QUEUE = "messages_queue"

_client: Optional[redis.Redis] = None


def _get_client() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
    return _client


# --- metrics_queue ---

def push_metric(metric: dict) -> None:
    _get_client().rpush(METRICS_QUEUE, json.dumps(metric))


def pop_metric() -> Optional[dict]:
    raw = _get_client().lpop(METRICS_QUEUE)
    if raw is None:
        return None
    return json.loads(raw)


def queue_length() -> int:
    return _get_client().llen(METRICS_QUEUE)


# --- messages_queue (server-to-device messaging) ---

def push_message(message: dict) -> None:
    _get_client().rpush(MESSAGES_QUEUE, json.dumps(message))


def pop_message() -> Optional[dict]:
    raw = _get_client().lpop(MESSAGES_QUEUE)
    if raw is None:
        return None
    return json.loads(raw)
