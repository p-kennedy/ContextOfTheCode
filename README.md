# ContextOfTheCode
Project repo for Context of the Code module.

## Current collector shape

The project now uses one shared collector contract in `Collectors/contracts.py`:

- `Collector.collect() -> MetricRecord`
- `MetricRecord` envelope: `source`, `metric_type`, `captured_at`, `payload`

This keeps the pipeline source-agnostic because all collectors emit the same envelope, regardless of how data is gathered.

## PC metrics

`Collectors/pc_collector.py` currently captures:

- CPU usage percent
- RAM usage percent
- Process count
- Thread count

Dependency: `pip install psutil`

## JSON conversion recommendation

Convert to JSON at the uploader boundary, not inside collectors.

- Collectors should return typed `MetricRecord` objects.
- `Uploader/uploader_queue.py` serializes with `get_json()` / `serialize()`.

This keeps collection and transport concerns separated and makes collector interchangeability straightforward.
