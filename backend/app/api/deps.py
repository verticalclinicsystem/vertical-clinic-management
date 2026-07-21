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

    return user


async def get_current_active_user(
    current_user=Depends(get_current_user),
):
    """Alias that additionally confirms the account is active."""
    return current_user


# Convenience typed aliases for route signatures
CurrentUser = Annotated[object, Depends(get_current_user)]
DBSession = Annotated[AsyncSession, Depends(get_db)]
