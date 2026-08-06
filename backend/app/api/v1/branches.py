"""
Branches router — REST API endpoints for clinic branch management.
"""
from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.rbac import UserRole, require_roles
from app.schemas.auth import UserOut
from app.schemas.branch import (
    BranchCreate,
    BranchDashboardResponse,
    BranchListResponse,
    BranchOut,
    BranchUpdate,
)
from app.schemas.doctor import DoctorOut
from app.schemas.patient import PatientOut
from app.services.branch_service import BranchService
from app.utils.response import ApiResponse

router = APIRouter()


# ── 1. POST /branches ─────────────────────────────────────────────────────────
@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    summary="Create a new branch (admin only)",
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
async def create_branch(
    request: BranchCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Create a new branch with a unique code."""
    service = BranchService(db)
    branch = await service.create_branch(request)
    return ApiResponse.success(
        data=BranchOut.model_validate(branch),
        message="Branch created successfully.",
        status_code=status.HTTP_201_CREATED,
    )


# ── 2. GET /branches ──────────────────────────────────────────────────────────
@router.get(
    "/",
    summary="List branches (public)",
)
async def list_branches(
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: str | None = Query(None, description="Search by name, code, city, address"),
    is_active: bool | None = Query(None, description="Filter by active status"),
) -> JSONResponse:
    """Get paginated, searchable, and filtered list of clinic branches."""
    service = BranchService(db)
    items, total = await service.get_all_branches(
        page=page,
        limit=limit,
        search=search,
        is_active=is_active,
    )
    pages = (total + limit - 1) // limit

    response_data = BranchListResponse(
        items=[BranchOut.model_validate(item) for item in items],
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )

    return ApiResponse.success(
        data=response_data.model_dump(),
        message="Branches retrieved successfully.",
    )


# ── GET /branches/public-stats ────────────────────────────────────────────────
@router.get(
    "/public-stats",
    summary="Get public clinic statistics (public)",
)
async def get_public_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Get real-time count of active branches, total registered patients, and branch names."""
    from sqlalchemy import select, func
    from app.models.branch import Branch
    from app.models.patient import Patient
    from app.models.appointment import Appointment

    branches_res = await db.execute(select(Branch).where(Branch.is_active == True))
    branches = branches_res.scalars().all()
    branch_names = [b.name for b in branches]

    patients_count_res = await db.execute(select(func.count(Patient.id)))
    total_patients = patients_count_res.scalar() or 0

    appt_count_res = await db.execute(select(func.count(Appointment.id)))
    total_appts = appt_count_res.scalar() or 0

    return ApiResponse.success(
        data={
            "active_branches_count": len(branches),
            "branch_names": branch_names,
            "total_patients": total_patients,
            "total_appointments": total_appts,
        },
        message="Public stats retrieved successfully.",
    )


# ── 3. GET /branches/{branch_id} ──────────────────────────────────────────────
@router.get(
    "/{branch_id}",
    summary="Get branch details (public)",
)
async def get_branch_details(
    branch_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Fetch profile details of a single branch by UUID."""
    service = BranchService(db)
    branch = await service.get_branch(branch_id)
    return ApiResponse.success(
        data=BranchOut.model_validate(branch),
        message="Branch details retrieved successfully.",
    )


# ── 4. PUT /branches/{branch_id} ──────────────────────────────────────────────
@router.put(
    "/{branch_id}",
    summary="Update branch (admin only)",
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
async def update_branch(
    branch_id: UUID,
    request: BranchUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Update details of a branch. Code must remain unique."""
    service = BranchService(db)
    branch = await service.update_branch(branch_id, request)
    return ApiResponse.success(
        data=BranchOut.model_validate(branch),
        message="Branch updated successfully.",
    )


# ── 5. DELETE /branches/{branch_id} ───────────────────────────────────────────
@router.delete(
    "/{branch_id}",
    summary="Delete branch - soft delete (admin only)",
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
async def delete_branch(
    branch_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Soft delete a branch by deactivating it."""
    service = BranchService(db)
    branch = await service.delete_branch(branch_id)
    return ApiResponse.success(
        data=BranchOut.model_validate(branch),
        message="Branch soft deleted successfully.",
    )


# ── 6. PATCH /branches/{branch_id}/activate ──────────────────────────────────
@router.patch(
    "/{branch_id}/activate",
    summary="Activate branch (admin only)",
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
async def activate_branch(
    branch_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Re-activate a deactivated branch."""
    service = BranchService(db)
    branch = await service.activate_branch(branch_id)
    return ApiResponse.success(
        data=BranchOut.model_validate(branch),
        message="Branch activated successfully.",
    )


# ── 7. PATCH /branches/{branch_id}/deactivate ────────────────────────────────
@router.patch(
    "/{branch_id}/deactivate",
    summary="Deactivate branch (admin only)",
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
async def deactivate_branch(
    branch_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Deactivate a branch."""
    service = BranchService(db)
    branch = await service.deactivate_branch(branch_id)
    return ApiResponse.success(
        data=BranchOut.model_validate(branch),
        message="Branch deactivated successfully.",
    )


# ── 8. GET /branches/{branch_id}/dashboard ────────────────────────────────────
@router.get(
    "/{branch_id}/dashboard",
    summary="Get branch dashboard statistics",
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.PHARMACIST))],
)
async def get_branch_dashboard(
    branch_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Get high-level stats dashboard for a specific branch."""
    service = BranchService(db)
    dashboard_data = await service.get_branch_dashboard(branch_id)
    return ApiResponse.success(
        data=BranchDashboardResponse(**dashboard_data).model_dump(),
        message="Branch dashboard stats retrieved successfully.",
    )


# ── 9. GET /branches/{branch_id}/staff ────────────────────────────────────────
@router.get(
    "/{branch_id}/staff",
    summary="Get branch staff list (admin only)",
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
async def get_branch_staff(
    branch_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Fetch all clinic staff users (excl. patients) assigned to this branch."""
    service = BranchService(db)
    staff = await service.get_branch_staff(branch_id)
    return ApiResponse.success(
        data=[UserOut.model_validate(member) for member in staff],
        message="Branch staff retrieved successfully.",
    )


# ── 10. GET /branches/{branch_id}/doctors ─────────────────────────────────────
@router.get(
    "/{branch_id}/doctors",
    summary="Get branch doctors list (public)",
)
async def get_branch_doctors(
    branch_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Fetch all doctors practicing at this branch (includes user details)."""
    service = BranchService(db)
    doctors = await service.get_branch_doctors(branch_id)
    return ApiResponse.success(
        data=[DoctorOut.model_validate(doc) for doc in doctors],
        message="Branch doctors retrieved successfully.",
    )


# ── 11. GET /branches/{branch_id}/patients ────────────────────────────────────
@router.get(
    "/{branch_id}/patients",
    summary="Get branch patients list",
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST))],
)
async def get_branch_patients(
    branch_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Fetch all patients whose preferred branch matches this branch ID."""
    service = BranchService(db)
    patients = await service.get_branch_patients(branch_id)
    return ApiResponse.success(
        data=[PatientOut.model_validate(p) for p in patients],
        message="Branch patients retrieved successfully.",
    )


# ── 12. GET /branches/{branch_id}/appointments ────────────────────────────────
@router.get(
    "/{branch_id}/appointments",
    summary="Get branch appointments list",
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST))],
)
async def get_branch_appointments(
    branch_id: UUID,
    current_user: Annotated[Any, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Fetch all appointments scheduled at this branch."""
    service = BranchService(db)
    appointments = await service.get_branch_appointments(branch_id)
    
    from app.schemas.appointment import AppointmentOut
    out_items = []
    for appt in appointments:
        out = AppointmentOut.model_validate(appt)
        out.map_status_for_role(current_user.role)
        out_items.append(out.model_dump())
        
    return ApiResponse.success(
        data=out_items,
        message="Branch appointments retrieved successfully.",
    )
