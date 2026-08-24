"""
Prescriptions router — endpoints for patient prescriptions.
"""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db
from app.core.exceptions import PermissionDeniedError
from app.models.user import User, UserRole
from app.schemas.prescription import PrescriptionCreate, PrescriptionOut, PrescriptionUpdate
from app.services.doctor_service import DoctorService
from app.services.patient_service import PatientService
from app.services.prescription_service import PrescriptionService
from app.utils.pdf_generator import generate_prescription_pdf
from app.utils.response import ApiResponse

router = APIRouter()


@router.post("/", response_class=JSONResponse, status_code=201)
async def create_prescription(
    request: PrescriptionCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """
    Create a new prescription for a patient.
    - Restricted to Doctors, Staff, or Admins.
    """
    if current_user.role not in [UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.PHARMACIST, UserRole.ADMIN]:
        raise PermissionDeniedError("Only doctors or staff can create prescriptions.")

    service = PrescriptionService(db)
    prescription = await service.create_prescription(request)
    return ApiResponse.success(
        data=PrescriptionOut.model_validate(prescription),
        message="Prescription created successfully.",
        status_code=201,
    )


@router.get("/", response_class=JSONResponse)
async def list_prescriptions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    patient_id: uuid.UUID | None = Query(None),
    doctor_id: uuid.UUID | None = Query(None),
    consultation_id: uuid.UUID | None = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """
    List prescriptions.
    - Patients are restricted to viewing only their own prescriptions.
    - Doctors are restricted to viewing only their own prescriptions.
    """
    service = PrescriptionService(db)
    patient_service = PatientService(db)

    # Apply RBAC restrictions
    if current_user.role == UserRole.PATIENT:
        patient = await patient_service.get_patient_by_user_id(current_user.id)
        patient_id = patient.id
    elif current_user.role == UserRole.DOCTOR:
        doctor_service = DoctorService(db)
        doctor = await doctor_service.get_doctor_by_user_id(current_user.id)
        doctor_id = doctor.id

    items, total = await service.list_prescriptions(
        page=page,
        limit=limit,
        patient_id=patient_id,
        doctor_id=doctor_id,
        consultation_id=consultation_id,
    )
    pages = (total + limit - 1) // limit

    return ApiResponse.success(
        data={
            "items": [PrescriptionOut.model_validate(item) for item in items],
            "total": total,
            "page": page,
            "limit": limit,
            "pages": pages,
        },
        message="Prescriptions retrieved successfully.",
    )


@router.get("/{prescription_id}", response_class=JSONResponse)
async def get_prescription(
    prescription_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """
    Get detailed information about a specific prescription.
    - Patients can only view their own prescriptions.
    - Doctors can only view their own prescriptions.
    """
    service = PrescriptionService(db)
    prescription = await service.get_prescription(prescription_id)

    # Apply RBAC checks
    if current_user.role == UserRole.PATIENT:
        patient_service = PatientService(db)
        patient = await patient_service.get_patient_by_user_id(current_user.id)
        if prescription.patient_id != patient.id:
            raise PermissionDeniedError("You cannot access this prescription.")
    elif current_user.role == UserRole.DOCTOR:
        doctor_service = DoctorService(db)
        doctor = await doctor_service.get_doctor_by_user_id(current_user.id)
        if prescription.doctor_id != doctor.id:
            raise PermissionDeniedError("You cannot access this prescription.")

    return ApiResponse.success(
        data=PrescriptionOut.model_validate(prescription),
        message="Prescription details retrieved successfully.",
    )


@router.get("/{prescription_id}/pdf", response_class=Response)
async def get_prescription_pdf(
    prescription_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """
    Generate and download the prescription PDF.
    - Patients can only download their own prescriptions.
    - Doctors can only download their own prescriptions.
    """
    service = PrescriptionService(db)
    prescription = await service.get_prescription(prescription_id)

    # Apply RBAC checks
    if current_user.role == UserRole.PATIENT:
        patient_service = PatientService(db)
        patient = await patient_service.get_patient_by_user_id(current_user.id)
        if prescription.patient_id != patient.id:
            raise PermissionDeniedError("You cannot access this prescription.")
    elif current_user.role == UserRole.DOCTOR:
        doctor_service = DoctorService(db)
        doctor = await doctor_service.get_doctor_by_user_id(current_user.id)
        if prescription.doctor_id != doctor.id:
            raise PermissionDeniedError("You cannot access this prescription.")

    doctor_obj = prescription.doctor

    # Prepare data for PDF template rendering
    pdf_data = {
        "branch_name": doctor_obj.branch.name if doctor_obj.branch else "Vertical Clinic System",
        "branch_address": doctor_obj.branch.address if doctor_obj.branch else "Ahmedabad Branch",
        "branch_phone": doctor_obj.branch.phone if doctor_obj.branch else "+91 99999 88888",
        "doctor_name": doctor_obj.user.full_name,
        "doctor_specialization": doctor_obj.specialization,
        "doctor_reg_no": doctor_obj.registration_number or "N/A",
        "patient_name": prescription.patient.user.full_name,
        "patient_code": prescription.patient.patient_code,
        "date": prescription.created_at.strftime("%Y-%m-%d"),
        "notes": prescription.notes,
        "items": [
            {
                "medicine_name": item.medicine_name,
                "dosage": item.dosage,
                "duration": item.duration,
                "instructions": item.instructions
            }
            for item in prescription.items
        ]
    }

    pdf_bytes = generate_prescription_pdf(pdf_data)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=prescription_{prescription.patient.patient_code}_{prescription.created_at.strftime('%Y%m%d')}.pdf"
        }
    )


@router.post("/{prescription_id}/dispense", response_class=JSONResponse)
async def dispense_prescription(
    prescription_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """
    Mark a prescription as dispensed and update inventory stock.
    - Restricted to Pharmacist, Receptionist, or Admin.
    """
    if current_user.role not in [UserRole.PHARMACIST, UserRole.RECEPTIONIST, UserRole.ADMIN]:
        raise PermissionDeniedError("Only pharmacists or staff can dispense prescriptions.")

    service = PrescriptionService(db)
    prescription = await service.dispense_prescription(prescription_id)
    return ApiResponse.success(
        data=PrescriptionOut.model_validate(prescription),
        message="Prescription dispensed successfully.",
    )


@router.put("/{prescription_id}", response_class=JSONResponse)
async def update_prescription(
    prescription_id: uuid.UUID,
    request: PrescriptionUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """
    Update an existing prescription.
    - Restricted to Doctor who created it or Admin.
    """
    if current_user.role not in [UserRole.DOCTOR, UserRole.ADMIN]:
        raise PermissionDeniedError("Only doctors can update prescriptions.")

    service = PrescriptionService(db)
    prescription = await service.update_prescription(prescription_id, request)
    return ApiResponse.success(
        data=PrescriptionOut.model_validate(prescription),
        message="Prescription updated successfully.",
    )
