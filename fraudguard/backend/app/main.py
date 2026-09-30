import logging
import time
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.exc import StaleDataError

from app.api import router
from app.config import settings
from app.database import SessionLocal
from app.prototype_api import router as prototype_router

logging.basicConfig(level=logging.INFO)
app = FastAPI(
    title="FraudGuard",
    version="0.1.0",
    description="Explainable transaction risk and human review. Scores are not probabilities.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings().cors_origins,
    allow_methods=["GET", "POST", "PUT", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(router)
app.include_router(prototype_router)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = str(uuid4())
    started = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Cache-Control"] = "no-store"
    logging.info(
        "request id=%s method=%s status=%s duration_ms=%.1f",
        request_id,
        request.method,
        response.status_code,
        (time.perf_counter() - started) * 1000,
    )
    return response


@app.exception_handler(IntegrityError)
@app.exception_handler(StaleDataError)
async def conflict(request, error):
    return JSONResponse(
        status_code=409, content={"detail": "Conflicting update or duplicate record; refresh and retry"}
    )


@app.get("/health")
def health():
    with SessionLocal() as db:
        db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected", "notifications": settings().notification_provider}
