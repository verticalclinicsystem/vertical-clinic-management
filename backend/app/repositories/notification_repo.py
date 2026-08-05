"""
Notification repository — queries on the notifications table.
"""
import uuid
from sqlalchemy import select, desc, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.repositories.base import BaseRepository


class NotificationRepository(BaseRepository[Notification]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(Notification, db)

    async def get_by_user_id(self, user_id: uuid.UUID) -> list[Notification]:
        """Retrieve all notifications for the user, ordered by newest first."""
        result = await self.db.execute(
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(desc(Notification.created_at))
        )
        return list(result.scalars().all())

    async def mark_all_as_read(self, user_id: uuid.UUID) -> None:
        """Mark all unread notifications of the user as read."""
        await self.db.execute(
            update(Notification)
            .where((Notification.user_id == user_id) & (Notification.is_read == False))
            .values(is_read=True)
        )

    async def get_by_id_and_user_id(self, notification_id: uuid.UUID, user_id: uuid.UUID) -> Notification | None:
        """Retrieve a specific notification belonging to the user."""
        result = await self.db.execute(
            select(Notification).where(
                (Notification.id == notification_id) & (Notification.user_id == user_id)
            )
        )
        return result.scalar_one_or_none()

    async def clear_all(self, user_id: uuid.UUID) -> None:
        """Delete all notifications of the user."""
        await self.db.execute(
            delete(Notification).where(Notification.user_id == user_id)
        )

    async def delete_by_id_and_user_id(self, notification_id: uuid.UUID, user_id: uuid.UUID) -> None:
        """Delete a specific notification belonging to the user."""
        await self.db.execute(
            delete(Notification).where(
                (Notification.id == notification_id) & (Notification.user_id == user_id)
            )
        )
