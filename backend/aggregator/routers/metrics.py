from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models import MetricEvent
from schemas import MetricEventCreate, MetricEventRead

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.post("/", response_model=MetricEventRead, status_code=status.HTTP_201_CREATED)
async def create_metric(
    payload: MetricEventCreate, session: AsyncSession = Depends(get_session)
):
    event = MetricEvent(**payload.model_dump(exclude_none=True))
    session.add(event)
    await session.commit()
    await session.refresh(event)
    return event


@router.post("/batch", response_model=list[MetricEventRead], status_code=status.HTTP_201_CREATED)
async def create_metrics_batch(
    payloads: list[MetricEventCreate], session: AsyncSession = Depends(get_session)
):
    events = [MetricEvent(**p.model_dump(exclude_none=True)) for p in payloads]
    session.add_all(events)
    await session.commit()
    for event in events:
        await session.refresh(event)
    return events


@router.get("/{metric_id}", response_model=MetricEventRead)
async def get_metric(metric_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(MetricEvent).where(MetricEvent.id == metric_id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Metric event not found")
    return event
