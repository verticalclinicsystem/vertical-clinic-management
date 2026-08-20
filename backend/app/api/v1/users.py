"""
Users router — /api/v1/users/*
Admin-only user management: list, create staff, update, deactivate.
"""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.rbac import UserRole, require_roles
from app.models.user import User
from app.schemas.auth import StaffCreateRequest, UserOut, UserUpdate, DoctorCreateRequest, ReceptionistCreateRequest, PharmacistCreateRequest, AdminCreateRequest, UserSuspendRequest
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

    old_role = user.role
    new_role = update_data.get("role")

    updated_user = await repo.update(user, update_data)

    # Sync name changes to role-specific tables if name was updated
    if "full_name" in update_data:
        from sqlalchemy import update as sqlalchemy_update
        from app.models.doctor import Doctor
        from app.models.receptionist import Receptionist
        from app.models.patient import Patient
        
        new_name = update_data["full_name"]
        if updated_user.role == "doctor":
            await db.execute(sqlalchemy_update(Doctor).where(Doctor.user_id == user_id).values(name=new_name))
        elif updated_user.role == "receptionist":
            await db.execute(sqlalchemy_update(Receptionist).where(Receptionist.user_id == user_id).values(name=new_name))
        elif updated_user.role == "patient":
            await db.execute(sqlalchemy_update(Patient).where(Patient.user_id == user_id).values(name=new_name))

    if new_role and old_role != new_role:
        from sqlalchemy import delete, select
        from app.models.doctor import Doctor, DoctorSlot
        from app.models.receptionist import Receptionist
        from app.models.patient import Patient
        from app.models.branch import Branch
        import json
        import uuid

        # 1. Clean up old role profiles
        if old_role == "doctor":
            await db.execute(delete(Doctor).where(Doctor.user_id == user_id))
        elif old_role == "receptionist":
            await db.execute(delete(Receptionist).where(Receptionist.user_id == user_id))
        elif old_role == "patient":
            await db.execute(delete(Patient).where(Patient.user_id == user_id))

        # 2. Create new role profiles
        if new_role == "doctor":
            doc_stmt = select(Doctor).where(Doctor.user_id == user_id)
            res_doc = await db.execute(doc_stmt)
            if not res_doc.scalar_one_or_none():
                branch_id = updated_user.branch_id
                if not branch_id:
                    branch_stmt = select(Branch)
                    res_branch = await db.execute(branch_stmt)
                    branch = res_branch.scalars().first()
                    branch_id = branch.id if branch else None

                default_meta = {
                    "lunch_start": "13:00",
                    "lunch_end": "14:00",
                    "tele_start": "15:00",
                    "tele_end": "17:00",
                    "leaves": []
                }
                
                doctor = Doctor(
                    id=uuid.uuid4(),
                    user_id=user_id,
                    name=updated_user.full_name,
                    branch_id=branch_id,
                    specialization="General Physician",
                    qualification="MBBS",
                    experience_years=5,
                    consultation_fee=500.0,
                    rating=4.8,
                    bio="Experienced physician specializing in general medicine and family healthcare.",
                    is_available=True,
                    availability_metadata=json.dumps(default_meta)
                )
                db.add(doctor)
                await db.flush()

                for w in range(6):  # Monday (0) to Saturday (5)
                    slot1 = DoctorSlot(
                        id=uuid.uuid4(),
                        doctor_id=doctor.id,
                        weekday=w,
                        start_time="09:00",
                        end_time="13:00",
                        slot_duration_minutes=30,
                        is_active=True
                    )
                    slot2 = DoctorSlot(
                        id=uuid.uuid4(),
                        doctor_id=doctor.id,
                        weekday=w,
                        start_time="14:00",
                        end_time="21:00",
                        slot_duration_minutes=30,
                        is_active=True
                    )
                    db.add_all([slot1, slot2])

                slot_sunday = DoctorSlot(
                    id=uuid.uuid4(),
                    doctor_id=doctor.id,
                    weekday=6,
                    start_time="09:00",
                    end_time="14:00",
                    slot_duration_minutes=30,
                    is_active=True
                )
                db.add(slot_sunday)

        elif new_role == "receptionist":
            rec_stmt = select(Receptionist).where(Receptionist.user_id == user_id)
            res_rec = await db.execute(rec_stmt)
            if not res_rec.scalar_one_or_none():
                branch_id = updated_user.branch_id
                if not branch_id:
                    branch_stmt = select(Branch)
                    res_branch = await db.execute(branch_stmt)
                    branch = res_branch.scalars().first()
                    branch_id = branch.id if branch else None

                employee_code = f"REC-{uuid.uuid4().hex[:6].upper()}"
                receptionist = Receptionist(
                    id=uuid.uuid4(),
                    user_id=user_id,
                    name=updated_user.full_name,
                    branch_id=branch_id,
                    employee_id=employee_code,
                    shift_start="09:00",
                    shift_end="17:00",
                    bio="Receptionist profile.",
                    is_active=True
                )
                db.add(receptionist)

        elif new_role == "patient":
            pat_stmt = select(Patient).where(Patient.user_id == user_id)
            res_pat = await db.execute(pat_stmt)
            if not res_pat.scalar_one_or_none():
                branch_id = updated_user.branch_id
                if not branch_id:
                    branch_stmt = select(Branch)
                    res_branch = await db.execute(branch_stmt)
                    branch = res_branch.scalars().first()
                    branch_id = branch.id if branch else None

                patient_code = f"PT-{uuid.uuid4().hex[:6].upper()}"
                patient = Patient(
                    id=uuid.uuid4(),
                    user_id=user_id,
                    name=updated_user.full_name,
                    patient_code=patient_code,
                    preferred_branch_id=branch_id,
                    is_active=True
                )
                db.add(patient)

    await db.commit()
    await db.refresh(updated_user)

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
    await db.commit()
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
    await db.commit()
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


# ── POST /users/me/avatar ───────────────────────────────────────────────────
from fastapi import File, UploadFile

@router.post(
    "/me/avatar",
    summary="Upload profile picture",
)
async def upload_user_avatar(
    request: Request,
    file: UploadFile = File(...),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> JSONResponse:
    """Upload user avatar image to configured storage and update user profile."""
    from app.services.storage_service import StorageService
    
    avatar_url = await StorageService.upload_avatar(file, user_id=str(current_user.id), request=request)
    
    repo = UserRepository(db)
    updated_user = await repo.update(current_user, {"avatar_url": avatar_url})
    await db.commit()
    
    return ApiResponse.success(
        data={"avatar_url": avatar_url, "user": UserOut.model_validate(updated_user)},
        message="Profile picture uploaded successfully."
    )


@router.delete(
    "/me/avatar",
    summary="Remove profile picture",
)
async def remove_user_avatar(
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> JSONResponse:
    """Remove user avatar image from storage and reset profile to default initials avatar."""
    from app.services.storage_service import StorageService
    
    # 1. Delete image file from storage
    await StorageService.delete_avatar(user_id=str(current_user.id))

    # 2. Reset avatar_url in Database
    repo = UserRepository(db)
    updated_user = await repo.update(current_user, {"avatar_url": None})
    await db.commit()
    return ApiResponse.success(
        data={"avatar_url": None, "user": UserOut.model_validate(updated_user)},
        message="Profile picture deleted and removed from profile."
    )

# ── POST /users/{user_id}/suspend ────────────────────────────────────────────
@router.post(
    "/{user_id}/suspend",
    summary="Suspend or unsuspend user temporarily (admin only)",
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
async def suspend_user(
    user_id: UUID,
    request: UserSuspendRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Temporarily suspend or unsuspend a user account."""
    if user_id == current_user.id:
        from app.core.exceptions import BadRequestError
        raise BadRequestError("You cannot suspend or unsuspend your own account")
    
    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        from app.core.exceptions import UserNotFoundError
        raise UserNotFoundError()
        
    if request.action == "unsuspend":
        updated_user = await repo.update(user, {
            "suspended_until": None,
            "suspension_reason": None
        })
        await db.commit()
        return ApiResponse.success(
            data=UserOut.model_validate(updated_user),
            message="User unsuspended successfully."
        )

    if request.duration_days is None:
        from app.core.exceptions import BadRequestError
        raise BadRequestError("duration_days is required to suspend a user")
        
    from datetime import datetime, timedelta, timezone
    suspended_until = datetime.now(timezone.utc) + timedelta(days=request.duration_days)
    
    updated_user = await repo.update(user, {
        "suspended_until": suspended_until,
        "suspension_reason": request.reason,
        "token_version": user.token_version + 1  # Force logout immediately
    })
    await db.commit()
    
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    suspended_until_ist = suspended_until.astimezone(ist_tz)
    formatted_time = suspended_until_ist.strftime("%d %b %Y, %I:%M %p")
    
    return ApiResponse.success(
        data=UserOut.model_validate(updated_user),
        message=f"User suspended successfully until {formatted_time} (IST)."
    )


# ── POST /users/me/revoke-sessions ───────────────────────────────────────────
@router.post(
    "/me/revoke-sessions",
    summary="Revoke all active sessions / logout other devices",
)
async def revoke_my_sessions(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Increment token version to revoke all current active tokens/sessions."""
    repo = UserRepository(db)
    updated_user = await repo.update(current_user, {
        "token_version": current_user.token_version + 1
    })
    await db.commit()
    return ApiResponse.success(
        data=UserOut.model_validate(updated_user),
        message="All sessions revoked successfully. Please log in again if needed."
    )


# ── POST /users/{user_id}/revoke-sessions ────────────────────────────────────
@router.post(
    "/{user_id}/revoke-sessions",
    summary="Force logout / revoke all sessions of a user (admin only)",
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
async def force_revoke_user_sessions(
    user_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Force logout any user by incrementing their token version."""
    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        from app.core.exceptions import UserNotFoundError
        raise UserNotFoundError()
        
    updated_user = await repo.update(user, {
        "token_version": user.token_version + 1
    })
    await db.commit()
    return ApiResponse.success(
        data=UserOut.model_validate(updated_user),
        message="User sessions revoked successfully."
    )

