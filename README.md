# ContextOfTheCode
Project repo for Context of the Code module.

## Metric contract

All collectors emit a flat dict with the following fields:

| Field | Type | Required | Notes |
|---|---|---|---|
| `device_id` | string | yes | Unique identifier for the device |
| `source` | string | yes | Any string identifying the data source (e.g. `"pc"`, `"android"`, `"fortnite"`) |
| `metric_name` | string | yes | e.g. `"cpu_usage"`, `"battery_level"` |
| `value` | float | yes | The metric value |
| `unit` | string | no | e.g. `"percent"`, `"celsius"` |
| `recorded_at` | ISO 8601 datetime | no | Defaults to server time if omitted |

## PC metrics

`Collectors/pc_collector.py` currently captures:

- CPU usage percent
- RAM usage percent
- Process count
- Thread count

Dependency: `pip install psutil`

## Backend API (Android integration guide)

The backend is split into two FastAPI services that share a Postgres database. The **Aggregator** accepts incoming metric data from all clients (PC, Android, Fortnite). The **Reporting** service provides read-only endpoints for querying and visualizing that data. Both services are containerized and run via Docker Compose from the `backend/` directory.

### Aggregator API

**Base URL:** `http://200.69.13.70:5008`

#### POST /metrics/

Submit a single metric event.

| Field | Type | Required | Notes |
|---|---|---|---|
| `device_id` | string | yes | Unique identifier for the device |
| `source` | string | yes | Any string identifying the data source |
| `metric_name` | string | yes | e.g. `"cpu_usage"`, `"battery_level"` |
| `value` | float | yes | The metric value |
| `unit` | string | no | e.g. `"percent"`, `"celsius"` |
| `recorded_at` | ISO 8601 datetime | no | Defaults to server time if omitted |

**Example request:**

```json
POST http://200.69.13.70:5008/metrics/
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

**Base URL:** `http://200.69.13.70:5009`

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
| `limit` | int | no | Max results per page, default `100`, max `1000` |
| `cursor` | string | no | Opaque cursor for pagination (from `next_cursor` in previous response) |

**Response shape:**

```json
{
  "data": [ /* array of metric objects */ ],
  "next_cursor": "<opaque string or null>"
}
```

Pass `next_cursor` back as the `cursor` parameter to fetch the next page. A `null` value means there are no more results.

### Interactive docs

Full auto-generated API docs (Swagger UI) are available at `/docs` on each service:

- Aggregator: `http://200.69.13.70:5008/docs`
- Reporting: `http://200.69.13.70:5009/docs`
