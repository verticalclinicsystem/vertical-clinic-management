"""
Payments router — REST API endpoints for managing patient payment transactions.
"""
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.rbac import UserRole
from app.core.exceptions import PermissionDeniedError
from app.models.user import User
from app.schemas.payment import PaymentOut, PaymentCreate
from app.services.payment_service import PaymentService
from app.services.patient_service import PatientService
from app.utils.response import ApiResponse

router = APIRouter()


# ── 1. POST /payments ──────────────────────────────────────────────────────────
@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    summary="Record a new payment",
)
async def record_payment(
    request: PaymentCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """
    Record a patient payment against an invoice.
    - Restricted to Receptionists, Pharmacists, or Admins.
    """
    if current_user.role not in [UserRole.RECEPTIONIST, UserRole.PHARMACIST, UserRole.ADMIN]:
        raise PermissionDeniedError("Only staff can record payments.")

    service = PaymentService(db)
    payment = await service.create_payment(request)
    return ApiResponse.success(
        data=PaymentOut.model_validate(payment),
        message="Payment recorded successfully.",
        status_code=status.HTTP_201_CREATED,
    )


# ── 2. GET /payments ───────────────────────────────────────────────────────────
@router.get(
    "/",
    summary="List/search payments",
)
async def list_payments(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    patient_id: UUID | None = Query(None),
    invoice_id: UUID | None = Query(None),
) -> JSONResponse:
    """
    List payment transactions.
    - Patients are restricted to viewing only their own payments.
    - Staff/Admin can view all payments.
    """
    service = PaymentService(db)

    # Apply RBAC restrictions
    if current_user.role == UserRole.PATIENT:
        patient_service = PatientService(db)
        patient = await patient_service.get_patient_by_user_id(current_user.id)
        patient_id = patient.id

    items, total = await service.list_payments(
        page=page,
        limit=limit,
        patient_id=patient_id,
        invoice_id=invoice_id,
    )
    pages = (total + limit - 1) // limit

    return ApiResponse.success(
        data={
            "items": [PaymentOut.model_validate(item) for item in items],
            "total": total,
            "page": page,
            "limit": limit,
            "pages": pages,
        },
        message="Payments retrieved successfully.",
    )


# ── 3. GET /payments/{payment_id} ──────────────────────────────────────────────
@router.get(
    "/{payment_id}",
    summary="Get payment details",
)
async def get_payment(
    payment_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Fetch details of a single payment (accessible by involved patient or staff)."""
    service = PaymentService(db)
    payment = await service.get_payment(payment_id)

    # Permission check
    if current_user.role == UserRole.PATIENT:
        patient_service = PatientService(db)
        patient = await patient_service.get_patient_by_user_id(current_user.id)
        if payment.patient_id != patient.id:
            raise PermissionDeniedError("Access to this payment is denied.")

    return ApiResponse.success(
        data=PaymentOut.model_validate(payment),
        message="Payment details retrieved successfully.",
    )
