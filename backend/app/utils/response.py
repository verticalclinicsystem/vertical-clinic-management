"""
Standardised API response helpers.

Usage:
    from app.utils.response import ApiResponse

    # Success — with data
    return ApiResponse.success(data=user, message="Login successful")

    # Success — no data
    return ApiResponse.success(message="OTP sent successfully")

    # Error (rarely needed directly; prefer raising ClinicAPIError subclasses)
    return ApiResponse.error(message="Something went wrong", status_code=400)

Response shapes
───────────────
Success:
    {
        "success": true,
        "message": "...",
        "data": { ... }          # omitted when None
    }

Error:
    {
        "success": false,
        "message": "..."
    }
"""
from __future__ import annotations

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
    ) -> JSONResponse:
        """
        Return a 2xx JSON response.

        Args:
            data:        The payload to include under the "data" key.
                         Pydantic models, ORM objects, dicts, lists are all accepted.
                         Defaults to None.
            message:     Human-readable success message.
            status_code: HTTP status code (default 200).
        """
        body: dict[str, Any] = {
            "success": True,
            "message": message,
            "data": jsonable_encoder(data) if data is not None else None,
        }

        return JSONResponse(status_code=status_code, content=body)

    @staticmethod
    def error(
        message: str = "An error occurred",
        status_code: int = 400,
        error_code: str | None = None,
    ) -> JSONResponse:
        """
        Return a 4xx/5xx JSON response.

        Args:
            message:     Human-readable error description.
            status_code: HTTP status code (default 400).
            error_code:  Optional machine-readable error code string.
        """
        body: dict[str, Any] = {
            "success": False,
            "message": message,
            "data": None,
        }
        if error_code:
            body["error_code"] = error_code

        return JSONResponse(status_code=status_code, content=body)
