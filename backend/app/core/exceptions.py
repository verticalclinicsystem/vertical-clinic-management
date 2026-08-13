"""
Custom HTTP exception classes for the clinic API.
All exceptions map to specific HTTP status codes with structured error bodies.
"""
from fastapi import HTTPException, status


class ClinicAPIError(HTTPException):
    """Base exception for all clinic API errors."""
    def __init__(self, status_code: int, detail: str, error_code: str | None = None):
        super().__init__(status_code=status_code, detail=detail)
        self.error_code = error_code


# ── 400 Bad Request ───────────────────────────────────────────────────────────
class BadRequestError(ClinicAPIError):
    def __init__(self, detail: str = "Bad request"):
        super().__init__(status.HTTP_400_BAD_REQUEST, detail, "BAD_REQUEST")


class ValidationError(ClinicAPIError):
    def __init__(self, detail: str = "Validation failed"):
        super().__init__(status.HTTP_422_UNPROCESSABLE_ENTITY, detail, "VALIDATION_ERROR")


# ── 401 Unauthorized ─────────────────────────────────────────────────────────
class AuthenticationError(ClinicAPIError):
    def __init__(self, detail: str = "Authentication required"):
        super().__init__(status.HTTP_401_UNAUTHORIZED, detail, "UNAUTHENTICATED")


class InvalidCredentialsError(ClinicAPIError):
    def __init__(self):
        super().__init__(status.HTTP_401_UNAUTHORIZED, "Invalid email or password", "INVALID_CREDENTIALS")


class TokenExpiredError(ClinicAPIError):
    def __init__(self):
        super().__init__(status.HTTP_401_UNAUTHORIZED, "Token has expired", "TOKEN_EXPIRED")


class InvalidTokenError(ClinicAPIError):
    def __init__(self):
        super().__init__(status.HTTP_401_UNAUTHORIZED, "Invalid token", "INVALID_TOKEN")


class OtpExpiredError(ClinicAPIError):
    def __init__(self):
        super().__init__(status.HTTP_400_BAD_REQUEST, "OTP has expired", "OTP_EXPIRED")


class OtpInvalidError(ClinicAPIError):
    def __init__(self):
        super().__init__(status.HTTP_400_BAD_REQUEST, "Invalid OTP code", "OTP_INVALID")


class OtpMaxAttemptsError(ClinicAPIError):
    def __init__(self):
        super().__init__(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Too many incorrect OTP attempts. Please request a new OTP.",
            "OTP_MAX_ATTEMPTS",
        )


# ── 403 Forbidden ────────────────────────────────────────────────────────────
class PermissionDeniedError(ClinicAPIError):
    def __init__(self, detail: str = "You do not have permission to perform this action"):
        super().__init__(status.HTTP_403_FORBIDDEN, detail, "PERMISSION_DENIED")


# ── 404 Not Found ────────────────────────────────────────────────────────────
class NotFoundError(ClinicAPIError):
    def __init__(self, resource: str = "Resource"):
        super().__init__(status.HTTP_404_NOT_FOUND, f"{resource} not found", "NOT_FOUND")


class UserNotFoundError(ClinicAPIError):
    def __init__(self):
        super().__init__(status.HTTP_404_NOT_FOUND, "User not found. Please sign up.", "USER_NOT_FOUND")


class PatientNotFoundError(NotFoundError):
    def __init__(self):
        super().__init__("Patient")


class AppointmentNotFoundError(NotFoundError):
    def __init__(self):
        super().__init__("Appointment")


class DoctorNotFoundError(NotFoundError):
    def __init__(self):
        super().__init__("Doctor")


class BranchNotFoundError(NotFoundError):
    def __init__(self):
        super().__init__("Branch")


class PrescriptionNotFoundError(NotFoundError):
    def __init__(self):
        super().__init__("Prescription")


class MedicineNotFoundError(NotFoundError):
    def __init__(self):
        super().__init__("Medicine")


class InvoiceNotFoundError(NotFoundError):
    def __init__(self):
        super().__init__("Invoice")


# ── 409 Conflict ─────────────────────────────────────────────────────────────
class ConflictError(ClinicAPIError):
    def __init__(self, detail: str = "Resource already exists"):
        super().__init__(status.HTTP_409_CONFLICT, detail, "CONFLICT")


class SlotAlreadyBookedError(ConflictError):
    def __init__(self):
        super().__init__("This time slot is already booked")


class EmailAlreadyExistsError(ConflictError):
    def __init__(self):
        super().__init__("A user with this email already exists")


# ── 422 Business Logic ────────────────────────────────────────────────────────
class InsufficientStockError(ClinicAPIError):
    def __init__(self, medicine: str):
        super().__init__(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Insufficient stock for: {medicine}",
            "INSUFFICIENT_STOCK"
        )


class AINotApprovedError(ClinicAPIError):
    def __init__(self):
        super().__init__(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "AI-generated content must be reviewed and approved by the doctor before saving",
            "AI_NOT_APPROVED"
        )


class AppointmentNotConsultableError(ClinicAPIError):
    def __init__(self):
        super().__init__(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Appointment is not in a consultable state",
            "APPOINTMENT_NOT_CONSULTABLE"
        )


# ── 500 Server Error ──────────────────────────────────────────────────────────
class AIServiceError(ClinicAPIError):
    def __init__(self, detail: str = "AI service encountered an error"):
        super().__init__(status.HTTP_503_SERVICE_UNAVAILABLE, detail, "AI_SERVICE_ERROR")


class StorageError(ClinicAPIError):
    def __init__(self, detail: str = "File storage error"):
        super().__init__(status.HTTP_500_INTERNAL_SERVER_ERROR, detail, "STORAGE_ERROR")
