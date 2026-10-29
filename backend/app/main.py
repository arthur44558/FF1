import logging
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.api import auth, clinical, contacts, operations, policies, reminders, scans
from app.core.config import settings
from app.db import SessionLocal
from app.models import FollowupOrder, ReminderJob, ScanDocument

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("hospital_followup.api")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.private_storage_dir.mkdir(parents=True, exist_ok=True)
    yield


is_development = settings.environment.lower() == "development"
app = FastAPI(
    title="Hospital Follow-up Management API",
    version="0.1.0",
    description="Backend API for verified follow-up coordination and staff reminder tasks.",
    docs_url="/docs" if is_development else None,
    redoc_url="/redoc" if is_development else None,
    openapi_url="/openapi.json" if is_development else None,
    lifespan=lifespan,
)
if is_development:
    from fastapi.middleware.cors import CORSMiddleware

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.mount(
        "/test-console",
        StaticFiles(directory=Path(__file__).resolve().parent.parent / "test-console", html=True),
        name="test-console",
    )
    prototype_dir = Path(__file__).resolve().parent.parent.parent / "hospital-followup-demo"
    if prototype_dir.exists():
        app.mount(
            "/prototype",
            StaticFiles(
                directory=prototype_dir,
                html=True,
            ),
            name="prototype-ui",
        )
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.allowed_hosts or ["localhost"],
)


@app.middleware("http")
async def safe_request_context(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    logger.info(
        "request_complete",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
        },
    )
    return response


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    safe_errors = [
        {
            "location": [str(part) for part in error.get("loc", ())],
            "code": error.get("type", "invalid"),
            "message": error.get("msg", "Invalid request"),
        }
        for error in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={
            "detail": {
                "code": "request_validation_failed",
                "message": "One or more request fields are invalid",
                "errors": safe_errors,
            }
        },
    )


@app.exception_handler(Exception)
async def unexpected_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(
        "unhandled_request_error",
        extra={"request_id": getattr(request.state, "request_id", None)},
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": {
                "code": "internal_error",
                "message": "The request could not be completed",
                "request_id": getattr(request.state, "request_id", None),
            }
        },
    )


@app.get("/health/live", tags=["health"])
def health_live() -> dict[str, str]:
    return {"status": "live"}


@app.get("/health/ready", tags=["health"])
def health_ready() -> dict[str, str]:
    with SessionLocal() as db:
        db.execute(text("SELECT 1"))
    return {"status": "ready"}


app.include_router(auth.router)
app.include_router(scans.router)
app.include_router(clinical.router)
app.include_router(contacts.router)
app.include_router(reminders.router)
app.include_router(policies.router)
app.include_router(operations.router)
