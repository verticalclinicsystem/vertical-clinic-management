"""
Auth service — pure business logic for all 12 authentication flows.

Rule: this service NEVER touches the database directly.
      All persistence is delegated to UserRepository, OtpRepository, PatientRepository.

Flows:
  1.  register          — validate uniqueness → repo.create_patient_user() + repo.create_for_user() + send OTP
  2.  verify_otp        — repo.get_by_email() + repo.activate() → JWT pair
  3.  resend_otp        — repo.get_by_email() + repo.create_otp()
  4.  login             — repo.get_by_identifier() + repo.update_last_login() → JWT pair
  5.  refresh_token     — decode → repo.get_by_id() → new access token
  6.  logout            — stateless (router handles, no service logic needed)
  7.  forgot_password   — repo.get_by_email() + repo.create_otp()
  8.  verify_reset_otp  — repo.get_by_email() + repo.consume_otp() → reset_token JWT
  9.  reset_password    — decode reset_token → repo.update_password()
  10. change_password   — verify current → repo.update_password()
  11. get_me            — handled by deps.get_current_user (no service needed)
  12. update_profile    — phone uniqueness check → repo.update_profile()
"""
from __future__ import annotations

import logging
import random
import string
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import (
    AuthenticationError,
    BadRequestError,
    ConflictError,
    EmailAlreadyExistsError,
    InvalidCredentialsError,
    OtpExpiredError,
    OtpInvalidError,
    OtpMaxAttemptsError,
    UserNotFoundError,
)
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.repositories.otp_repo import OtpRepository
from app.repositories.patient_repo import PatientRepository
from app.repositories.user_repo import UserRepository
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResendOtpRequest,
    ResetPasswordRequest,
    UpdateProfileRequest,
    VerifyOtpRequest,
    VerifyResetOtpRequest,
    DoctorCreateRequest,
    ReceptionistCreateRequest,
    PharmacistCreateRequest,
    AdminCreateRequest,
)
from app.utils.email import send_otp_email, send_welcome_email

logger = logging.getLogger(__name__)


# ── Module-level helpers (no DB, no state) ────────────────────────────────────
def _generate_otp() -> str:
    """Return a numeric OTP string (length from settings)."""
    return "".join(random.choices(string.digits, k=settings.OTP_LENGTH))


def _build_token_payload(user: User) -> dict:
    """Build the standard token response dict (no DB interaction)."""
    access_token = create_access_token(
        user_id=str(user.id),
        role=user.role,
        branch_id=str(user.branch_id) if user.branch_id else None,
    )
    refresh_token = create_refresh_token(user_id=str(user.id))
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": user,
    }


# ── Service class ─────────────────────────────────────────────────────────────
class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.user_repo = UserRepository(db)
        self.otp_repo = OtpRepository(db)
        self.patient_repo = PatientRepository(db)

    # ── 1. Register ────────────────────────────────────────────────────────────
    async def register(self, request: RegisterRequest) -> dict:
        """
        Validate uniqueness, create patient user + profile, send verify OTP.
        Account remains inactive (is_verified=False) until OTP is confirmed.
        """
        # — Business rule: no duplicate email / phone —
        if await self.user_repo.email_exists(request.email):
            raise EmailAlreadyExistsError()
        if await self.user_repo.phone_exists(request.phone):
            raise ConflictError("A user with this phone number already exists.")

        # — Delegate all DB writes to repos —
        user = await self.user_repo.create_patient_user(
            full_name=request.full_name,
            email=request.email,
            phone=request.phone,
            hashed_password=hash_password(request.password),
        )
        await self.patient_repo.create_for_user(user.id)

        # — Send OTP (repo call encapsulated in _issue_otp) —
        await self._issue_otp(user.email, purpose="verify")

        logger.info(f"New user registered (unverified): {user.email}")
        return {"email": user.email}

    # ── 2. Verify OTP ──────────────────────────────────────────────────────────
    async def verify_otp(self, request: VerifyOtpRequest) -> dict:
        """
        Validate verification OTP, activate account.
        Does NOT issue tokens — user must login via /auth/login.
        """
        user = await self.user_repo.get_by_email(request.email)
        if not user:
            raise UserNotFoundError()
        if user.is_verified:
            raise BadRequestError("Account is already verified.")

        # — OTP validation (raises on failure) —
        await self._consume_otp(request.email, request.otp, purpose="verify")

        # — Activate via repo —
        await self.user_repo.activate(user)

        # — Send Welcome Email —
        try:
            await send_welcome_email(to=user.email, full_name=user.full_name)
            logger.info(f"Welcome email sent successfully to: {user.email}")
        except Exception as welcome_err:
            logger.error(f"Failed to send welcome email to {user.email}: {welcome_err}")

        logger.info(f"Account verified: {user.email}")
        return {"email": user.email}

    # ── 3. Resend OTP ──────────────────────────────────────────────────────────
    async def resend_otp(self, request: ResendOtpRequest) -> None:
        """
        Issue a fresh OTP for the given email+purpose.
        Returns silently for unknown emails (prevents user enumeration).
        """
        user = await self.user_repo.get_by_email(request.email)
        if not user:
            return  # silent no-op — don't reveal whether email exists

        if request.purpose == "verify" and user.is_verified:
            raise BadRequestError("Account is already verified.")

        await self._issue_otp(user.email, purpose=request.purpose)
        logger.info(f"OTP resent ({request.purpose}): {user.email}")

    # ── 4. Login ───────────────────────────────────────────────────────────────
    async def login(self, request: LoginRequest) -> dict:
        """
        Authenticate by email or phone + password.
        Enforces: active account + verified email.
        """
        identifier = request.identifier.strip()
        user = await self.user_repo.get_by_identifier(identifier)

        # — Credential checks (always raise the same error to prevent enumeration) —
        if not user or not verify_password(request.password, user.hashed_password):
            if user:
                logger.warning(f"Failed login attempt for: {identifier}")
            raise InvalidCredentialsError()

        if not user.is_active:
            raise AuthenticationError("Your account has been deactivated. Contact admin.")
        if not user.is_verified:
            raise AuthenticationError(
                "Email not verified. Please verify your account before logging in."
            )

        # — Record last login (repo call) —
        await self.user_repo.update_last_login(user)

        logger.info(f"User logged in: {user.email} [{user.role}]")
        return _build_token_payload(user)

    # ── 5. Refresh Token ───────────────────────────────────────────────────────
    async def refresh_access_token(self, refresh_token: str) -> dict:
        """
        Decode refresh token → validate user → return new access token.
        """
        payload = decode_refresh_token(refresh_token)  # raises on invalid/expired
        user = await self.user_repo.get_by_id(uuid.UUID(payload["sub"]))

        if not user or not user.is_active:
            raise AuthenticationError("User not found or deactivated.")

        new_access = create_access_token(
            user_id=str(user.id),
            role=user.role,
            branch_id=str(user.branch_id) if user.branch_id else None,
        )
        return {
            "access_token": new_access,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }

    # ── 7. Forgot Password ─────────────────────────────────────────────────────
    async def forgot_password(self, request: ForgotPasswordRequest) -> None:
        """
        Send a password-reset OTP.
        Raises UserNotFoundError if the email is not registered.
        """
        user = await self.user_repo.get_by_email(request.email)
        if not user or not user.is_active:
            raise UserNotFoundError()
        await self._issue_otp(user.email, purpose="reset")
        logger.info(f"Password reset OTP sent: {user.email}")

    # ── 8. Verify Reset OTP ────────────────────────────────────────────────────
    async def verify_reset_otp(self, request: VerifyResetOtpRequest) -> dict:
        """
        Validate reset OTP → return a short-lived JWT reset_token.
        """
        user = await self.user_repo.get_by_email(request.email)
        if not user:
            raise UserNotFoundError()

        await self._consume_otp(request.email, request.otp, purpose="reset")

        reset_token = create_access_token(
            user_id=str(user.id),
            role=user.role,
            extra_claims={"purpose": "password_reset"},
            expire_minutes=settings.RESET_TOKEN_EXPIRE_MINUTES,
        )
        return {"reset_token": reset_token}

    # ── 9. Reset Password ──────────────────────────────────────────────────────
    async def reset_password(self, request: ResetPasswordRequest) -> None:
        """
        Decode reset_token → validate purpose claim → update password via repo.
        """
        try:
            payload = decode_access_token(request.reset_token)
        except Exception:
            raise AuthenticationError("Invalid or expired reset token.")

        if payload.get("purpose") != "password_reset":
            raise AuthenticationError("Token is not a valid password reset token.")

        user = await self.user_repo.get_by_id(uuid.UUID(payload["sub"]))
        if not user or not user.is_active:
            raise UserNotFoundError()

        await self.user_repo.update_password(user, hash_password(request.new_password))
        logger.info(f"Password reset completed: {user.email}")

    # ── 10. Change Password ────────────────────────────────────────────────────
    async def change_password(self, user: User, request: ChangePasswordRequest) -> None:
        """
        Verify current password → update to new one via repo.
        """
        if not verify_password(request.current_password, user.hashed_password):
            raise AuthenticationError("Current password is incorrect.")

        await self.user_repo.update_password(user, hash_password(request.new_password))
        logger.info(f"Password changed: {user.email}")

    # ── 12. Update Profile ─────────────────────────────────────────────────────
    async def update_profile(self, user: User, request: UpdateProfileRequest) -> User:
        """
        Enforce phone uniqueness, then delegate field updates to repo.
        """
        if request.phone is not None:
            existing = await self.user_repo.get_by_phone(request.phone)
            if existing and existing.id != user.id:
                raise ConflictError("This phone number is already in use.")

        return await self.user_repo.update_profile(
            user,
            full_name=request.full_name,
            phone=request.phone,
            avatar_url=request.avatar_url,
        )

    # ── Staff Creation (Admin only) ────────────────────────────────────────────
    async def create_staff_user(self, request, created_by_id: str) -> User:
        """
        Create a pre-verified staff account via repo.
        """
        if await self.user_repo.email_exists(request.email):
            raise EmailAlreadyExistsError()

        user = await self.user_repo.create_staff_user(
            full_name=request.full_name,
            email=request.email,
            phone=request.phone,
            hashed_password=hash_password(request.password),
            role=request.role,
            branch_id=request.branch_id,
        )
        if request.role == "receptionist":
            from app.repositories.receptionist_repo import ReceptionistRepository
            recep_repo = ReceptionistRepository(self.db)
            await recep_repo.create_for_user(user_id=user.id, branch_id=user.branch_id)
        elif request.role == "doctor":
            from app.repositories.doctor_repo import DoctorRepository
            doc_repo = DoctorRepository(self.db)
            await doc_repo.create({
                "user_id": user.id,
                "branch_id": user.branch_id,
                "specialization": "General Dentist",
                "consultation_fee": 500.0,
                "is_available": True,
            })

        logger.info(f"Staff created: {user.email} [{user.role}] by admin {created_by_id}")
        return user

    async def create_doctor_user(self, request: DoctorCreateRequest, created_by_id: str) -> User:
        """Create a pre-verified doctor account and doctor profile."""
        if await self.user_repo.email_exists(request.email):
            raise EmailAlreadyExistsError()

        user = await self.user_repo.create_staff_user(
            full_name=request.full_name,
            email=request.email,
            phone=request.phone,
            hashed_password=hash_password(request.password),
            role="doctor",
            branch_id=request.branch_id,
        )

        from app.repositories.doctor_repo import DoctorRepository
        doc_repo = DoctorRepository(self.db)
        await doc_repo.create({
            "user_id": user.id,
            "branch_id": user.branch_id,
            "specialization": request.specialization,
            "qualification": request.qualification,
            "experience_years": request.experience_years,
            "consultation_fee": request.consultation_fee,
            "bio": request.bio,
            "registration_number": request.registration_number,
            "is_available": request.is_available,
            "availability_metadata": request.availability_metadata,
        })

        logger.info(f"Doctor staff created: {user.email} by admin {created_by_id}")
        return user

    async def create_receptionist_user(self, request: ReceptionistCreateRequest, created_by_id: str) -> User:
        """Create a pre-verified receptionist account and receptionist profile."""
        if await self.user_repo.email_exists(request.email):
            raise EmailAlreadyExistsError()

        user = await self.user_repo.create_staff_user(
            full_name=request.full_name,
            email=request.email,
            phone=request.phone,
            hashed_password=hash_password(request.password),
            role="receptionist",
            branch_id=request.branch_id,
        )

        from app.repositories.receptionist_repo import ReceptionistRepository
        recep_repo = ReceptionistRepository(self.db)
        await recep_repo.create_for_user(
            user_id=user.id,
            branch_id=user.branch_id,
            shift_start=request.shift_start,
            shift_end=request.shift_end,
            bio=request.bio,
        )

        logger.info(f"Receptionist staff created: {user.email} by admin {created_by_id}")
        return user

    async def create_pharmacist_user(self, request: PharmacistCreateRequest, created_by_id: str) -> User:
        """Create a pre-verified pharmacist account."""
        if await self.user_repo.email_exists(request.email):
            raise EmailAlreadyExistsError()

        user = await self.user_repo.create_staff_user(
            full_name=request.full_name,
            email=request.email,
            phone=request.phone,
            hashed_password=hash_password(request.password),
            role="pharmacist",
            branch_id=request.branch_id,
        )

        logger.info(f"Pharmacist staff created: {user.email} by admin {created_by_id}")
        return user

    async def create_admin_user(self, request: AdminCreateRequest, created_by_id: str) -> User:
        """Create a pre-verified admin account."""
        if await self.user_repo.email_exists(request.email):
            raise EmailAlreadyExistsError()

        user = await self.user_repo.create_staff_user(
            full_name=request.full_name,
            email=request.email,
            phone=request.phone,
            hashed_password=hash_password(request.password),
            role="admin",
            branch_id=request.branch_id,
        )

        logger.info(f"Admin staff created: {user.email} by admin {created_by_id}")
        return user

    # ── Private helpers (no DB — call repos only) ──────────────────────────────
    async def _issue_otp(self, email: str, purpose: str) -> None:
        """
        Generate a new OTP, persist it via repo (which also invalidates old ones),
        then dispatch the email directly via utils.email.send_otp_email.
        """
        code = _generate_otp()
        await self.otp_repo.create_otp(
            email=email,
            code=code,
            purpose=purpose,
            expire_minutes=settings.OTP_EXPIRE_MINUTES,
        )
        logger.info(f"🔑 [DEV OTP] Code for {email} ({purpose}): {code}")
        await send_otp_email(to=email, otp=code, purpose=purpose)

    async def _consume_otp(self, email: str, code: str, purpose: str) -> None:
        """
        Validate an OTP code against the repo.
        Raises OtpExpiredError / OtpMaxAttemptsError / OtpInvalidError on failure.
        Marks OTP as used on success.
        """
        otp = await self.otp_repo.get_latest_active(email, purpose)
        if otp is None:
            raise OtpExpiredError()

        if otp.attempts >= settings.OTP_MAX_ATTEMPTS:
            raise OtpMaxAttemptsError()

        if otp.code != code.strip():
            await self.otp_repo.increment_attempts(otp)
            raise OtpInvalidError()

        await self.otp_repo.mark_used(otp)
