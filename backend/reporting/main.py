import os
from contextlib import asynccontextmanager

import redis as redis_lib
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.metrics import router as metrics_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.redis = redis_lib.Redis(
        host=os.getenv("REDIS_HOST", "redis"),
        port=6379,
        decode_responses=True,
    )
    yield
    app.state.redis.close()


app = FastAPI(title="MetricsFlow Reporting", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials = True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(metrics_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "reporting"}
