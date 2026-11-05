import datetime as dt
import json
import logging

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models import MetricEvent
from schemas import MetricEventRead, MetricHistoryPage, MetricSummary

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("/", response_model=list[MetricEventRead])
async def list_metrics(
    metric_name: str | None = None,
    source: str | None = None,
    device_id: str | None = None,
    since: dt.datetime | None = None,
    until: dt.datetime | None = None,
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    query = select(MetricEvent).order_by(MetricEvent.recorded_at.desc())
    if metric_name:
        query = query.where(MetricEvent.metric_name == metric_name)
    if source:
        query = query.where(MetricEvent.source == source)
    if device_id:
        query = query.where(MetricEvent.device_id == device_id)
    if since:
        query = query.where(MetricEvent.recorded_at >= since)
    if until:
        query = query.where(MetricEvent.recorded_at <= until)
    query = query.offset(offset).limit(limit)
    result = await session.execute(query)
    return result.scalars().all()


@router.get("/summary", response_model=list[MetricSummary])
async def summarize_metrics(
    source: str | None = None,
    device_id: str | None = None,
    since: dt.datetime | None = None,
    until: dt.datetime | None = None,
    session: AsyncSession = Depends(get_session),
):
    query = select(
        MetricEvent.metric_name,
        func.count().label("count"),
        func.sum(MetricEvent.value).label("total"),
        func.avg(MetricEvent.value).label("average"),
        func.min(MetricEvent.value).label("min_value"),
        func.max(MetricEvent.value).label("max_value"),
    ).group_by(MetricEvent.metric_name)
    if source:
        query = query.where(MetricEvent.source == source)
    if device_id:
        query = query.where(MetricEvent.device_id == device_id)
    if since:
        query = query.where(MetricEvent.recorded_at >= since)
    if until:
        query = query.where(MetricEvent.recorded_at <= until)
    result = await session.execute(query)
    return [MetricSummary(**row._mapping) for row in result.all()]


@router.get("/live", response_model=list[MetricEventRead])
async def live_metrics(
    metric_name: str | None = None,
    source: str | None = None,
    device_id: str | None = None,
    window_minutes: int = Query(default=5, ge=1, le=60),
    limit: int = Query(default=100, le=1000),
    session: AsyncSession = Depends(get_session),
):
    cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=window_minutes)
    query = (
        select(MetricEvent)
        .where(MetricEvent.recorded_at >= cutoff)
        .order_by(MetricEvent.recorded_at.desc())
    )
    if metric_name:
        query = query.where(MetricEvent.metric_name == metric_name)
    if source:
        query = query.where(MetricEvent.source == source)
    if device_id:
        query = query.where(MetricEvent.device_id == device_id)
    query = query.limit(limit)
    result = await session.execute(query)
    return result.scalars().all()


@router.get("/sources", response_model=list[str])
async def list_sources(
    session: AsyncSession = Depends(get_session),
):
    query = select(MetricEvent.source).distinct().order_by(MetricEvent.source)
    result = await session.execute(query)
    return result.scalars().all()


@router.get("/metric-names", response_model=list[str])
async def list_metric_names(
    source: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    query = select(MetricEvent.metric_name).distinct().order_by(MetricEvent.metric_name)
    if source:
        query = query.where(MetricEvent.source == source)
    result = await session.execute(query)
    return result.scalars().all()


@router.get("/devices", response_model=list[str])
async def list_devices(
    source: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    query = select(MetricEvent.device_id).distinct().order_by(MetricEvent.device_id)
    if source:
        query = query.where(MetricEvent.source == source)
    result = await session.execute(query)
    return result.scalars().all()


@router.get("/history", response_model=MetricHistoryPage)
async def history_metrics(
    request: Request,
    metric_name: str | None = None,
    source: str | None = None,
    device_id: str | None = None,
    since: dt.datetime | None = None,
    until: dt.datetime | None = None,
    limit: int = Query(default=500, le=1000),
    cursor: dt.datetime | None = None,
    session: AsyncSession = Depends(get_session),
):
    cache_key = f"history:{source}:{device_id}:{metric_name}:{since}:{until}:{limit}:{cursor}"
    redis = request.app.state.redis
    cached = redis.get(cache_key)
    if cached:
        logger.info("Cache HIT: %s", cache_key)
        return json.loads(cached)
    logger.info("Cache MISS: %s", cache_key)

    cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=5)
    query = (
        select(MetricEvent)
        .where(MetricEvent.recorded_at < cutoff)
        .order_by(MetricEvent.recorded_at.desc())
    )
    if cursor:
        query = query.where(MetricEvent.recorded_at < cursor)
    if metric_name:
        query = query.where(MetricEvent.metric_name == metric_name)
    if source:
        query = query.where(MetricEvent.source == source)
    if device_id:
        query = query.where(MetricEvent.device_id == device_id)
    if since:
        query = query.where(MetricEvent.recorded_at >= since)
    if until:
        query = query.where(MetricEvent.recorded_at <= until)
    query = query.limit(limit)
    result = await session.execute(query)
    rows = result.scalars().all()
    next_cursor = rows[-1].recorded_at.isoformat() if len(rows) == limit else None

    payload = {
        "data": [
            {
                "id": str(r.id),
                "device_id": r.device_id,
                "source": r.source,
                "metric_name": r.metric_name,
                "value": r.value,
                "unit": r.unit,
                "recorded_at": r.recorded_at.isoformat(),
            }
            for r in rows
        ],
        "next_cursor": next_cursor,
    }
    redis.set(cache_key, json.dumps(payload), ex=30)
    return payload
