"""
Generic async CRUD repository.
All domain-specific repositories extend this class.
"""
from __future__ import annotations

import uuid
from typing import Any, Generic, TypeVar

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    """
    Provides generic create / read / update / delete operations for any model.
    Domain repos inherit this and add model-specific query methods.
    """

    def __init__(self, model: type[ModelType], db: AsyncSession) -> None:
        self.model = model
        self.db = db

    async def get_by_id(self, record_id: uuid.UUID) -> ModelType | None:
        result = await self.db.execute(
            select(self.model).where(self.model.id == record_id)  # type: ignore[attr-defined]
        )
        return result.scalar_one_or_none()

    async def get_all(
        self,
        *,
        skip: int = 0,
        limit: int = 50,
        filters: list[Any] | None = None,
        order_by: Any = None,
    ) -> list[ModelType]:
        query = select(self.model)
        if filters:
            for f in filters:
                query = query.where(f)
        if order_by is not None:
            query = query.order_by(order_by)
        query = query.offset(skip).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count(self, filters: list[Any] | None = None) -> int:
        query = select(func.count()).select_from(self.model)
        if filters:
            for f in filters:
                query = query.where(f)
        result = await self.db.execute(query)
        return result.scalar_one()

    async def create(self, obj_in: dict[str, Any]) -> ModelType:
        db_obj = self.model(**obj_in)
        self.db.add(db_obj)
        await self.db.flush()          # get DB-generated values (e.g. id)
        await self.db.refresh(db_obj)
        return db_obj

    async def update(
        self, db_obj: ModelType, update_data: dict[str, Any]
    ) -> ModelType:
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        self.db.add(db_obj)
        await self.db.flush()
        await self.db.refresh(db_obj)
        return db_obj

    async def delete(self, db_obj: ModelType) -> None:
        await self.db.delete(db_obj)
        await self.db.flush()

    async def exists(self, filters: list[Any]) -> bool:
        query = select(func.count()).select_from(self.model)
        for f in filters:
            query = query.where(f)
        result = await self.db.execute(query)
        return (result.scalar_one() or 0) > 0
