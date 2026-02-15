from __future__ import annotations

from Collectors.contracts import Collector, MetricRecord

try:
    import psutil
except ImportError:  # pragma: no cover - runtime dependency
    psutil = None


class PCMetricsCollector(Collector):
    source_name = "pc"
    metric_type = "system_usage"

    def collect(self) -> MetricRecord:
        if psutil is None:
            raise RuntimeError("psutil is required for PC metrics collection.")

        thread_count = 0
        for process in psutil.process_iter():
            try:
                thread_count += process.num_threads()
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue

        payload = {
            "cpu_usage_percent": psutil.cpu_percent(interval=0.2),
            "ram_usage_percent": psutil.virtual_memory().percent,
            "process_count": len(psutil.pids()),
            "thread_count": thread_count,
        }
        return MetricRecord.now(
            source=self.source_name,
            metric_type=self.metric_type,
            payload=payload,
        )
