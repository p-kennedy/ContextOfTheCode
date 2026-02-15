from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Protocol


@dataclass(frozen=True)
class MetricRecord:
    source: str
    metric_type: str
    captured_at: str
    payload: dict[str, Any]

    @staticmethod
    def now(source: str, metric_type: str, payload: dict[str, Any]) -> "MetricRecord":
        return MetricRecord(
            source=source,
            metric_type=metric_type,
            captured_at=datetime.now(timezone.utc).isoformat(),
            payload=payload,
        )

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class Collector(Protocol):
    def collect(self) -> MetricRecord:
        """Collect one snapshot from a data source and return a MetricRecord."""

