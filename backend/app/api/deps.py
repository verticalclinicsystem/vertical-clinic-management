"""
FastAPI shared dependencies — injected into route handlers via Depends().
"""
import uuid
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationError, UserNotFoundError
from app.core.security import decode_access_token
from app.db.session import get_db

http_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(http_bearer)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Decode the Bearer token, fetch the user from the DB, and return the User model.
    Raises AuthenticationError if the token is invalid or the user doesn't exist.
    """
    if not credentials:
        raise AuthenticationError("Not authenticated")

    # Decode token — raises TokenExpiredError / InvalidTokenError automatically
    payload = decode_access_token(credentials.credentials)

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise AuthenticationError("Token is missing user identifier")

    # Import here to avoid circular imports at module level
    from app.repositories.user_repo import UserRepository
    user_repo = UserRepository(db)

    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise AuthenticationError("Token contains an invalid user identifier")

    user = await user_repo.get_by_id(uid)
    if not user:
        raise UserNotFoundError()
    if not user.is_active:
        raise AuthenticationError("Account is deactivated")

    # Check for temporary suspension
    from datetime import datetime, timezone, timedelta
    if user.suspended_until and user.suspended_until > datetime.now(timezone.utc):
        ist_tz = timezone(timedelta(hours=5, minutes=30))
        suspended_until_ist = user.suspended_until.astimezone(ist_tz)
        formatted_time = suspended_until_ist.strftime("%d %b %Y, %I:%M %p")
        raise AuthenticationError(
            f"Your account is suspended until {formatted_time} (IST)."
        )

    # Check for token version/session revocation
    token_version = payload.get("token_version")
    if token_version != user.token_version:
        raise AuthenticationError("Session expired or revoked")

    return user


async def get_current_user_optional(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(http_bearer)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if not credentials:
        return None
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = payload.get("sub")
        if not user_id:
            return None
        from app.repositories.user_repo import UserRepository
        user_repo = UserRepository(db)
        uid = uuid.UUID(user_id)
        user = await user_repo.get_by_id(uid)
        if user and user.is_active:
            from datetime import datetime, timezone
            if user.suspended_until and user.suspended_until > datetime.now(timezone.utc):
                return None
            token_version = payload.get("token_version")
            if token_version != user.token_version:
                return None
            return user
    except Exception:
        pass
    return None


async def get_current_active_user(
    current_user=Depends(get_current_user),
):
    """Alias that additionally confirms the account is active."""
    return current_user


# Convenience typed aliases for route signatures
CurrentUser = Annotated[object, Depends(get_current_user)]
CurrentUserOptional = Annotated[object, Depends(get_current_user_optional)]
DBSession = Annotated[AsyncSession, Depends(get_db)]
