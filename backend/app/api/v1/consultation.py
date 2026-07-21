"""
Consultation router — endpoints for patient visits and checkups.
"""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db
from app.core.exceptions import PermissionDeniedError
from app.models.user import User, UserRole
from app.utils.response import ApiResponse
from app.schemas.consultation import ConsultationCreate, ConsultationOut
from app.services.consultation_service import ConsultationService
from app.services.patient_service import PatientService

router = APIRouter()


@router.post("/", response_class=JSONResponse, status_code=201)
async def create_consultation(
    request: ConsultationCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """
    Record a patient consultation.
    - Restricted to Doctors, Staff, or Admins.
    """
    if current_user.role not in [UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.PHARMACIST, UserRole.ADMIN]:
        raise PermissionDeniedError("Only doctors or staff can record consultations.")

    service = ConsultationService(db)
    consultation = await service.create_consultation(request)
    return ApiResponse.success(
        data=ConsultationOut.model_validate(consultation),
        message="Consultation recorded successfully.",
        status_code=201,
    )


@router.get("/", response_class=JSONResponse)
async def list_consultations(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    patient_id: uuid.UUID | None = Query(None),
    doctor_id: uuid.UUID | None = Query(None),
    branch_id: uuid.UUID | None = Query(None),
    appointment_id: uuid.UUID | None = Query(None),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """
    List consultations.
    - Patients are restricted to viewing only their own consultations.
    - Doctors are restricted to viewing only their own consultations.
    """
    service = ConsultationService(db)
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

    items, total = await service.list_consultations(
        page=page,
        limit=limit,
        patient_id=patient_id,
        doctor_id=doctor_id,
        branch_id=branch_id,
        appointment_id=appointment_id,
        start_date=start_date,
        end_date=end_date,
    )
    pages = (total + limit - 1) // limit

    return ApiResponse.success(
        data={
            "items": [ConsultationOut.model_validate(item) for item in items],
            "total": total,
            "page": page,
            "limit": limit,
            "pages": pages,
        },
        message="Consultations retrieved successfully.",
    )


@router.get("/{consultation_id}", response_class=JSONResponse)
async def get_consultation(
    consultation_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """
    Get detailed information about a specific consultation.
    - Patients can only view their own consultations.
    - Doctors can only view their own consultations.
    """
    service = ConsultationService(db)
    consultation = await service.get_consultation(consultation_id)

    # Apply RBAC checks
    if current_user.role == UserRole.PATIENT:
        patient_service = PatientService(db)
        patient = await patient_service.get_patient_by_user_id(current_user.id)
        if consultation.patient_id != patient.id:
            raise PermissionDeniedError("You cannot access this consultation record.")
    elif current_user.role == UserRole.DOCTOR:
        from app.services.doctor_service import DoctorService
        doctor_service = DoctorService(db)
        doctor = await doctor_service.get_doctor_by_user_id(current_user.id)
        if consultation.doctor_id != doctor.id:
            raise PermissionDeniedError("You cannot access this consultation record.")

    return ApiResponse.success(
        data=ConsultationOut.model_validate(consultation),
        message="Consultation details retrieved successfully.",
    )
