"""
Standardized API response helpers.

Usage:
    from app.utils.response import ApiResponse

    # Success — with data
    return ApiResponse.success(data=user, message="Login successful")

    # Success — paginated
    return ApiResponse.paginated(items=users, total=100, page=1, limit=20)

    # Error
    return ApiResponse.error(message="Something went wrong", status_code=400)
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse


class ApiResponse:
    """Factory for consistent success / error JSON responses."""

    @staticmethod
    def success(
        data: Any = None,
        message: str = "Request successful",
        status_code: int = 200,
        meta: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> JSONResponse:
        """
        Return a 2xx JSON response.

        Args:
            data:        The payload to include under the "data" key.
                         Pydantic models, ORM objects, dicts, lists are all accepted.
                         Defaults to None.
            message:     Human-readable success message.
            status_code: HTTP status code (default 200).
            meta:        Optional metadata dictionary (e.g. pagination or summary info).
            headers:     Optional HTTP headers dict.
        """
        body: dict[str, Any] = {
            "success": True,
            "message": message,
            "data": jsonable_encoder(data) if data is not None else None,
        }
        if meta is not None:
            body["meta"] = jsonable_encoder(meta)

        return JSONResponse(status_code=status_code, content=body, headers=headers)

    @staticmethod
    def paginated(
        items: Any,
        total: int,
        page: int,
        limit: int,
        message: str = "Request successful",
        status_code: int = 200,
        headers: dict[str, str] | None = None,
    ) -> JSONResponse:
        """
        Return a paginated 2xx JSON response with standard pagination metadata.

        Args:
            items:       List of items for the current page.
            total:       Total items count across all pages.
            page:        Current page number (1-indexed).
            limit:       Page size limit.
            message:     Human-readable success message.
            status_code: HTTP status code (default 200).
            headers:     Optional HTTP headers dict.
        """
        pages = (total + limit - 1) // limit if limit > 0 else 0
        pagination_meta = {
            "total": total,
            "page": page,
            "limit": limit,
            "pages": pages,
        }
        return ApiResponse.success(
            data=items,
            message=message,
            status_code=status_code,
            meta={"pagination": pagination_meta},
            headers=headers,
        )

    @staticmethod
    def error(
        message: str = "An error occurred",
        status_code: int = 400,
        error_code: str | None = None,
        details: Any = None,
        path: str | None = None,
        developer_hint: str | None = None,
        headers: dict[str, str] | None = None,
    ) -> JSONResponse:
        """
        Return a 4xx/5xx JSON response.

        Args:
            message:        Human-readable error description.
            status_code:    HTTP status code (default 400).
            error_code:     Optional machine-readable error code string (e.g. "VALIDATION_ERROR").
            details:        Structured details or list of field error objects.
            path:           Request path where the error occurred.
            developer_hint: Debugging hint (active in non-production environments).
            headers:        Optional HTTP response headers.
        """
        body: dict[str, Any] = {
            "success": False,
            "message": message,
            "data": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if error_code:
            body["error_code"] = error_code
        if path:
            body["path"] = path
        if details is not None:
            body["details"] = jsonable_encoder(details)
        if developer_hint:
            body["developer_hint"] = developer_hint

        return JSONResponse(status_code=status_code, content=body, headers=headers)
