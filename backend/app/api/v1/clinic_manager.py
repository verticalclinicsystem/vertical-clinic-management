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
    """
    **Operational Dashboard Metrics Endpoint**

    * **🔐 Allowed Roles:** `CLINIC_MANAGER`, `ADMIN`
    * **📥 Parameters:** `branch_id` (Optional UUID) — Filter metrics for a specific clinic branch. Defaults to logged-in user's assigned branch.
    * **📤 Return Response Data:**
      - `appointments_today`: Count of total scheduled visits for today.
      - `active_doctors`: Count of doctors currently on duty.
      - `patient_queue`: List of patients in Waiting / In-Consultation queue.
      - `pending_approvals`: Count of pending schedule and billing approval requests.
    """
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
    """
    **Doctor Onboarding Endpoint**

    * **🔐 Allowed Roles:** `CLINIC_MANAGER`, `ADMIN`
    * **📤 Return Response Data:**
      - `doctor_id`: Generated UUID of the newly created doctor.
      - `email`: Registered doctor email.
      - `full_name`: Full name of doctor.
      - `status`: Account status (`active`).
    """
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
    """
    **Receptionist Onboarding Endpoint**

    * **🔐 Allowed Roles:** `CLINIC_MANAGER`, `ADMIN`
    * **📤 Return Response Data:** Created user profile details.
    """
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
    """
    **Branch Staff Listing Endpoint**

    * **🔐 Allowed Roles:** `CLINIC_MANAGER`, `ADMIN`
    * **📤 Return Response Data:** Lists of doctors, receptionists, and pharmacists registered under the specified branch.
    """
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
    """
    **Schedule Requests Endpoint**

    * **🔐 Allowed Roles:** `CLINIC_MANAGER`, `ADMIN`
    * **📤 Return Response Data:** Pending/Approved doctor leave and schedule modification requests.
    """
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


# ── Additional Manager Schemas ────────────────────────────────────────────────

class PharmacistOnboardRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str
    phone: Optional[str] = None
    branch_id: Optional[uuid.UUID] = None
    employee_code: Optional[str] = None


class StaffEditRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    consultation_fee: Optional[float] = None
    specialization: Optional[str] = None
    shift_timing: Optional[str] = None
    password: Optional[str] = Field(None, min_length=6)


class DoctorEmergencyBlockRequest(BaseModel):
    leave_date: str = Field(..., example="2026-08-06")
    target_reschedule_date: Optional[str] = Field(None, example="2026-08-07")


class BillingReviewRequest(BaseModel):
    action: str = Field(..., pattern="^(approve|reject)$")
    reason_notes: Optional[str] = None


class AnnouncementRequest(BaseModel):
    title: str = Field(..., min_length=3)
    message: str = Field(..., min_length=5)
    target_role: str = Field("all", pattern="^(all|doctor|receptionist|pharmacist)$")


# ── Additional Endpoints ──────────────────────────────────────────────────────

@router.post(
    "/pharmacists",
    status_code=status.HTTP_201_CREATED,
    summary="Onboard a new Pharmacist user profile",
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.CLINIC_MANAGER))],
)
async def onboard_pharmacist(
    req: PharmacistOnboardRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Onboard Pharmacist."""
    branch = req.branch_id or current_user.branch_id
    service = ClinicManagerService(db)
    return await service.onboard_pharmacist(
        email=req.email,
        password=req.password,
        full_name=req.full_name,
        phone=req.phone,
        branch_id=branch,
        employee_code=req.employee_code,
    )


@router.patch(
    "/staff/{user_id}",
    summary="Edit staff member details and active status",
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.CLINIC_MANAGER))],
)
async def edit_staff_member(
    user_id: uuid.UUID,
    req: StaffEditRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Edit staff user."""
    service = ClinicManagerService(db)
    return await service.edit_staff_member(
        user_id=user_id,
        full_name=req.full_name,
        phone=req.phone,
        is_active=req.is_active,
        consultation_fee=req.consultation_fee,
        specialization=req.specialization,
        shift_timing=req.shift_timing,
        password=req.password,
    )


@router.post(
    "/doctors/{doctor_id}/emergency-block",
    summary="Freeze doctor schedule & bulk-reschedule impacted appointments",
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.CLINIC_MANAGER))],
)
async def emergency_doctor_block(
    doctor_id: uuid.UUID,
    req: DoctorEmergencyBlockRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Emergency doctor block and smart bulk reschedule engine."""
    service = ClinicManagerService(db)
    return await service.emergency_doctor_block(
        doctor_id=doctor_id,
        leave_date_str=req.leave_date,
        target_reschedule_date_str=req.target_reschedule_date,
    )


@router.get(
    "/billing-requests",
    summary="Get invoices requiring manager discount/refund approval",
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.CLINIC_MANAGER))],
)
async def get_billing_requests(
    branch_id: Optional[uuid.UUID] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """List billing approval requests."""
    target_branch = branch_id or current_user.branch_id
    service = ClinicManagerService(db)
    return await service.get_billing_requests(branch_id=target_branch)


@router.post(
    "/billing-requests/{invoice_id}/review",
    summary="Approve or reject discount/refund request",
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.CLINIC_MANAGER))],
)
async def review_billing_request(
    invoice_id: uuid.UUID,
    req: BillingReviewRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Review billing request."""
    service = ClinicManagerService(db)
    return await service.review_billing_request(
        invoice_id=invoice_id,
        action=req.action,
        reason_notes=req.reason_notes,
    )


@router.post(
    "/announcements",
    summary="Broadcast internal staff notice/announcement",
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.CLINIC_MANAGER))],
)
async def create_announcement(
    req: AnnouncementRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Broadcast announcement."""
    service = ClinicManagerService(db)
    return await service.create_announcement(
        title=req.title,
        message=req.message,
        target_role=req.target_role,
        branch_id=current_user.branch_id,
    )


@router.get(
    "/analytics",
    summary="Get operational and financial analytics metrics",
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.CLINIC_MANAGER))],
)
async def get_analytics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Get monthly revenue, bed occupancy, and low stock medicine metrics."""
    service = ClinicManagerService(db)
    return await service.get_analytics_dashboard(branch_id=current_user.branch_id)


