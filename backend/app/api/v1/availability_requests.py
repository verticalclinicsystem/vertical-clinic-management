"""
Availability change requests router — REST API endpoints for doctors to request scheduling adjustments and admins to manage approvals.
"""
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.rbac import UserRole, require_roles
from app.models.user import User
from app.schemas.availability_request import (
    AvailabilityChangeRequestCreate,
    AvailabilityChangeRequestOut,
    AvailabilityChangeRequestUpdate,
)
from app.services.availability_request_service import AvailabilityRequestService
from app.utils.response import ApiResponse

router = APIRouter()


# ── 1. POST /doctors/availability-requests/ ───────────────────────────────────
@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    summary="Submit a schedule change request",
)
async def create_availability_request(
    request: AvailabilityChangeRequestCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Submit a request to adjust lunch breaks, teleconsultation hours, leaves, or shift timings."""
    if current_user.role not in [UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.PHARMACIST]:
        from app.core.exceptions import PermissionDeniedError
        raise PermissionDeniedError("Only doctors, receptionists, and pharmacists can submit schedule change requests.")

    service = AvailabilityRequestService(db)
    req = await service.create_request(current_user.id, request)
    
    # Hydrate doctor name
    req.doctor_name = current_user.full_name

    return ApiResponse.success(
        data=AvailabilityChangeRequestOut.model_validate(req),
        message="Availability change request submitted successfully.",
        status_code=status.HTTP_201_CREATED,
    )


# ── 2. GET /doctors/availability-requests/ ────────────────────────────────────
@router.get(
    "/",
    summary="List schedule change requests",
)
async def list_availability_requests(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """List schedule change requests. Admins see all requests; staff see only their own."""
    if current_user.role not in [UserRole.ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.PHARMACIST]:
        from app.core.exceptions import PermissionDeniedError
        raise PermissionDeniedError("Access denied.")

    service = AvailabilityRequestService(db)
    reqs = await service.get_requests(current_user.id, current_user.role)
    
    return ApiResponse.success(
        data=[AvailabilityChangeRequestOut.model_validate(r) for r in reqs],
        message="Availability change requests retrieved successfully.",
    )


# ── 3. PUT /doctors/availability-requests/{id} ─────────────────────────────────
@router.put(
    "/{request_id}",
    summary="Approve or Reject a schedule change request (admin only)",
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
async def resolve_availability_request(
    request_id: UUID,
    request: AvailabilityChangeRequestUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Approve or Reject a doctor schedule change request, updating the doctor's operational settings and flagging conflicts."""
    service = AvailabilityRequestService(db)
    result = await service.update_request_status(request_id, request)
    
    return ApiResponse.success(
        data=result,
        message="Availability change request status updated successfully.",
    )
