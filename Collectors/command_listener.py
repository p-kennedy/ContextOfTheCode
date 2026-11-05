from __future__ import annotations

import json
import threading
import time
from typing import Callable

import redis

import config
from logger import get_logger

logger = get_logger(__name__)

# Map command name -> handler(value: str)
_handlers: dict[str, Callable[[str], None]] = {}


def _on_message(message: dict, device_id: str) -> None:
    if message["type"] != "message":
        return
    try:
        payload = json.loads(message["data"])
    except (json.JSONDecodeError, KeyError):
        logger.warning("command_listener: malformed message: %s", message.get("data"))
        return

    command = payload.get("command", "")
    value = payload.get("value", "")
    target = payload.get("device_id", "")

    logger.info("Command received: command=%s value=%s target=%s", command, value, target)

    if command == "ping":
        logger.info("Pong! Device %s is alive and listening.", device_id)
        return

    handler = _handlers.get(command)
    if handler:
        try:
            handler(value)
        except Exception as exc:
            logger.error("Error handling command %s: %s", command, exc)
    else:
        logger.warning("Unknown command: %s", command)


def _listener_thread(device_id: str) -> None:
    while True:
        try:
            r = redis.Redis(
                host=config.REDIS_PUBSUB_HOST,
                port=config.REDIS_PUBSUB_PORT,
                decode_responses=True,
            )
            pubsub = r.pubsub()
            pubsub.subscribe(f"commands:{device_id}", "commands:all")
            logger.info(
                "Command listener connected (device=%s, redis=%s:%s, channels=commands:%s,commands:all)",
                device_id, config.REDIS_PUBSUB_HOST, config.REDIS_PUBSUB_PORT, device_id,
            )
            for message in pubsub.listen():
                _on_message(message, device_id)
        except Exception as exc:
            logger.warning("Command listener disconnected: %s — reconnecting in 5s", exc)
            time.sleep(5)


def register_handler(command: str, handler: Callable[[str], None]) -> None:
    """Register a callable to handle a named command."""
    _handlers[command] = handler


def start(device_id: str, daemon: bool = True) -> threading.Thread:
    """Start the listener in a background thread and return it."""
    t = threading.Thread(
        target=_listener_thread,
        args=(device_id,),
        name="command-listener",
        daemon=daemon,
    )
    t.start()
    return t
