"""
Payment service — handles business logic and validations for clinic payments.
"""
from __future__ import annotations

import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError
from app.models.payment import Payment
from app.repositories.payment_repo import PaymentRepository
from app.repositories.invoice_repo import InvoiceRepository
from app.schemas.payment import PaymentCreate

logger = logging.getLogger(__name__)


class PaymentService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.payment_repo = PaymentRepository(db)
        self.invoice_repo = InvoiceRepository(db)

    async def create_payment(self, request: PaymentCreate) -> Payment:
        """Create a new payment and update the linked invoice status."""
        # 1. Fetch the invoice
        from app.services.billing_service import BillingService
        billing_service = BillingService(self.db)
        invoice = await billing_service.get_invoice(request.invoice_id)

        # 2. Validation checks
        if invoice.status == "cancelled":
            raise BadRequestError("Cannot pay a cancelled invoice.")
        if invoice.status == "paid" or invoice.balance_due <= 0:
            raise BadRequestError("Invoice is already fully paid.")
        
        # We permit payments up to the balance due (and cap it if they pay extra)
        payment_amount = request.amount
        if payment_amount > invoice.balance_due:
            raise BadRequestError(f"Payment amount ({payment_amount:.2f}) exceeds the balance due ({invoice.balance_due:.2f}).")

        # 3. Generate unique payment number
        payment_number = await self.payment_repo.get_next_payment_number()

        # 4. Create payment transaction record
        payment_data = {
            "invoice_id": request.invoice_id,
            "patient_id": invoice.patient_id,
            "payment_number": payment_number,
            "amount": payment_amount,
            "payment_method": request.payment_method,
            "payment_status": "completed",
            "transaction_reference": request.transaction_reference,
        }
        
        payment = await self.payment_repo.create(payment_data)

        # 5. Update invoice amounts
        new_amount_paid = float(invoice.amount_paid) + float(payment_amount)
        new_balance_due = max(0.0, float(invoice.grand_total) - new_amount_paid)

        invoice_update_data = {
            "amount_paid": new_amount_paid,
            "balance_due": new_balance_due,
        }

        # Determine new invoice status
        if new_balance_due <= 0:
            invoice_update_data["status"] = "paid"
        else:
            invoice_update_data["status"] = "partially_paid"

        await self.invoice_repo.update(invoice, invoice_update_data)

        await self.db.commit()
        logger.info(f"Payment {payment_number} logged successfully against Invoice {invoice.invoice_number}")
        
        return payment

    async def get_payment(self, payment_id: uuid.UUID) -> Payment:
        """Fetch single payment details."""
        payment = await self.payment_repo.get_by_id(payment_id)
        if not payment:
            from app.core.exceptions import BaseAPIException
            class PaymentNotFoundError(BaseAPIException):
                def __init__(self):
                    super().__init__(
                        status_code=404,
                        error_code="PAYMENT_NOT_FOUND",
                        message="Payment record not found."
                    )
            raise PaymentNotFoundError()
        return payment

    async def list_payments(
        self,
        *,
        page: int = 1,
        limit: int = 20,
        patient_id: uuid.UUID | None = None,
        invoice_id: uuid.UUID | None = None,
    ) -> tuple[list[Payment], int]:
        """Fetch paginated & filtered list of payments."""
        skip = (page - 1) * limit
        return await self.payment_repo.get_payments_paginated(
            skip=skip,
            limit=limit,
            patient_id=patient_id,
            invoice_id=invoice_id,
        )
