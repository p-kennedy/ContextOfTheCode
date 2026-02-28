from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.metrics import router as metrics_router

app = FastAPI(title="MetricsFlow Reporting", lifespan=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(metrics_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "reporting"}
