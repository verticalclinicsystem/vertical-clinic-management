"""
Invoice repository — database queries on the invoices table.
"""
from __future__ import annotations

import uuid
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.invoice import Invoice
from app.repositories.base import BaseRepository


class InvoiceRepository(BaseRepository[Invoice]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(Invoice, db)

    async def get_invoice_with_relations(self, invoice_id: uuid.UUID) -> Invoice | None:
        """Fetch single invoice with patient, user, consultation, treatment plan, and nested details preloaded."""
        from app.models.patient import Patient
        from app.models.consultation import Consultation
        from app.models.doctor import Doctor
        from app.models.prescription import Prescription, PrescriptionItem
        from app.models.treatment import TreatmentPlan, TreatmentProcedure
        from app.models.ipd import Admission, Bed, BedCategory
        
        stmt = (
            select(Invoice)
            .options(
                joinedload(Invoice.patient).joinedload(Patient.user),
                joinedload(Invoice.payments),
                joinedload(Invoice.consultation).joinedload(Consultation.doctor).joinedload(Doctor.user),
                joinedload(Invoice.consultation).joinedload(Consultation.prescriptions).joinedload(Prescription.items).joinedload(PrescriptionItem.medicine),
                joinedload(Invoice.treatment_plan).joinedload(TreatmentPlan.procedures),
                joinedload(Invoice.admission).joinedload(Admission.bed).joinedload(Bed.category)
            )
            .where(Invoice.id == invoice_id)
        )
        result = await self.db.execute(stmt)
        return result.unique().scalar_one_or_none()

    async def get_invoices_paginated(
        self,
        *,
        skip: int = 0,
        limit: int = 20,
        patient_id: uuid.UUID | None = None,
        status: str | None = None,
    ) -> tuple[list[Invoice], int]:
        """Fetch paginated & filtered invoices."""
        from app.models.patient import Patient
        filters = []
        if patient_id:
            filters.append(Invoice.patient_id == patient_id)
        if status:
            filters.append(Invoice.status == status)

        stmt = (
            select(Invoice)
            .options(
                joinedload(Invoice.patient).joinedload(Patient.user)
            )
            .where(and_(*filters) if filters else True)
            .order_by(Invoice.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        
        result = await self.db.execute(stmt)
        items = list(result.unique().scalars().all())

        count_stmt = select(func.count(Invoice.id)).where(and_(*filters) if filters else True)
        count_result = await self.db.execute(count_stmt)
        total = count_result.scalar_one()

        return items, total

    async def get_next_invoice_number(self) -> str:
        """Generate a sequential invoice number: INV-YYYYMMDD-XXXX."""
        from datetime import datetime, timezone
        today_str = datetime.now(timezone.utc).strftime("%Y%m%d")
        
        # Count invoices created today
        stmt = select(func.count(Invoice.id)).where(
            Invoice.invoice_number.like(f"INV-{today_str}-%")
        )
        result = await self.db.execute(stmt)
        count = result.scalar_one()
        
        seq_num = count + 1
        return f"INV-{today_str}-{seq_num:04d}"

    async def get_total_balance_due(self, patient_id: uuid.UUID) -> float:
        """Fetch total outstanding balance due for a patient."""
        stmt = (
            select(func.sum(Invoice.balance_due))
            .where(
                Invoice.patient_id == patient_id,
                Invoice.status.in_(["unpaid", "partially_paid"])
            )
        )
        res = await self.db.execute(stmt)
        return float(res.scalar() or 0.0)
