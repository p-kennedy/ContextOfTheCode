import datetime as dt
import uuid
from typing import Literal

from pydantic import BaseModel


class MetricEventCreate(BaseModel):
    device_id: str
    source: str
    metric_name: str
    value: float
    unit: str | None = None
    recorded_at: dt.datetime | None = None


class MetricEventRead(BaseModel):
    id: uuid.UUID
    device_id: str
    source: str
    metric_name: str
    value: float
    unit: str | None
    recorded_at: dt.datetime

    model_config = {"from_attributes": True}
