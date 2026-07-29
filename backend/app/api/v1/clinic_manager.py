"""
Clinic Manager API Router — dedicated endpoints for clinic branch operations,
staff onboarding (Doctors & Receptionists), and schedule approvals.
"""
import uuid
from typing import Any, Optional
from pydantic import BaseModel, EmailStr, Field

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.core.rbac import require_roles, UserRole
from app.models.user import User
from app.services.clinic_manager_service import ClinicManagerService

router = APIRouter()

# ── Pydantic Request Schemas ──────────────────────────────────────────────────

class DoctorOnboardRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str
    phone: Optional[str] = None
    branch_id: Optional[uuid.UUID] = None
    specialization: str = "General Dentistry"
    qualification: str = "BDS"
    experience_years: int = 5
    consultation_fee: float = 500.0
    registration_number: Optional[str] = None
    tele_start: str = "15:00"
    tele_end: str = "17:00"
    lunch_start: str = "13:00"
    lunch_end: str = "14:00"


class ReceptionistOnboardRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str
    phone: Optional[str] = None
    branch_id: Optional[uuid.UUID] = None
    employee_code: Optional[str] = None
    shift_timing: str = "Morning Shift (09:00 - 17:00)"


class ScheduleReviewRequest(BaseModel):
    action: str = Field(..., pattern="^(approve|reject)$")
    response_notes: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get(
    "/dashboard-overview",
    summary="Get operational non-financial dashboard metrics",
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.CLINIC_MANAGER))],
)
async def get_dashboard_overview(
    branch_id: Optional[uuid.UUID] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Return operational stats (appointments today, active doctors, waiting queue)."""
    target_branch = branch_id or current_user.branch_id
    service = ClinicManagerService(db)
    return await service.get_operational_dashboard(branch_id=target_branch)


@router.post(
    "/doctors",
    status_code=status.HTTP_201_CREATED,
    summary="Onboard a new Doctor profile & setup initial schedule",
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.CLINIC_MANAGER))],
)
async def onboard_doctor(
    req: DoctorOnboardRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Create a new Doctor user, profile, and default schedule slots."""
    branch = req.branch_id or current_user.branch_id
    service = ClinicManagerService(db)
    return await service.onboard_doctor(
        email=req.email,
        password=req.password,
        full_name=req.full_name,
        phone=req.phone,
        branch_id=branch,
        specialization=req.specialization,
        qualification=req.qualification,
        experience_years=req.experience_years,
        consultation_fee=req.consultation_fee,
        registration_number=req.registration_number,
        tele_start=req.tele_start,
        tele_end=req.tele_end,
        lunch_start=req.lunch_start,
        lunch_end=req.lunch_end,
    )


@router.post(
    "/receptionists",
    status_code=status.HTTP_201_CREATED,
    summary="Onboard a new Receptionist profile",
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.CLINIC_MANAGER))],
)
async def onboard_receptionist(
    req: ReceptionistOnboardRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Create a new Receptionist user & profile."""
    branch = req.branch_id or current_user.branch_id
    service = ClinicManagerService(db)
    return await service.onboard_receptionist(
        email=req.email,
        password=req.password,
        full_name=req.full_name,
        phone=req.phone,
        branch_id=branch,
        employee_code=req.employee_code,
        shift_timing=req.shift_timing,
    )


@router.get(
    "/staff",
    summary="Get all doctors and receptionists for a branch",
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.CLINIC_MANAGER))],
)
async def get_branch_staff(
    branch_id: Optional[uuid.UUID] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """List branch staff."""
    target_branch = branch_id or current_user.branch_id
    service = ClinicManagerService(db)
    return await service.get_branch_staff(branch_id=target_branch)


@router.get(
    "/schedule-requests",
    summary="List doctor availability & leave change requests",
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.CLINIC_MANAGER))],
)
async def get_schedule_requests(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """List schedule change requests."""
    service = ClinicManagerService(db)
    return await service.get_schedule_requests(status=status_filter)


@router.post(
    "/schedule-requests/{request_id}/review",
    summary="Approve or reject doctor schedule/leave request",
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.CLINIC_MANAGER))],
)
async def review_schedule_request(
    request_id: uuid.UUID,
    req: ScheduleReviewRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Review schedule request."""
    service = ClinicManagerService(db)
    return await service.review_schedule_request(
        request_id=request_id,
        action=req.action,
        response_notes=req.response_notes,
    )
