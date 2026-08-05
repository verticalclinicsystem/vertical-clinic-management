"""
FastAPI application factory — main entry point.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.core.exceptions import ClinicAPIError
from app.core.logging import setup_logging
from app.db.init_db import check_db_connection, create_tables
from app.utils.response import ApiResponse

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    # ── Startup ───────────────────────────────────────────────────────────────
    setup_logging()
    logger.info(f"🚀 Starting {settings.APP_NAME} v{settings.APP_VERSION} [{settings.APP_ENV}]")

    # Verify DB connectivity
    db_ok = await check_db_connection()
    if not db_ok:
        logger.critical("❌ Cannot connect to database. Aborting startup.")
        raise RuntimeError("Database connection failed")

    # Create tables (use Alembic in production for migrations)
    if settings.APP_ENV != "production":
        await create_tables()
        from app.db.init_db import seed_database
        await seed_database()

    logger.info("✅ Application ready")
    yield

    # ── Shutdown ──────────────────────────────────────────────────────────────
    logger.info("🛑 Shutting down application")


def create_app() -> FastAPI:
    """Factory function — creates and configures the FastAPI application."""

    openapi_tags = [
        {"name": "Authentication", "description": "User authentication, registration, token refresh, and OTP verification endpoints."},
        {"name": "Admin Portal", "description": "Global administration, user management, and branch setups."},
        {"name": "Receptionist Portal", "description": "Patient registration, appointments scheduling, and receptionist actions."},
        {"name": "Doctor Portal", "description": "Doctor operations, consultations, prescriptions, treatment plans, and teleconsultations."},
        {"name": "Patient Portal", "description": "Patient profiles, preferences, medical reports, and self-service features."},
        {"name": "Pharmacy Portal", "description": "Medicine inventory management and prescription dispensing."},
        {"name": "Billing & Payments", "description": "Invoicing, payments tracking, and Stripe checkouts."},
        {"name": "AI Assistant", "description": "AI-powered clinical insights and audio dictations."},
        {"name": "System & Notifications", "description": "Notifications, communication logs, and system health checks."},
    ]

    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="AI-Powered Multi-Branch Clinic Management System API",
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        openapi_url="/openapi.json" if not settings.is_production else None,
        openapi_tags=openapi_tags,
        lifespan=lifespan,
    )

    # ── Middleware ────────────────────────────────────────────────────────────
    from app.middleware.request_tracking import RequestTrackingMiddleware
    app.add_middleware(RequestTrackingMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_origin_regex=r"https?://.*\.trycloudflare\.com|https?://.*\.ngrok-free\.dev|http://localhost:\d+",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # ── Static Files ──────────────────────────────────────────────────────────
    from fastapi.staticfiles import StaticFiles
    import os
    os.makedirs("static/uploads", exist_ok=True)
    app.mount("/static", StaticFiles(directory="static"), name="static")

    # ── Exception Handlers ────────────────────────────────────────────────────
    from fastapi.exceptions import RequestValidationError
    from starlette.exceptions import HTTPException as StarletteHTTPException
    from app.utils.response import ApiResponse

    @app.exception_handler(ClinicAPIError)
    async def clinic_error_handler(request: Request, exc: ClinicAPIError) -> JSONResponse:
        logger.warning(
            "API Failure - Exception: %s | Path: %s | Status: %d | Error Code: %s | Reason: %s",
            exc.__class__.__name__,
            request.url.path,
            exc.status_code,
            getattr(exc, "error_code", "API_ERROR"),
            exc.detail
        )
        return ApiResponse.error(
            message=exc.detail,
            status_code=exc.status_code,
            error_code=getattr(exc, "error_code", "API_ERROR"),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        errors = exc.errors()
        message = "Validation failed"
        if errors:
            first_err = errors[0]
            loc = " -> ".join(str(x) for x in first_err.get("loc", []))
            message = f"Validation failed: {first_err.get('msg')} at {loc}"
        
        logger.warning(
            "API Failure - RequestValidationError | Path: %s | Status: 422 | Reason: %s | Errors: %s",
            request.url.path,
            message,
            errors
        )
        return ApiResponse.error(
            message=message,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            error_code="VALIDATION_ERROR",
        )

    @app.exception_handler(StarletteHTTPException)
    async def fastapi_http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        logger.warning(
            "API Failure - StarletteHTTPException | Path: %s | Status: %d | Reason: %s",
            request.url.path,
            exc.status_code,
            exc.detail
        )
        return ApiResponse.error(
            message=exc.detail,
            status_code=exc.status_code,
            error_code="HTTP_ERROR",
        )

    @app.exception_handler(Exception)
    async def generic_error_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception(f"Unhandled exception: {exc}")
        return ApiResponse.error(
            message="An unexpected error occurred",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_code="INTERNAL_ERROR",
        )
    from app.exceptions.exception_handlers import register_exception_handlers
    register_exception_handlers(app)

    # ── Routers ───────────────────────────────────────────────────────────────
    from app.api.v1 import router as v1_router
    app.include_router(v1_router, prefix="/api/v1")

    # ── WebSocket Route ───────────────────────────────────────────────────────
    from fastapi import WebSocket, WebSocketDisconnect
    from app.core.websocket import manager

    @app.websocket("/api/v1/ws")
    async def websocket_endpoint(websocket: WebSocket):
        token = websocket.query_params.get("token")
        user_id = None
        role = None
        branch_id = None
        if token:
            try:
                from app.core.security import decode_access_token
                payload = decode_access_token(token)
                user_id = payload.get("sub")
                role = payload.get("role")
                branch_id = payload.get("branch_id")
            except Exception as jwt_err:
                logger.warning(f"Failed to decode websocket connection token: {jwt_err}")

        await manager.connect(websocket, user_id=user_id, role=role, branch_id=branch_id)
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            manager.disconnect(websocket)
        except Exception as e:
            logger.error(f"WebSocket connection error: {e}")
            manager.disconnect(websocket)


    # ── Root & Health Check ───────────────────────────────────────────────────
    @app.get("/", tags=["System & Notifications"], summary="Root endpoint")
    async def root() -> JSONResponse:
        return ApiResponse.success(
            data={
                "app": settings.APP_NAME,
                "version": settings.APP_VERSION,
                "docs": "/docs",
                "health": "/health",
            },
            message=f"Welcome to {settings.APP_NAME}. ",
        )

    @app.get("/health", tags=["System & Notifications"], summary="Health check")
    async def health_check() -> JSONResponse:
        return ApiResponse.success(
            data={
                "status": "ok",
                "app": settings.APP_NAME,
                "version": settings.APP_VERSION,
                "env": settings.APP_ENV,
            },
            message="System is healthy",
        )

    return app


# WSGI/ASGI entrypoint
app = create_app()
