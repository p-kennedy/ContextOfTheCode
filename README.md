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

## Backend API (Android integration guide)

The backend is split into two FastAPI services that share a Postgres database. The **Aggregator** accepts incoming metric data from all clients (PC, Android, Fortnite). The **Reporting** service provides read-only endpoints for querying and visualizing that data. Both services are containerized and run via Docker Compose from the `backend/` directory.

### Aggregator API

**Base URL:** `http://localhost:8001`

#### POST /metrics/

Submit a single metric event.

| Field | Type | Required | Notes |
|---|---|---|---|
| `device_id` | string | yes | Unique identifier for the device |
| `source` | string | yes | One of `"pc"`, `"android"`, `"fortnite"` |
| `metric_name` | string | yes | e.g. `"cpu_usage"`, `"battery_level"` |
| `value` | float | yes | The metric value |
| `unit` | string | no | e.g. `"percent"`, `"celsius"` |
| `recorded_at` | ISO 8601 datetime | no | Defaults to server time if omitted |

**Example request:**

```json
POST http://localhost:8001/metrics/
Content-Type: application/json

{
  "device_id": "pixel-8-a1b2c3",
  "source": "android",
  "metric_name": "battery_level",
  "value": 72.5,
  "unit": "percent"
}
```

**Example response (201):**

```json
{
  "id": "e47ac10b-58cc-4372-a567-0e02b2c3d479",
  "device_id": "pixel-8-a1b2c3",
  "source": "android",
  "metric_name": "battery_level",
  "value": 72.5,
  "unit": "percent",
  "recorded_at": "2026-02-18T14:30:00.000000+00:00"
}
```

### Reporting API

**Base URL:** `http://localhost:8002`

#### GET /metrics/live

Returns recent metrics within a sliding time window (default last 5 minutes).

| Parameter | Type | Required | Notes |
|---|---|---|---|
| `metric_name` | string | no | Filter by metric name |
| `source` | string | no | Filter by source |
| `device_id` | string | no | Filter by device |
| `window_minutes` | int | no | Sliding window size, default `5`, max `60` |
| `limit` | int | no | Max results, default `100`, max `1000` |

#### GET /metrics/history

Returns older metrics that fall outside the live window, with full range query support.

| Parameter | Type | Required | Notes |
|---|---|---|---|
| `metric_name` | string | no | Filter by metric name |
| `source` | string | no | Filter by source |
| `device_id` | string | no | Filter by device |
| `since` | ISO 8601 datetime | no | Start of time range |
| `until` | ISO 8601 datetime | no | End of time range |
| `limit` | int | no | Max results, default `100`, max `1000` |
| `offset` | int | no | Pagination offset, default `0` |

### Interactive docs

Full auto-generated API docs (Swagger UI) are available at `/docs` on each service:

- Aggregator: `http://localhost:8001/docs`
- Reporting: `http://localhost:8002/docs`
