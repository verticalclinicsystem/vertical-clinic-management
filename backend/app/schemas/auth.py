"""
Auth & User Pydantic schemas — request/response validation.
Covers all 12 auth endpoints.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


# ── Shared validators ─────────────────────────────────────────────────────────
def _validate_phone(v: str) -> str:
    digits = "".join(c for c in v if c.isdigit() or c == "+")
    if len(digits.replace("+", "")) < 10:
        raise ValueError("Phone number must have at least 10 digits")
    return digits


def _validate_password_strength(v: str) -> str:
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if not any(c.isupper() for c in v):
        raise ValueError("Password must contain at least one uppercase letter (A-Z)")
    if not any(c.isdigit() for c in v):
        raise ValueError("Password must contain at least one number (0-9)")
    if not any(c in r"!@#$%^&*()_+-=[]{}|;':\",./<>?`~\\" for c in v):
        raise ValueError("Password must contain at least one special character (!@#$%^&* etc.)")
    return v


# ── 1. Register ───────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    """Register a new clinic owner / patient account."""
    full_name: str = Field(..., min_length=2, max_length=200)
    email: EmailStr
    phone: str = Field(..., min_length=10, max_length=15)
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("phone")
    @classmethod
    def clean_phone(cls, v: str) -> str:
        return _validate_phone(v)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)


class RegisterResponse(BaseModel):
    success: bool = True
    message: str = "Registration successful. Please verify your email with the OTP sent."
    email: str


# ── 2. Verify OTP ─────────────────────────────────────────────────────────────
class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=4, max_length=10)


class VerifyOtpResponse(BaseModel):
    success: bool = True
    message: str = "OTP verified successfully. You can now login."


# ── 3. Resend OTP ─────────────────────────────────────────────────────────────
class ResendOtpRequest(BaseModel):
    email: EmailStr
    purpose: str = Field(
        "verify",
        description="'verify' for account verification, 'reset' for password reset",
        pattern="^(verify|reset)$",
    )


class ResendOtpResponse(BaseModel):
    success: bool = True
    message: str = "OTP has been resent to your email."


# ── 4. Login ──────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    """Supports login with email OR phone number."""
    identifier: str = Field(
        ...,
        description="Email address or phone number",
        examples=["priya.sharma@gmail.com", "+919825011234"],
    )
    password: str = Field(..., min_length=6)


class TokenResponse(BaseModel):
    """Returned after successful login."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(..., description="Access token lifetime in seconds")
    user: UserOut


# ── 5. Refresh Token ──────────────────────────────────────────────────────────
class RefreshRequest(BaseModel):
    refresh_token: str


class AccessTokenResponse(BaseModel):
    """Returned when refreshing access token."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int


# ── 6. Logout ─────────────────────────────────────────────────────────────────
class LogoutResponse(BaseModel):
    success: bool = True
    message: str = "Logged out successfully."


# ── 7. Forgot Password ────────────────────────────────────────────────────────
class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    success: bool = True
    message: str = "Password reset OTP sent to your email."


# ── 8. Verify Reset OTP ───────────────────────────────────────────────────────
class VerifyResetOtpRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=4, max_length=10)


class VerifyResetOtpResponse(BaseModel):
    success: bool = True
    message: str = "OTP verified. You may now reset your password."
    reset_token: str  # Short-lived JWT to authorize the reset-password call


# ── 9. Reset Password ─────────────────────────────────────────────────────────
class ResetPasswordRequest(BaseModel):
    reset_token: str
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)


class ResetPasswordResponse(BaseModel):
    success: bool = True
    message: str = "Password has been reset successfully."


# ── 10. Change Password ───────────────────────────────────────────────────────
class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)


class ChangePasswordResponse(BaseModel):
    success: bool = True
    message: str = "Password updated successfully."


# ── 11. Get Profile / 12. Update Profile ─────────────────────────────────────
class UserOut(BaseModel):
    """Safe user representation — never exposes hashed_password."""
    id: uuid.UUID
    email: str
    phone: str | None
    full_name: str
    avatar_url: str | None
    role: str
    branch_id: uuid.UUID | None
    is_active: bool
    is_verified: bool
    created_at: datetime
    last_login_at: datetime | None

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    """Fields the user can update on their own profile."""
    full_name: str | None = Field(None, min_length=2, max_length=200)
    phone: str | None = Field(None, min_length=10, max_length=15)
    avatar_url: str | None = Field(None, description="URL to the user's avatar image")

    @field_validator("phone")
    @classmethod
    def clean_phone(cls, v: str | None) -> str | None:
        if v is None:
            return v
        return _validate_phone(v)


# ── Staff creation (admin-only, lives in users.py router) ─────────────────────
class StaffCreateRequest(BaseModel):
    """Admin creates a staff user (doctor, receptionist, pharmacist, admin, clinic_manager)."""
    full_name: str = Field(..., min_length=2, max_length=200)
    email: EmailStr
    phone: str = Field(..., min_length=10, max_length=15)
    password: str = Field(..., min_length=8, max_length=128)
    role: str = Field(..., pattern="^(receptionist|doctor|pharmacist|admin|clinic_manager)$")
    branch_id: uuid.UUID | None = None


class DoctorCreateRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=200)
    email: EmailStr
    phone: str = Field(..., min_length=10, max_length=15)
    password: str = Field(..., min_length=8, max_length=128)
    branch_id: uuid.UUID | None = None
    # Doctor specific details
    specialization: str = Field(..., min_length=2, max_length=150)
    qualification: str | None = Field(None, max_length=200)
    experience_years: int = Field(0, ge=0)
    consultation_fee: float = Field(0.0, ge=0.0)
    bio: str | None = None
    registration_number: str | None = Field(None, max_length=50)
    is_available: bool = True
    availability_metadata: str | None = None

    @field_validator("phone")
    @classmethod
    def clean_phone(cls, v: str) -> str:
        return _validate_phone(v)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)


class ReceptionistCreateRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=200)
    email: EmailStr
    phone: str = Field(..., min_length=10, max_length=15)
    password: str = Field(..., min_length=8, max_length=128)
    branch_id: uuid.UUID | None = None
    # Receptionist specific details
    shift_start: str = Field("09:00", pattern=r"^\d{2}:\d{2}$")
    shift_end: str = Field("17:00", pattern=r"^\d{2}:\d{2}$")
    bio: str | None = None

    @field_validator("phone")
    @classmethod
    def clean_phone(cls, v: str) -> str:
        return _validate_phone(v)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)


class PharmacistCreateRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=200)
    email: EmailStr
    phone: str = Field(..., min_length=10, max_length=15)
    password: str = Field(..., min_length=8, max_length=128)
    branch_id: uuid.UUID | None = None

    @field_validator("phone")
    @classmethod
    def clean_phone(cls, v: str) -> str:
        return _validate_phone(v)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)


class AdminCreateRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=200)
    email: EmailStr
    phone: str = Field(..., min_length=10, max_length=15)
    password: str = Field(..., min_length=8, max_length=128)
    branch_id: uuid.UUID | None = None

    @field_validator("phone")
    @classmethod
    def clean_phone(cls, v: str) -> str:
        return _validate_phone(v)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)


class UserUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=2, max_length=200)
    phone: str | None = Field(None, min_length=10, max_length=15)
    email: EmailStr | None = None
    role: str | None = Field(None, pattern="^(receptionist|doctor|pharmacist|admin|clinic_manager)$")
    branch_id: uuid.UUID | None = None
    is_active: bool | None = None
    password: str | None = Field(None, min_length=8, max_length=128)

PatientRegisterRequest = RegisterRequest
