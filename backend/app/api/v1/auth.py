"""
Auth router — /api/v1/auth/*

All 12 endpoints return a consistent envelope via ApiResponse:
  Success → { "success": true,  "message": "...", "data": { ... } }
  Error   → { "success": false, "message": "..." }          (from exception handlers)
"""
from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    ResendOtpRequest,
    ResetPasswordRequest,
    UpdateProfileRequest,
    UserOut,
    VerifyOtpRequest,
    VerifyResetOtpRequest,
)
from app.services.auth_service import AuthService
from app.utils.response import ApiResponse

router = APIRouter()


# ── 1. POST /auth/register ────────────────────────────────────────────────────
@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    summary="Register a new clinic/owner account",
)
async def register(
    request: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """
    Create a new user account and send a 6-digit OTP to the email.
    Account is inactive until OTP is verified via POST /verify-otp.
    """
    service = AuthService(db)
    result = await service.register(request)
    return ApiResponse.success(
        data={"email": result["email"]},
        message="Registration successful. Please verify your email with the OTP sent.",
        status_code=status.HTTP_201_CREATED,
    )


# ── 2. POST /auth/verify-otp ──────────────────────────────────────────────────
@router.post(
    "/verify-otp",
    status_code=status.HTTP_200_OK,
    summary="Verify email OTP to activate account",
)
async def verify_otp(
    request: VerifyOtpRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """
    Submit the 6-digit OTP from the registration email.
    On success: account is activated. User must then login via POST /login.
    OTP expires in 10 min; locks after 5 wrong attempts.
    """
    service = AuthService(db)
    await service.verify_otp(request)
    return ApiResponse.success(message="OTP verified successfully. You can now login.")


# ── 3. POST /auth/resend-otp ──────────────────────────────────────────────────
@router.post(
    "/resend-otp",
    status_code=status.HTTP_200_OK,
    summary="Resend verification or password-reset OTP",
)
async def resend_otp(
    request: ResendOtpRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """
    Invalidate existing OTPs and issue a fresh one.
    Use `purpose='verify'` for account activation, `'reset'` for password reset.
    """
    service = AuthService(db)
    await service.resend_otp(request)
    return ApiResponse.success(message="OTP has been resent to your email.")


# ── 4. POST /auth/login ───────────────────────────────────────────────────────
@router.post(
    "/login",
    status_code=status.HTTP_200_OK,
    summary="Login with email/phone and password",
)
async def login(
    request: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """
    Authenticate any user (all roles).
    `identifier` can be email address or phone number.
    Account must be verified before login is permitted.
    """
    service = AuthService(db)
    result = await service.login(request)
    return ApiResponse.success(
        data={
            "access_token": result["access_token"],
            "refresh_token": result["refresh_token"],
            "token_type": result["token_type"],
            "expires_in": result["expires_in"],
            "user": UserOut.model_validate(result["user"]),
        },
        message="Login successful.",
    )


# ── 5. POST /auth/refresh-token ───────────────────────────────────────────────
@router.post(
    "/refresh-token",
    status_code=status.HTTP_200_OK,
    summary="Generate new access token from refresh token",
)
async def refresh_token(
    request: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """
    Exchange a valid refresh token for a new access token.
    Call this automatically when the access token returns a 401.
    """
    service = AuthService(db)
    result = await service.refresh_access_token(request.refresh_token)
    return ApiResponse.success(
        data={
            "access_token": result["access_token"],
            "token_type": result["token_type"],
            "expires_in": result["expires_in"],
        },
        message="Token refreshed successfully.",
    )


# ── 6. POST /auth/logout ──────────────────────────────────────────────────────
@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Logout current device",
)
async def logout(
    current_user: Annotated[User, Depends(get_current_user)],
) -> JSONResponse:
    """
    Stateless logout — the client must discard both tokens.
    For full token revocation, a Redis blocklist can be added here.
    """
    return ApiResponse.success(message="Logged out successfully.")


# ── 7. POST /auth/forgot-password ─────────────────────────────────────────────
@router.post(
    "/forgot-password",
    status_code=status.HTTP_200_OK,
    summary="Send password reset OTP to email",
)
async def forgot_password(
    request: ForgotPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """
    Send a password-reset OTP to the registered email.
    Returns 404 if the email is not found, 200 + OTP sent message if found.
    """
    service = AuthService(db)
    await service.forgot_password(request)
    return ApiResponse.success(message="OTP sent successfully. Please check your email.")


# ── 8. POST /auth/verify-reset-otp ───────────────────────────────────────────
@router.post(
    "/verify-reset-otp",
    status_code=status.HTTP_200_OK,
    summary="Verify password reset OTP",
)
async def verify_reset_otp(
    request: VerifyResetOtpRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """
    Validate the reset OTP.
    Returns a short-lived `reset_token` (15 min) to be used in POST /reset-password.
    """
    service = AuthService(db)
    result = await service.verify_reset_otp(request)
    return ApiResponse.success(
        data={"reset_token": result["reset_token"]},
        message="OTP verified. Use the reset_token to set your new password.",
    )


# ── 9. POST /auth/reset-password ──────────────────────────────────────────────
@router.post(
    "/reset-password",
    status_code=status.HTTP_200_OK,
    summary="Set a new password using the reset token",
)
async def reset_password(
    request: ResetPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """
    Consume the `reset_token` from POST /verify-reset-otp and set the new password.
    The token is single-use and expires in 15 minutes.
    """
    service = AuthService(db)
    await service.reset_password(request)
    return ApiResponse.success(message="Password has been reset successfully.")


# ── 10. POST /auth/change-password ────────────────────────────────────────────
@router.post(
    "/change-password",
    status_code=status.HTTP_200_OK,
    summary="Change password (must be logged in)",
)
async def change_password(
    request: ChangePasswordRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """
    Change password for the authenticated user.
    Requires the current (old) password to be provided.
    """
    service = AuthService(db)
    await service.change_password(current_user, request)
    return ApiResponse.success(message="Password updated successfully.")


# ── 11. GET /auth/me ──────────────────────────────────────────────────────────
@router.get(
    "/me",
    status_code=status.HTTP_200_OK,
    summary="Get logged-in user details",
)
async def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> JSONResponse:
    """Return the full profile of the currently authenticated user."""
    return ApiResponse.success(
        data=UserOut.model_validate(current_user),
        message="User profile fetched successfully.",
    )


# ── 12. PATCH /auth/profile ───────────────────────────────────────────────────
@router.patch(
    "/profile",
    status_code=status.HTTP_200_OK,
    summary="Update name, phone, avatar, etc.",
)
async def update_profile(
    request: UpdateProfileRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """
    Update the authenticated user's own profile.
    Only the provided fields are changed (PATCH semantics).
    """
    service = AuthService(db)
    updated_user = await service.update_profile(current_user, request)
    return ApiResponse.success(
        data=UserOut.model_validate(updated_user),
        message="Profile updated successfully.",
    )
