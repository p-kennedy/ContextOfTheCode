from fastapi import FastAPI

from routers.metrics import router as metrics_router

app = FastAPI(title="MetricsFlow Reporting", lifespan=None)
app.include_router(metrics_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "reporting"}
