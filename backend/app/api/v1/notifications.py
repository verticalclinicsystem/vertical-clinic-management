"""notifications router — endpoints for patient, doctor, and staff in-app notifications."""
from typing import Annotated
import uuid
from fastapi import APIRouter, Depends, Path
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.models.notification import Notification
from app.schemas.notification import NotificationOut

router = APIRouter()


@router.get(
    "",
    summary="List logged-in user's notifications",
)
async def list_notifications(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Retrieve all notifications for the current user, ordered by newest first."""
    stmt = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(desc(Notification.created_at))
    )
    res = await db.execute(stmt)
    notifications = res.scalars().all()

    data = [NotificationOut.model_validate(n).model_dump() for n in notifications]
    return JSONResponse(
        status_code=200,
        content=jsonable_encoder({
            "success": True,
            "message": "Notifications retrieved successfully.",
            "data": data,
        }),
    )


@router.patch(
    "/read-all",
    summary="Mark all logged-in user's notifications as read",
)
async def mark_all_notifications_as_read(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Mark all unread notifications of the logged-in user as read."""
    from sqlalchemy import update

    stmt = (
        update(Notification)
        .where((Notification.user_id == current_user.id) & (Notification.is_read == False))
        .values(is_read=True)
    )
    await db.execute(stmt)
    await db.commit()

    return JSONResponse(
        status_code=200,
        content=jsonable_encoder({
            "success": True,
            "message": "All notifications marked as read.",
            "data": {},
        }),
    )


@router.patch(
    "/{notification_id}/read",
    summary="Mark a specific notification as read",
)
async def mark_notification_as_read(
    notification_id: Annotated[uuid.UUID, Path(description="The ID of the notification to mark as read")],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Mark a notification as read if it belongs to the logged-in user."""
    stmt = select(Notification).where(
        (Notification.id == notification_id) & (Notification.user_id == current_user.id)
    )
    res = await db.execute(stmt)
    notification = res.scalar_one_or_none()

    if not notification:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Notification not found.")

    notification.is_read = True
    db.add(notification)
    await db.commit()
    await db.refresh(notification)

    return JSONResponse(
        status_code=200,
        content=jsonable_encoder({
            "success": True,
            "message": "Notification marked as read.",
            "data": NotificationOut.model_validate(notification).model_dump(),
        }),
    )


