"""
RBAC (Role-Based Access Control) permission matrix.
Defines what each role can do throughout the system.
"""
from enum import StrEnum

from fastapi import Depends

from app.core.exceptions import PermissionDeniedError


class UserRole(StrEnum):
    PATIENT = "patient"
    RECEPTIONIST = "receptionist"
    DOCTOR = "doctor"
    PHARMACIST = "pharmacist"
    ADMIN = "admin"


# ── Permission Registry ───────────────────────────────────────────────────────
# Each permission is a string key; roles that hold it are listed in the set.
PERMISSIONS: dict[str, set[UserRole]] = {
    # Appointments
    "appointment:create": {UserRole.PATIENT, UserRole.RECEPTIONIST, UserRole.ADMIN},
    "appointment:read_own": {UserRole.PATIENT},
    "appointment:read_all": {UserRole.RECEPTIONIST, UserRole.DOCTOR, UserRole.ADMIN},
    "appointment:update": {UserRole.RECEPTIONIST, UserRole.ADMIN},
    "appointment:cancel": {UserRole.PATIENT, UserRole.RECEPTIONIST, UserRole.ADMIN},
    "appointment:reschedule": {UserRole.PATIENT, UserRole.RECEPTIONIST, UserRole.ADMIN},

    # Queue
    "queue:read": {UserRole.RECEPTIONIST, UserRole.DOCTOR, UserRole.ADMIN},
    "queue:update": {UserRole.RECEPTIONIST, UserRole.ADMIN},

    # Patients
    "patient:register": {UserRole.RECEPTIONIST, UserRole.ADMIN},
    "patient:read_own": {UserRole.PATIENT},
    "patient:read_all": {UserRole.RECEPTIONIST, UserRole.DOCTOR, UserRole.PHARMACIST, UserRole.ADMIN},
    "patient:update": {UserRole.RECEPTIONIST, UserRole.ADMIN},

    # Consultation
    "consultation:write": {UserRole.DOCTOR},
    "consultation:read": {UserRole.DOCTOR, UserRole.ADMIN},
    "consultation:approve_ai": {UserRole.DOCTOR},

    # Prescriptions
    "prescription:write": {UserRole.DOCTOR},
    "prescription:read_own": {UserRole.PATIENT},
    "prescription:read_all": {UserRole.DOCTOR, UserRole.PHARMACIST, UserRole.RECEPTIONIST, UserRole.ADMIN},
    "prescription:finalize": {UserRole.DOCTOR},

    # Treatment Plans
    "treatment:write": {UserRole.DOCTOR},
    "treatment:read": {UserRole.DOCTOR, UserRole.PATIENT, UserRole.ADMIN},

    # Pharmacy
    "pharmacy:dispense": {UserRole.PHARMACIST},
    "pharmacy:read_queue": {UserRole.PHARMACIST, UserRole.ADMIN},

    # Inventory
    "inventory:read": {UserRole.PHARMACIST, UserRole.ADMIN},
    "inventory:write": {UserRole.PHARMACIST, UserRole.ADMIN},
    "inventory:manage": {UserRole.ADMIN},

    # Billing & Invoices
    "invoice:create": {UserRole.RECEPTIONIST, UserRole.ADMIN},
    "invoice:read_own": {UserRole.PATIENT},
    "invoice:read_all": {UserRole.RECEPTIONIST, UserRole.ADMIN},
    "invoice:update": {UserRole.RECEPTIONIST, UserRole.ADMIN},

    # Payments
    "payment:initiate": {UserRole.PATIENT, UserRole.RECEPTIONIST, UserRole.ADMIN},
    "payment:read": {UserRole.PATIENT, UserRole.RECEPTIONIST, UserRole.ADMIN},

    # Medical Reports
    "report:upload": {UserRole.PATIENT},
    "report:read_own": {UserRole.PATIENT},
    "report:read_all": {UserRole.DOCTOR, UserRole.ADMIN},
    "report:ai_summarize": {UserRole.PATIENT, UserRole.DOCTOR},

    # Tele-consultation
    "tele:create": {UserRole.PATIENT, UserRole.RECEPTIONIST, UserRole.ADMIN},
    "tele:join": {UserRole.PATIENT, UserRole.DOCTOR},
    "tele:analyze": {UserRole.DOCTOR},

    # Notifications
    "notification:read_own": {
        UserRole.PATIENT,
        UserRole.RECEPTIONIST,
        UserRole.DOCTOR,
        UserRole.PHARMACIST,
        UserRole.ADMIN,
    },

    # Staff & Branch Management
    "staff:manage": {UserRole.ADMIN},
    "branch:manage": {UserRole.ADMIN},
    "branch:read": {
        UserRole.ADMIN,
        UserRole.RECEPTIONIST,
        UserRole.DOCTOR,
        UserRole.PHARMACIST,
    },

    # Analytics & Reports
    "analytics:read": {UserRole.ADMIN},
    "analytics:export": {UserRole.ADMIN},

    # System Settings
    "settings:manage": {UserRole.ADMIN},
}


def has_permission(role: UserRole, permission: str) -> bool:
    """Return True if the given role holds the specified permission."""
    allowed_roles = PERMISSIONS.get(permission, set())
    return role in allowed_roles


def require_roles(*roles: UserRole):
    """
    FastAPI dependency factory.
    Usage:
        @router.get("/", dependencies=[Depends(require_roles(UserRole.ADMIN))])
    """
    from app.api.deps import get_current_user  # avoid circular import

    async def _check(current_user=Depends(get_current_user)):
        if current_user.role not in roles:
            raise PermissionDeniedError(
                f"This action requires one of the following roles: "
                f"{', '.join(r.value for r in roles)}"
            )
        return current_user

    return _check


def require_permission(permission: str):
    """
    FastAPI dependency factory for granular permission checking.
    Usage:
        @router.post("/", dependencies=[Depends(require_permission("appointment:create"))])
    """
    from app.api.deps import get_current_user  # avoid circular import

    async def _check(current_user=Depends(get_current_user)):
        if not has_permission(UserRole(current_user.role), permission):
            raise PermissionDeniedError(
                f"You do not have the '{permission}' permission"
            )
        return current_user

    return _check
