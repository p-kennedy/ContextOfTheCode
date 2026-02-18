import datetime as dt
import uuid

from pydantic import BaseModel


class MetricEventRead(BaseModel):
    id: uuid.UUID
    device_id: str
    source: str
    metric_name: str
    value: float
    unit: str | None
    recorded_at: dt.datetime

    model_config = {"from_attributes": True}


class MetricSummary(BaseModel):
    metric_name: str
    count: int
    total: float
    average: float
    min_value: float
    max_value: float
