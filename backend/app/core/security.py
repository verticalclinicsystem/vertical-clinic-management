"""
JWT creation, decoding, and password hashing utilities.
"""
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt

import bcrypt

from app.config import settings
from app.core.exceptions import InvalidTokenError, TokenExpiredError

# ── Password Hashing ──────────────────────────────────────────────────────────
def hash_password(plain_password: str) -> str:
    """Return bcrypt hash of the given password, truncated to 72 bytes."""
    pwd_bytes = plain_password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Return True if plain_password matches the stored hash."""
    try:
        pwd_bytes = plain_password.encode("utf-8")[:72]
        hash_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(pwd_bytes, hash_bytes)
    except Exception:
        return False


# ── JWT Token Helpers ─────────────────────────────────────────────────────────
def _create_token(data: dict[str, Any], expires_delta: timedelta) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + expires_delta
    payload["iat"] = datetime.now(timezone.utc)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(
    user_id: str,
    role: str,
    branch_id: str | None = None,
    extra_claims: dict[str, Any] | None = None,
    expire_minutes: int | None = None,
) -> str:
    """Create a short-lived access token embedding user_id, role, and branch."""
    data: dict[str, Any] = {
        "sub": user_id,
        "role": role,
        "branch_id": branch_id,
        "type": "access",
    }
    if extra_claims:
        data.update(extra_claims)
    delta = timedelta(minutes=expire_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return _create_token(data=data, expires_delta=delta)


def create_refresh_token(user_id: str) -> str:
    """Create a long-lived refresh token used to issue new access tokens."""
    return _create_token(
        data={"sub": user_id, "type": "refresh"},
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


def decode_access_token(token: str) -> dict[str, Any]:
    """
    Decode and validate an access token.
    Raises TokenExpiredError or InvalidTokenError on failure.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "access":
            raise InvalidTokenError()
        return payload
    except JWTError as exc:
        if "expired" in str(exc).lower():
            raise TokenExpiredError()
        raise InvalidTokenError()


def decode_refresh_token(token: str) -> dict[str, Any]:
    """
    Decode and validate a refresh token.
    Raises TokenExpiredError or InvalidTokenError on failure.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "refresh":
            raise InvalidTokenError()
        return payload
    except JWTError as exc:
        if "expired" in str(exc).lower():
            raise TokenExpiredError()
        raise InvalidTokenError()
