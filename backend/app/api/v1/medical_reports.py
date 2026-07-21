"""
Medical Reports Router — /api/v1/medical-reports/*
"""
import os
import shutil
from typing import Annotated
import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.rbac import UserRole, require_roles
from app.models.user import User
from app.schemas.medical_report import MedicalReportOut
from app.services.medical_report_service import MedicalReportService
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
    report_type: Annotated[str, Form(...)],
    file: UploadFile = File(...),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> JSONResponse:
    """
    Upload a medical report file (e.g. PDF, Image) and store metadata.
    File is stored locally under static/uploads/ folder.
    """
    if current_user.role != UserRole.PATIENT:
        from app.core.exceptions import BadRequestError
        raise BadRequestError("Only patients can upload medical reports.")

    # Create static uploads directory
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    # Unique file name
    file_ext = os.path.splitext(file.filename or "")[1]
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    dest_path = os.path.join(UPLOAD_DIR, unique_filename)

    # Save to disk
    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_url = f"/static/uploads/{unique_filename}"
    report_name = file.filename or "report.pdf"

    service = MedicalReportService(db)
    report = await service.create_report(
        user_id=current_user.id,
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
