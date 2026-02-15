from __future__ import annotations

import json
from queue import Empty, Queue
from typing import Optional

from Collectors.contracts import MetricRecord


class UploaderQueue:
    def __init__(self, maxsize: int = 0) -> None:
        self._queue: Queue[MetricRecord] = Queue(maxsize=maxsize)

    def put(self, record: MetricRecord) -> None:
        self._queue.put(record)

    def get(self, timeout: Optional[float] = None) -> MetricRecord:
        if timeout is None:
            return self._queue.get()
        return self._queue.get(timeout=timeout)

    def get_json(self, timeout: Optional[float] = None) -> str:
        return self.serialize(self.get(timeout=timeout))

    @staticmethod
    def serialize(record: MetricRecord) -> str:
        return json.dumps(record.to_dict(), separators=(",", ":"))

    def try_get(self) -> Optional[MetricRecord]:
        try:
            return self._queue.get_nowait()
        except Empty:
            return None
