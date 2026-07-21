"""
Receptionists router — REST API endpoints for receptionist profiles.
"""
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.rbac import UserRole, require_roles
from app.models.user import User
from app.schemas.receptionist import ReceptionistOut, ReceptionistUpdate, ReceptionistCreate
from app.services.receptionist_service import ReceptionistService, ReceptionistNotFoundError
from app.utils.response import ApiResponse

router = APIRouter()


# ── GET /receptionists/ ───────────────────────────────────────────────────────────
@router.get(
    "/",
    summary="List and search receptionists",
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.RECEPTIONIST))],
)
async def list_receptionists(
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, description="Search by receptionist name, email, or employee ID"),
    branch_id: UUID | None = Query(None, description="Filter receptionists by branch ID"),
) -> JSONResponse:
    """Get paginated, searchable, and branch-filtered list of receptionists."""
    service = ReceptionistService(db)
    items, total = await service.get_all_receptionists(
        page=page,
        limit=limit,
        search=search,
        branch_id=branch_id,
    )
    pages = (total + limit - 1) // limit

    return ApiResponse.success(
        data={
            "items": [ReceptionistOut.model_validate(item) for item in items],
            "total": total,
            "page": page,
            "limit": limit,
            "pages": pages,
        },
        message="Receptionists retrieved successfully.",
    )


# ── GET /receptionists/{recep_id} ────────────────────────────────────────────────
@router.get(
    "/{recep_id}",
    summary="Get receptionist profile details by ID",
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.RECEPTIONIST))],
)
async def get_receptionist_details(
    recep_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Fetch details of a single receptionist profile including user details."""
    service = ReceptionistService(db)
    try:
        receptionist = await service.get_receptionist(recep_id)
    except ReceptionistNotFoundError:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Receptionist profile not found.")
        
    return ApiResponse.success(
        data=ReceptionistOut.model_validate(receptionist),
        message="Receptionist profile details retrieved successfully.",
    )


# ── POST /receptionists/ ──────────────────────────────────────────────────────────
@router.post(
    "/",
    summary="Create receptionist profile",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
async def create_receptionist(
    request: ReceptionistCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Create receptionist profile linked to a User account."""
    service = ReceptionistService(db)
    receptionist = await service.create_receptionist_profile(request)
    return ApiResponse.success(
        data=ReceptionistOut.model_validate(receptionist),
        message="Receptionist profile created successfully.",
        status_code=status.HTTP_201_CREATED,
    )


# ── PUT /receptionists/{recep_id} ────────────────────────────────────────────────
@router.put(
    "/{recep_id}",
    summary="Update receptionist profile details",
)
async def update_receptionist(
    recep_id: UUID,
    request: ReceptionistUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """
    Update shift hours, branch, active status, etc.
    Admins can update any profile; receptionists can only update their own profile.
    """
    service = ReceptionistService(db)
    try:
        receptionist = await service.get_receptionist(recep_id)
    except ReceptionistNotFoundError:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Receptionist profile not found.")

    is_admin = current_user.role == UserRole.ADMIN
    is_owner = receptionist.user_id == current_user.id

    if not (is_admin or is_owner):
        from app.core.exceptions import PermissionDeniedError
        raise PermissionDeniedError("You do not have permission to update this receptionist profile.")

    updated = await service.update_receptionist_profile(recep_id, request)
    return ApiResponse.success(
        data=ReceptionistOut.model_validate(updated),
        message="Receptionist profile updated successfully.",
    )


# ── DELETE /receptionists/{recep_id} ─────────────────────────────────────────────
@router.delete(
    "/{recep_id}",
    summary="Deactivate receptionist profile",
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
async def delete_receptionist(
    recep_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Deactivate receptionist profile."""
    service = ReceptionistService(db)
    try:
        await service.delete_receptionist_profile(recep_id)
    except ReceptionistNotFoundError:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Receptionist profile not found.")

    return ApiResponse.success(
        message="Receptionist profile deactivated successfully.",
    )
