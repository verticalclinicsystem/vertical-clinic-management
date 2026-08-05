"""
Inventory service — business logic for medicine stock management.
"""
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.inventory_repo import InventoryRepository
from app.models.inventory import Medicine, StockTransaction
from app.schemas.inventory import MedicineCreate


class InventoryService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = InventoryRepository(db)

    async def list_medicines(self, page: int = 1, limit: int = 100) -> tuple[list[Medicine], int]:
        """Fetch paginated medicines list."""
        skip = (page - 1) * limit
        return await self.repo.get_medicines_paginated(skip, limit)

    async def create_medicine(self, request: MedicineCreate) -> Medicine:
        """Create a new medicine entry in the database."""
        med_id = uuid.uuid4()
        medicine_data = {
            "id": med_id,
            **request.model_dump()
        }
        medicine = await self.repo.create(medicine_data)
        await self.db.commit()
        return medicine

    async def list_purchase_orders(self, limit: int = 50) -> list[dict]:
        """Fetch stock-in (purchase) transactions transformed for UI cards."""
        rows = await self.repo.list_purchase_transactions(limit)
        orders = []
        for txn, med in rows:
            orders.append({
                "id": str(txn.id),
                "medicine_name": med.name,
                "supplier": med.supplier or "Unknown",
                "quantity": txn.change_qty,
                "unit": med.unit,
                "amount": round(txn.change_qty * med.unit_price, 2),
                "status": "Received",
                "date": txn.created_at.strftime("%d %b %Y"),
                "notes": txn.notes or "",
            })
        return orders
