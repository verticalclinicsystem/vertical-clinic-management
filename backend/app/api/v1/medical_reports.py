"""
Medical Reports Router — /api/v1/medical-reports/*
"""
import os
import shutil
from typing import Annotated
import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile, status, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.rbac import UserRole, require_roles
from app.models.user import User
from app.schemas.medical_report import MedicalReportOut
from app.services.medical_report_service import MedicalReportService
from app.services.patient_service import PatientService
from app.utils.response import ApiResponse

router = APIRouter()

UPLOAD_DIR = "static/uploads"


# ── 1. POST /medical-reports/upload ──────────────────────────────────────────
@router.post(
    "/upload",
    status_code=status.HTTP_201_CREATED,
    summary="Upload a new patient medical report",
)
async def upload_medical_report(
    request: Request,
    report_type: str = Form(...),
    title: str | None = Form(None),
    patient_id: uuid.UUID | None = Form(None),
    file: UploadFile = File(...),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> JSONResponse:
    """
    Upload a medical report file (e.g. PDF, Image) and store metadata.
    Supported backends: local, s3, cloudinary.
    """
    if current_user.role not in [UserRole.PATIENT, UserRole.RECEPTIONIST, UserRole.DOCTOR, UserRole.ADMIN]:
        from app.core.exceptions import PermissionDeniedError
        raise PermissionDeniedError("You do not have permission to upload reports.")

    from app.core.exceptions import BadRequestError
    from app.services.storage_service import StorageService
    
    patient_id_str = None
    patient_uuid = None
    
    if current_user.role == UserRole.PATIENT:
        patient_service = PatientService(db)
        patient = await patient_service.get_patient_by_user_id(current_user.id)
        if not patient:
            raise BadRequestError("Patient profile not found.")
        patient_uuid = patient.id
        patient_id_str = str(patient.id)
    else:
        if not patient_id:
            raise BadRequestError("patient_id is required for staff uploads.")
        patient_uuid = patient_id
        patient_id_str = str(patient_id)

    # Upload via StorageService
    file_url = await StorageService.upload_medical_report(file, patient_id=patient_id_str, request=request)
    report_name = title or file.filename or "report.pdf"

    service = MedicalReportService(db)
    if current_user.role == UserRole.PATIENT:
        report = await service.create_report(
            user_id=current_user.id,
            report_type=report_type,
            report_name=report_name,
            file_url=file_url,
        )
    else:
        report = await service.create_report_for_patient(
            patient_id=patient_uuid,
            report_type=report_type,
            report_name=report_name,
            file_url=file_url,
        )

    return ApiResponse.success(
        data=MedicalReportOut.model_validate(report),
        message="Medical report uploaded successfully.",
        status_code=status.HTTP_201_CREATED,
    )


# ── 2. GET /medical-reports ───────────────────────────────────────────────────
@router.get(
    "",
    summary="List medical reports of the logged-in patient",
)
async def list_my_medical_reports(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Retrieve all reports uploaded by the currently authenticated patient."""
    if current_user.role != UserRole.PATIENT:
        from app.core.exceptions import BadRequestError
        raise BadRequestError("Only patients can list their own reports.")

    service = MedicalReportService(db)
    reports = await service.get_reports_by_user_id(current_user.id)
    return ApiResponse.success(
        data=[MedicalReportOut.model_validate(r) for r in reports],
        message="Medical reports retrieved successfully.",
    )


# ── 3. GET /medical-reports/patient/{patient_id} ──────────────────────────────
@router.get(
    "/patient/{patient_id}",
    summary="List medical reports of a patient (staff only)",
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST))],
)
async def list_patient_medical_reports(
    patient_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Retrieve all reports for a specific patient ID (accessible by clinic staff)."""
    service = MedicalReportService(db)
    reports = await service.get_reports_by_patient_id(patient_id)
    return ApiResponse.success(
        data=[MedicalReportOut.model_validate(r) for r in reports],
        message="Patient medical reports retrieved successfully.",
    )


# ── 4. DELETE /medical-reports/{report_id} ────────────────────────────────────
@router.delete(
    "/{report_id}",
    summary="Delete a medical report (owner or admin)",
)
async def delete_medical_report(
    report_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Delete a medical report if owned by caller or deleted by admin."""
    service = MedicalReportService(db)
    await service.delete_report(
        user_id=current_user.id,
        user_role=current_user.role,
        report_id=report_id,
    )

    return ApiResponse.success(
        message="Medical report deleted successfully.",
    )
