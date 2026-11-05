import json
import os

import redis
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/commands", tags=["commands"])

_PUBSUB_HOST = os.getenv("REDIS_PUBSUB_HOST", "redis")
_PUBSUB_PORT = int(os.getenv("REDIS_PUBSUB_PORT", "6379"))

_redis = redis.Redis(host=_PUBSUB_HOST, port=_PUBSUB_PORT, decode_responses=True)


class CommandPayload(BaseModel):
    device_id: str
    command: str
    value: str = ""


@router.post("/", status_code=200)
def send_command(payload: CommandPayload):
    channel = f"commands:{payload.device_id}"
    message = json.dumps({
        "device_id": payload.device_id,
        "command": payload.command,
        "value": payload.value,
    })
    try:
        receivers = _redis.publish(channel, message)
    except redis.RedisError as exc:
        raise HTTPException(status_code=503, detail=f"Redis unavailable: {exc}")

    return {"channel": channel, "receivers": receivers}
