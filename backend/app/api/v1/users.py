"""
Users router — /api/v1/users/*
Admin-only user management: list, create staff, update, deactivate.
"""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.rbac import UserRole, require_roles
from app.models.user import User
from app.schemas.auth import StaffCreateRequest, UserOut, UserUpdate, DoctorCreateRequest, ReceptionistCreateRequest, PharmacistCreateRequest, AdminCreateRequest
from app.services.auth_service import AuthService
from app.repositories.user_repo import UserRepository
from app.utils.response import ApiResponse

router = APIRouter()


# ── GET /users/ ───────────────────────────────────────────────────────────────
@router.get(
    "/",
    summary="List all users (admin only)",
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    role: str | None = Query(None, description="Filter by role"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
) -> JSONResponse:
    """Returns all system users, optionally filtered by role."""
    repo = UserRepository(db)
    if role:
        users = await repo.get_by_role(role)
        items = users[skip : skip + limit]
    else:
        items = await repo.get_all(skip=skip, limit=limit)
    
    return ApiResponse.success(
        data=[UserOut.model_validate(u) for u in items],
        message="Users retrieved successfully.",
    )


# ── POST /users/ ──────────────────────────────────────────────────────────────
@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    summary="Create staff user (admin only)",
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
async def create_staff_user(
    request: StaffCreateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Admin creates a staff account (doctor, receptionist, pharmacist, admin)."""
    service = AuthService(db)
    user = await service.create_staff_user(request, created_by_id=str(current_user.id))
    return ApiResponse.success(
        data=UserOut.model_validate(user),
        message="Staff user created successfully.",
        status_code=status.HTTP_201_CREATED,
    )


# ── POST /users/doctor ────────────────────────────────────────────────────────
@router.post(
    "/doctor",
    status_code=status.HTTP_201_CREATED,
    summary="Create doctor (admin only)",
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
async def create_doctor(
    request: DoctorCreateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Admin creates a doctor account and clinical profile."""
    service = AuthService(db)
    user = await service.create_doctor_user(request, created_by_id=str(current_user.id))
    return ApiResponse.success(
        data=UserOut.model_validate(user),
        message="Doctor created successfully.",
        status_code=status.HTTP_201_CREATED,
    )


# ── POST /users/receptionist ──────────────────────────────────────────────────
@router.post(
    "/receptionist",
    status_code=status.HTTP_201_CREATED,
    summary="Create receptionist (admin only)",
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
async def create_receptionist(
    request: ReceptionistCreateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Admin creates a receptionist account and shift schedule."""
    service = AuthService(db)
    user = await service.create_receptionist_user(request, created_by_id=str(current_user.id))
    return ApiResponse.success(
        data=UserOut.model_validate(user),
        message="Receptionist created successfully.",
        status_code=status.HTTP_201_CREATED,
    )


# ── POST /users/pharmacist ────────────────────────────────────────────────────
@router.post(
    "/pharmacist",
    status_code=status.HTTP_201_CREATED,
    summary="Create pharmacist (admin only)",
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
async def create_pharmacist(
    request: PharmacistCreateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Admin creates a pharmacist account."""
    service = AuthService(db)
    user = await service.create_pharmacist_user(request, created_by_id=str(current_user.id))
    return ApiResponse.success(
        data=UserOut.model_validate(user),
        message="Pharmacist created successfully.",
        status_code=status.HTTP_201_CREATED,
    )


# ── POST /users/admin ─────────────────────────────────────────────────────────
@router.post(
    "/admin",
    status_code=status.HTTP_201_CREATED,
    summary="Create admin (admin only)",
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
async def create_admin(
    request: AdminCreateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Admin creates another admin account."""
    service = AuthService(db)
    user = await service.create_admin_user(request, created_by_id=str(current_user.id))
    return ApiResponse.success(
        data=UserOut.model_validate(user),
        message="Admin created successfully.",
        status_code=status.HTTP_201_CREATED,
    )


# ── GET /users/{user_id} ──────────────────────────────────────────────────────
@router.get(
    "/{user_id}",
    summary="Get user by ID",
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
async def get_user(
    user_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Fetch any user record by UUID."""
    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        from app.core.exceptions import UserNotFoundError
        raise UserNotFoundError()
    return ApiResponse.success(
        data=UserOut.model_validate(user),
        message="User retrieved successfully.",
    )


# ── PUT /users/{user_id} ──────────────────────────────────────────────────────
@router.put(
    "/{user_id}",
    summary="Update user (admin only)",
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
async def update_user(
    user_id: UUID,
    request: UserUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Update a user's profile fields or status."""
    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        from app.core.exceptions import UserNotFoundError
        raise UserNotFoundError()

    update_data = request.model_dump(exclude_none=True)
    if "password" in update_data and update_data["password"]:
        from app.core.security import hash_password
        update_data["hashed_password"] = hash_password(update_data.pop("password"))
    elif "password" in update_data:
        update_data.pop("password")

    updated_user = await repo.update(user, update_data)
    return ApiResponse.success(
        data=UserOut.model_validate(updated_user),
        message="User updated successfully.",
    )


# ── POST /users/{user_id}/deactivate ─────────────────────────────────────────
@router.post(
    "/{user_id}/deactivate",
    summary="Deactivate user (admin only)",
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
async def deactivate_user(
    user_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Soft-deactivate a user account (blocks login, preserves data)."""
    if user_id == current_user.id:
        from app.core.exceptions import BadRequestError
        raise BadRequestError("You cannot deactivate your own account")
    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        from app.core.exceptions import UserNotFoundError
        raise UserNotFoundError()
    updated_user = await repo.update(user, {"is_active": False})
    return ApiResponse.success(
        data=UserOut.model_validate(updated_user),
        message="User deactivated successfully.",
    )


# ── POST /users/{user_id}/activate ───────────────────────────────────────────
@router.post(
    "/{user_id}/activate",
    summary="Re-activate user (admin only)",
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
async def activate_user(
    user_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Re-activate a previously deactivated user account."""
    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        from app.core.exceptions import UserNotFoundError
        raise UserNotFoundError()
    updated_user = await repo.update(user, {"is_active": True})
    return ApiResponse.success(
        data=UserOut.model_validate(updated_user),
        message="User activated successfully.",
    )


@router.delete(
    "/{user_id}",
    summary="Delete user (admin only)",
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
async def delete_user(
    user_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Delete a user account and cascade delete related records."""
    if user_id == current_user.id:
        from app.core.exceptions import BadRequestError
        raise BadRequestError("You cannot delete your own account")
    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        from app.core.exceptions import UserNotFoundError
        raise UserNotFoundError()
    
    from sqlalchemy import update
    from app.models.inventory import StockTransaction
    await db.execute(
        update(StockTransaction)
        .where(StockTransaction.performed_by_id == user_id)
        .values(performed_by_id=None)
    )
    
    await repo.delete(user)
    await db.commit()
    return ApiResponse.success(
        data=None,
        message="User deleted successfully."
    )

