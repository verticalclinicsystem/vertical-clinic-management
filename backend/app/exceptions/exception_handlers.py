"""
Global exception handlers for standardizing API error responses across the backend.
"""
import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.core.exceptions import ClinicAPIError
from app.utils.response import ApiResponse

logger = logging.getLogger("app.exceptions")


def _clean_field_path(loc: tuple[Any, ...]) -> str:
    """Format Pydantic field location tuple into a clean field path string."""
    filtered = [str(part) for part in loc if str(part) not in ("body", "query", "path", "header")]
    if not filtered:
        filtered = [str(part) for part in loc]
    return " -> ".join(filtered)


def register_exception_handlers(app: FastAPI) -> None:
    """Register all global exception handlers on the FastAPI application."""

    @app.exception_handler(ClinicAPIError)
    async def clinic_api_error_handler(request: Request, exc: ClinicAPIError):
        """Handler for domain business logic exceptions."""
        logger.warning(f"ClinicAPIError [{request.method} {request.url.path}]: {exc.detail}")
        return ApiResponse.error(
            message=exc.detail,
            status_code=exc.status_code,
            error_code=getattr(exc, "error_code", "API_ERROR"),
            path=request.url.path,
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """Handler for Pydantic schema validation errors."""
        formatted_details = []
        clean_messages = []

        for err in exc.errors():
            loc = err.get("loc", ())
            field_path = _clean_field_path(loc)
            raw_msg = str(err.get("msg", "Invalid value"))

            # Strip Pydantic prefixes like "Value error, "
            if raw_msg.startswith("Value error, "):
                raw_msg = raw_msg[len("Value error, "):]

            # Map standard Pydantic messages if needed
            if raw_msg == "Field required":
                raw_msg = f"{field_path.replace('_', ' ').capitalize() if field_path else 'Field'} is required"

            formatted_details.append({
                "field": field_path,
                "message": raw_msg,
                "type": err.get("type", "value_error"),
            })
            clean_messages.append(raw_msg)

        if clean_messages:
            unique_msgs = list(dict.fromkeys(clean_messages))
            summary_msg = " | ".join(unique_msgs)
        else:
            summary_msg = "Validation failed"

        logger.info(f"ValidationError [{request.method} {request.url.path}]: {summary_msg}")
        return ApiResponse.error(
            message=summary_msg,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            error_code="VALIDATION_ERROR",
            details=formatted_details,
            path=request.url.path,
        )

    @app.exception_handler(StarletteHTTPException)
    async def starlette_http_exception_handler(request: Request, exc: StarletteHTTPException):
        """Handler for standard FastAPI/Starlette HTTP status exceptions (404, 405, 401, 403, etc.)."""
        code_map = {
            400: "BAD_REQUEST",
            401: "UNAUTHORIZED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            405: "METHOD_NOT_ALLOWED",
            409: "CONFLICT",
            422: "UNPROCESSABLE_ENTITY",
            429: "TOO_MANY_REQUESTS",
        }
        error_code = getattr(exc, "error_code", code_map.get(exc.status_code, "HTTP_ERROR"))

        logger.info(f"HTTPException [{request.method} {request.url.path}] status={exc.status_code}: {exc.detail}")
        return ApiResponse.error(
            message=str(exc.detail),
            status_code=exc.status_code,
            error_code=error_code,
            path=request.url.path,
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(SQLAlchemyError)
    async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
        """Handler for SQLAlchemy database exceptions."""
        logger.exception(f"SQLAlchemyError [{request.method} {request.url.path}]: {exc}")

        developer_hint = None
        if settings.APP_ENV != "production":
            orig_msg = str(getattr(exc, "orig", exc))
            developer_hint = f"Database error: {orig_msg}. Verify database schema and run migrations or reset_db.py if table/column missing."

        if isinstance(exc, IntegrityError):
            return ApiResponse.error(
                message="A database integrity constraint occurred (e.g. duplicate key or invalid reference).",
                status_code=status.HTTP_400_BAD_REQUEST,
                error_code="DATABASE_INTEGRITY_ERROR",
                path=request.url.path,
                developer_hint=developer_hint,
            )

        return ApiResponse.error(
            message="A database error occurred while processing your request.",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_code="DATABASE_ERROR",
            path=request.url.path,
            developer_hint=developer_hint,
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        """Catch-all handler for unexpected 500 server errors."""
        logger.exception(f"Unhandled Exception [{request.method} {request.url.path}]: {exc}")

        developer_hint = str(exc) if settings.APP_ENV != "production" else None
        return ApiResponse.error(
            message="An unexpected server error occurred.",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            error_code="INTERNAL_SERVER_ERROR",
            path=request.url.path,
            developer_hint=developer_hint,
        )
