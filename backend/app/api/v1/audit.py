import uuid
import logging
from datetime import datetime, timezone

UTC = timezone.utc
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.api.deps import get_current_active_user
from app.core.exceptions import PermissionDeniedError
from app.models.user import User, UserRole
from app.utils.response import ApiResponse

logger = logging.getLogger("audit")

router = APIRouter()

class AuditLogCreate(BaseModel):
    action: str
    patient_id: str | None = None
    bed_id: str | None = None
    doctor_id: str | None = None
    details: str | None = None

@router.post("", response_class=JSONResponse)
async def create_audit_log(
    payload: AuditLogCreate,
    current_user: User = Depends(get_current_active_user)
) -> JSONResponse:
    """
    Log an event or action for auditing.
    Restricted to authorized staff roles.
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.CLINIC_MANAGER, UserRole.RECEPTIONIST, UserRole.DOCTOR]:
        raise PermissionDeniedError("Unauthorized role for audit logs.")

    # In a real system, this would write to an `audit_logs` table.
    # To avoid DB migration overhead, we log it to Python logging/stderr.
    log_msg = (
        f"AUDIT LOG: user_id={current_user.id} role={current_user.role} "
        f"action={payload.action} patient_id={payload.patient_id} "
        f"bed_id={payload.bed_id} details={payload.details}"
    )
    logger.info(log_msg)
    print(log_msg)

    return ApiResponse.success(
        message="Audit log captured successfully.",
        data={
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now(UTC).isoformat(),
            "action": payload.action,
            "user_id": str(current_user.id),
        }
    )
