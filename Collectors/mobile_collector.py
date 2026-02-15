from __future__ import annotations

from Collectors.contracts import Collector, MetricRecord


class MobileCollector(Collector):
    source_name = "mobile"
    metric_type = "placeholder"

    def collect(self) -> MetricRecord:
        payload = {"status": "not_implemented"}
        return MetricRecord.now(
            source=self.source_name,
            metric_type=self.metric_type,
            payload=payload,
        )
