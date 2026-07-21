"""
User repository — queries and write operations on the users table.
All DB interaction lives here; the service layer only calls these methods.
"""
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(User, db)

    # ── Lookups ────────────────────────────────────────────────────────────────
    async def get_by_email(self, email: str) -> User | None:
        result = await self.db.execute(
            select(User).where(User.email == email.lower().strip())
        )
        return result.scalar_one_or_none()

    async def get_by_phone(self, phone: str) -> User | None:
        result = await self.db.execute(
            select(User).where(User.phone == phone)
        )
        return result.scalar_one_or_none()

    async def get_by_identifier(self, identifier: str) -> User | None:
        """Look up by email or phone depending on whether '@' is present."""
        if "@" in identifier:
            return await self.get_by_email(identifier)
        return await self.get_by_phone(identifier)

    async def get_by_role(self, role: str) -> list[User]:
        result = await self.db.execute(
            select(User).where(User.role == role, User.is_active == True)  # noqa: E712
        )
        return list(result.scalars().all())

    async def email_exists(self, email: str) -> bool:
        return await self.exists(
            [User.email == email.lower().strip()]
        )

    async def phone_exists(self, phone: str) -> bool:
        return await self.exists([User.phone == phone])

    # ── Write operations ───────────────────────────────────────────────────────
    async def create_patient_user(
        self,
        *,
        full_name: str,
        email: str,
        phone: str,
        hashed_password: str,
    ) -> User:
        """Create an unverified patient account."""
        return await self.create({
            "full_name": full_name.strip(),
            "email": email.lower().strip(),
            "phone": phone,
            "hashed_password": hashed_password,
            "role": "patient",
            "is_active": True,
            "is_verified": False,
        })

    async def create_staff_user(
        self,
        *,
        full_name: str,
        email: str,
        phone: str,
        hashed_password: str,
        role: str,
        branch_id: uuid.UUID | None = None,
    ) -> User:
        """Create a pre-verified staff account (admin, doctor, receptionist, pharmacist)."""
        return await self.create({
            "full_name": full_name.strip(),
            "email": email.lower().strip(),
            "phone": phone,
            "hashed_password": hashed_password,
            "role": role,
            "branch_id": branch_id,
            "is_active": True,
            "is_verified": True,
        })

    async def activate(self, user: User) -> User:
        """Mark the user's email as verified and activate the account."""
        return await self.update(user, {"is_verified": True})

    async def update_last_login(self, user: User) -> User:
        """Stamp last_login_at with the current UTC time."""
        return await self.update(user, {"last_login_at": datetime.now(UTC)})

    async def update_password(self, user: User, hashed_password: str) -> User:
        """Replace the stored password hash."""
        return await self.update(user, {"hashed_password": hashed_password})

    async def update_profile(
        self,
        user: User,
        *,
        full_name: str | None = None,
        phone: str | None = None,
        avatar_url: str | None = None,
    ) -> User:
        """
        Partially update profile fields.
        Only non-None values are written to the DB.
        """
        updates: dict = {}
        if full_name is not None:
            updates["full_name"] = full_name.strip()
        if phone is not None:
            updates["phone"] = phone
        if avatar_url is not None:
            updates["avatar_url"] = avatar_url
        if updates:
            return await self.update(user, updates)
        return user
