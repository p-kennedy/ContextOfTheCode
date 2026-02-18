from contextlib import asynccontextmanager

from fastapi import FastAPI

from database import engine
from models import Base
from routers.metrics import router as metrics_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(title="MetricsFlow Aggregator", lifespan=lifespan)
app.include_router(metrics_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "aggregator"}
