"""notifications router — endpoints for patient, doctor, and staff in-app notifications."""
from typing import Annotated
import uuid
from fastapi import APIRouter, Depends, Path, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.notification import NotificationOut
from app.services.notification_service import NotificationService

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
    service = NotificationService(db)
    notifications = await service.get_user_notifications(current_user.id)

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
    service = NotificationService(db)
    await service.mark_all_read(current_user.id)

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
    service = NotificationService(db)
    notification = await service.mark_read(notification_id, current_user.id)

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found.")

    return JSONResponse(
        status_code=200,
        content=jsonable_encoder({
            "success": True,
            "message": "Notification marked as read.",
            "data": NotificationOut.model_validate(notification).model_dump(),
        }),
    )


@router.delete(
    "/clear-all",
    summary="Delete all logged-in user's notifications",
)
async def clear_all_notifications(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Delete all notifications of the logged-in user from the database."""
    service = NotificationService(db)
    await service.clear_all(current_user.id)

    return JSONResponse(
        status_code=200,
        content=jsonable_encoder({
            "success": True,
            "message": "All notifications cleared successfully.",
            "data": {},
        }),
    )


@router.delete(
    "/{notification_id}",
    summary="Delete a specific notification",
)
async def delete_notification(
    notification_id: Annotated[uuid.UUID, Path(description="The ID of the notification to delete")],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Delete a specific notification if it belongs to the logged-in user."""
    service = NotificationService(db)
    deleted = await service.delete_notification(notification_id, current_user.id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Notification not found.")

    return JSONResponse(
        status_code=200,
        content=jsonable_encoder({
            "success": True,
            "message": "Notification deleted successfully.",
            "data": {},
        }),
    )
