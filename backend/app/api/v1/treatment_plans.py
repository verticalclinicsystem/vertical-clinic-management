"""
Treatment Plans router — endpoints for patient treatment plans and procedures.
"""
import uuid
from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db
from app.core.exceptions import PermissionDeniedError
from app.models.user import User, UserRole
from app.utils.response import ApiResponse
from app.schemas.treatment import TreatmentPlanCreate, TreatmentPlanOut, TreatmentPlanUpdate
from app.services.treatment_service import TreatmentService
from app.services.patient_service import PatientService

router = APIRouter()



@router.post("/", response_class=JSONResponse, status_code=201)
async def create_treatment_plan(
    request: TreatmentPlanCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """
    Create a new treatment plan for a patient.
    - Restricted to Doctors, Staff, or Admins.
    """
    if current_user.role not in [UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.PHARMACIST, UserRole.ADMIN]:
        raise PermissionDeniedError("Only doctors or staff can create treatment plans.")

    service = TreatmentService(db)
    plan = await service.create_treatment_plan(request)
    return ApiResponse.success(
        data=TreatmentPlanOut.model_validate(plan),
        message="Treatment plan created successfully.",
        status_code=201,
    )


@router.get("/", response_class=JSONResponse)
async def list_treatment_plans(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    patient_id: uuid.UUID | None = Query(None),
    doctor_id: uuid.UUID | None = Query(None),
    status: str | None = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """
    List treatment plans.
    - Patients are restricted to viewing only their own treatment plans.
    - Doctors are restricted to viewing only their own treatment plans.
    """
    service = TreatmentService(db)
    patient_service = PatientService(db)

    # Apply RBAC restrictions
    if current_user.role == UserRole.PATIENT:
        patient = await patient_service.get_patient_by_user_id(current_user.id)
        patient_id = patient.id
    elif current_user.role == UserRole.DOCTOR:
        from app.services.doctor_service import DoctorService
        doctor_service = DoctorService(db)
        doctor = await doctor_service.get_doctor_by_user_id(current_user.id)
        doctor_id = doctor.id

    items, total = await service.list_treatment_plans(
        page=page,
        limit=limit,
        patient_id=patient_id,
        doctor_id=doctor_id,
        status=status,
    )
    pages = (total + limit - 1) // limit

    return ApiResponse.success(
        data={
            "items": [TreatmentPlanOut.model_validate(item) for item in items],
            "total": total,
            "page": page,
            "limit": limit,
            "pages": pages,
        },
        message="Treatment plans retrieved successfully.",
    )


@router.get("/{plan_id}", response_class=JSONResponse)
async def get_treatment_plan(
    plan_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """
    Get detailed information about a specific treatment plan.
    - Patients can only view their own treatment plans.
    - Doctors can only view their own treatment plans.
    """
    service = TreatmentService(db)
    plan = await service.get_treatment_plan(plan_id)

    # Apply RBAC checks
    if current_user.role == UserRole.PATIENT:
        patient_service = PatientService(db)
        patient = await patient_service.get_patient_by_user_id(current_user.id)
        if plan.patient_id != patient.id:
            raise PermissionDeniedError("You cannot access this treatment plan.")
    elif current_user.role == UserRole.DOCTOR:
        from app.services.doctor_service import DoctorService
        doctor_service = DoctorService(db)
        doctor = await doctor_service.get_doctor_by_user_id(current_user.id)
        if plan.doctor_id != doctor.id:
            raise PermissionDeniedError("You cannot access this treatment plan.")

    return ApiResponse.success(
        data=TreatmentPlanOut.model_validate(plan),
        message="Treatment plan details retrieved successfully.",
    )


@router.put("/{plan_id}", response_class=JSONResponse)
async def update_treatment_plan(
    plan_id: uuid.UUID,
    request: TreatmentPlanUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """
    Update a treatment plan (restricted to doctors/staff/admin).
    """
    if current_user.role not in [UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.PHARMACIST, UserRole.ADMIN]:
        raise PermissionDeniedError("Only doctors or staff can update treatment plans.")

    service = TreatmentService(db)
    # Re-verify doctor is the one who created it (if the current user is a doctor)
    if current_user.role == UserRole.DOCTOR:
        from app.services.doctor_service import DoctorService
        doctor_service = DoctorService(db)
        doctor = await doctor_service.get_doctor_by_user_id(current_user.id)
        plan = await service.get_treatment_plan(plan_id)
        if plan.doctor_id != doctor.id:
            raise PermissionDeniedError("You cannot update this treatment plan.")

    updated_plan = await service.update_treatment_plan(plan_id, request)
    return ApiResponse.success(
        data=TreatmentPlanOut.model_validate(updated_plan),
        message="Treatment plan updated successfully.",
    )

