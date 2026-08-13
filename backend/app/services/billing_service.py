"""
Billing service — handles business logic and validations for clinic invoices.
"""
from __future__ import annotations

import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import PatientNotFoundError, PermissionDeniedError
from app.models.invoice import Invoice
from app.repositories.invoice_repo import InvoiceRepository
from app.repositories.patient_repo import PatientRepository
from app.schemas.invoice import InvoiceCreate, InvoiceUpdate

logger = logging.getLogger(__name__)


class BillingService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.invoice_repo = InvoiceRepository(db)
        self.patient_repo = PatientRepository(db)

    async def create_invoice(self, request: InvoiceCreate) -> Invoice:
        """Create a new invoice for a patient."""
        # 1. Verify patient exists
        patient = await self.patient_repo.get_by_id(request.patient_id)
        if not patient:
            raise PatientNotFoundError()

        # 2. Generate unique invoice number
        invoice_number = await self.invoice_repo.get_next_invoice_number()

        # 3. Calculate totals
        grand_total = max(0.0, request.total_amount - request.discount_amount + request.tax_amount)
        
        # Support multiple selected admission IDs
        import json
        adm_ids = [str(i) for i in request.admission_ids] if request.admission_ids else ([] if not request.admission_id else [str(request.admission_id)])
        primary_adm_id = adm_ids[0] if adm_ids else request.admission_id
        adm_ids_json = json.dumps(adm_ids) if adm_ids else None

        invoice_data = {
            "patient_id": request.patient_id,
            "consultation_id": request.consultation_id,
            "treatment_plan_id": request.treatment_plan_id,
            "admission_id": primary_adm_id,
            "admission_ids_json": adm_ids_json,
            "invoice_number": invoice_number,
            "total_amount": request.total_amount,
            "discount_amount": request.discount_amount,
            "tax_amount": request.tax_amount,
            "grand_total": grand_total,
            "amount_paid": 0.0,
            "balance_due": grand_total,
            "status": "unpaid",
        }

        created = await self.invoice_repo.create(invoice_data)
        await self.db.commit()
        logger.info(f"Invoice created successfully: {created.invoice_number}")

        # Send Invoice notification to patient
        try:
            from app.services.notification_service import NotificationService
            noti_service = NotificationService(self.db)
            await noti_service.send_multichannel_notification(
                user_id=patient.user_id,
                title="Invoice Generated",
                message=f"A new invoice ({invoice_number}) of {grand_total} has been generated for your clinic visit.",
                type="billing"
            )
        except Exception as e:
            logger.error(f"Failed to send invoice notification: {e}")

        # Automatically email the beautiful invoice and PDF to the patient
        try:
            await self.send_invoice_email_to_patient(created.id)
        except Exception as e:
            logger.error(f"Failed to auto-email invoice: {e}")

        return await self.get_invoice(created.id)

    async def send_invoice_email_to_patient(self, invoice_id: uuid.UUID) -> bool:
        """Generate PDF invoice and send a beautiful email to the patient."""
        invoice = await self.get_invoice(invoice_id)
        if not invoice:
            return False

        patient_email = invoice.patient.user.email
        if not patient_email:
            logger.warning(f"Patient {invoice.patient.id} does not have a registered email address.")
            return False

        status_mapping = {
            "paid": "paid",
            "unpaid": "unpaid",
            "partially_paid": "partial"
        }
        status_class = status_mapping.get(invoice.status, "unpaid")
        
        pdf_items = []
        
        # 1. Consultation Fee
        if invoice.consultation:
            fee = invoice.consultation.doctor.consultation_fee or 500.0
            pdf_items.append({
                "description": f"Consultation Fee - Dr. {invoice.consultation.doctor.user.full_name}",
                "amount": float(fee)
            })
            
            # 2. Prescriptions / Medicines
            from app.api.v1.billing import calculate_medicine_qty
            for presc in invoice.consultation.prescriptions:
                for item in presc.items:
                    qty = item.quantity if (hasattr(item, "quantity") and item.quantity is not None) else calculate_medicine_qty(item.dosage, item.duration)
                    price = 10.0
                    if item.medicine:
                        price = item.medicine.unit_price or 10.0
                    total = qty * price
                    pdf_items.append({
                        "description": f"Medicine: {item.medicine_name} ({qty} units)",
                        "amount": float(total)
                    })

        # 3. Treatment Plan Procedures
        if invoice.treatment_plan:
            for proc in invoice.treatment_plan.procedures:
                if proc.status == "completed":
                    pdf_items.append({
                        "description": f"Procedure: {proc.procedure_name}",
                        "amount": float(proc.cost)
                    })

        # 4. IPD Bed Stay & Charges
        if invoice.admission:
            adm = invoice.admission
            from datetime import datetime, timezone
            end_t = adm.discharge_datetime or datetime.now(timezone.utc)
            hours_stay = max(0.5, (end_t - adm.admission_datetime).total_seconds() / 3600.0)
            bed = adm.bed
            if bed and bed.category:
                days = int(hours_stay // 24)
                rem_h = hours_stay % 24
                if days == 0:
                    rent = bed.category.base_charge_24h
                else:
                    overtime = rem_h * bed.category.hourly_overtime_rate if rem_h > 2.0 else 0.0
                    rent = (days * bed.category.base_charge_24h) + overtime
                pdf_items.append({
                    "description": f"IPD Bed Stay: {bed.bed_number} ({bed.category.name}) - {round(hours_stay, 1)} hours",
                    "amount": float(round(rent, 2))
                })

            # Fetch past transferred bed bill items
            from sqlalchemy import select
            from app.models.ipd import IpdBillItem
            past_res = await self.db.execute(select(IpdBillItem).where(IpdBillItem.admission_id == adm.id))
            past_items = past_res.scalars().all()
            for item in past_items:
                pdf_items.append({
                    "description": item.item_name,
                    "amount": float(item.total_price)
                })

            if adm.initial_deposit > 0:
                pdf_items.append({
                    "description": "Less: Initial Admission Deposit Paid",
                    "amount": float(-adm.initial_deposit)
                })
            if adm.insurance_approved_amount > 0:
                pdf_items.append({
                    "description": "Less: Insurance Approved Credit",
                    "amount": float(-adm.insurance_approved_amount)
                })

        # 5. Clinical Materials / Used Things
        if invoice.treatment_plan:
            completed_count = sum(1 for p in invoice.treatment_plan.procedures if p.status == "completed")
            if completed_count > 0:
                pdf_items.append({
                    "description": "Used Dental Materials & Sterile Consumables",
                    "amount": completed_count * 200.0
                })
        elif invoice.consultation and not invoice.admission:
            pdf_items.append({
                "description": "Clinical Materials & Sterile Consumables",
                "amount": 150.0
            })
        
        invoice_data = {
            "invoice_number": invoice.invoice_number,
            "date": invoice.created_at.strftime("%Y-%m-%d"),
            "status": invoice.status.replace("_", " ").title(),
            "status_class": status_class,
            "patient_name": invoice.patient.user.full_name,
            "patient_code": invoice.patient.patient_code,
            "patient_phone": invoice.patient.emergency_contact_phone or "N/A",
            "branch_name": "Vertical Clinic System - Main",
            "branch_address": "123, Medical Square, Ahmedabad, Gujarat",
            "branch_phone": "+91 99999 88888",
            "items": pdf_items,
            "total_amount": float(invoice.total_amount),
            "discount_amount": float(invoice.discount_amount),
            "tax_amount": float(invoice.tax_amount),
            "grand_total": float(invoice.grand_total),
            "amount_paid": float(invoice.amount_paid),
            "balance_due": float(invoice.balance_due),
        }

        from app.utils.pdf_generator import generate_invoice_pdf
        pdf_bytes = generate_invoice_pdf(invoice_data)

        from datetime import datetime
        generated_time = datetime.now().strftime("%m/%d/%Y, %I:%M:%S %p")

        pay_mode = "UPI / Cash"
        if getattr(invoice, 'payments', None) and len(invoice.payments) > 0:
            pay_mode = getattr(invoice.payments[0], 'payment_method', 'UPI / Cash')

        status_bg = "#dcfce7" if invoice.status == "paid" else "#fee2e2" if invoice.status == "cancelled" else "#fef3c7"
        status_color = "#15803d" if invoice.status == "paid" else "#b91c1c" if invoice.status == "cancelled" else "#d97706"
        status_text = invoice.status.replace("_", " ").title()

        discount_row_html = ""
        if invoice.discount_amount and float(invoice.discount_amount) > 0:
            discount_row_html = f"<tr><td align='left' style='padding: 4px 0;'>Discount:</td><td align='right' style='padding: 4px 0;'>- ₹{float(invoice.discount_amount):.2f}</td></tr>"

        tax_row_html = ""
        if invoice.tax_amount and float(invoice.tax_amount) > 0:
            tax_row_html = f"<tr><td align='left' style='padding: 4px 0;'>Tax:</td><td align='right' style='padding: 4px 0;'>₹{float(invoice.tax_amount):.2f}</td></tr>"

        table_rows_html = ""
        for item in pdf_items:
            table_rows_html += (
                f"<tr>"
                f"<td align='left' style='font-size: 13px; color: #334155; border-bottom: 1px solid #f1f5f9; padding: 10px 8px;'>{item['description']}</td>"
                f"<td align='right' style='font-size: 13px; color: #0f172a; font-weight: 600; border-bottom: 1px solid #f1f5f9; padding: 10px 8px;'>₹{item['amount']:.2f}</td>"
                f"</tr>"
            )

        balance_color = "#15803d" if float(invoice.balance_due) == 0 else "#b91c1c"

        from app.utils.email import send_email
        subject = f"Invoice {invoice.invoice_number} from Vertical Clinic"
        plain_body = (
            f"Dear {invoice.patient.user.full_name},\n\n"
            f"Please find attached your invoice {invoice.invoice_number} for your recent visit at Vertical Clinic.\n"
            f"Grand Total: ₹{invoice.grand_total:.2f}\n"
            f"Amount Paid: ₹{invoice.amount_paid:.2f}\n"
            f"Balance Due: ₹{invoice.balance_due:.2f}\n\n"
            f"Thank you for choosing Vertical Clinic.\n\n"
            f"Best regards,\n"
            f"Vertical Clinic Team"
        )
        html_body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Invoice from Vertical Clinic</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:12px;
                      box-shadow:0 4px 20px rgba(0,0,0,0.08);overflow:hidden;text-align:left;">
          
          <!-- Header Container -->
          <tr>
            <td style="padding:32px 40px 16px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <!-- Left: Logo and Brand info -->
                  <td>
                    <h1 style="margin:0;color:#0e7490;font-size:24px;font-weight:800;letter-spacing:-0.5px;">
                      🏥 VERTICAL CLINIC
                    </h1>
                    <p style="margin:4px 0 0;color:#64748b;font-size:12px;font-weight:500;">
                      Smart Healthcare & Multi-Branch Clinic System
                    </p>
                  </td>
                  <!-- Right: Meta info -->
                  <td align="right" style="vertical-align:bottom;text-align:right;color:#64748b;font-size:11px;line-height:1.5;">
                    <div><strong>Generated:</strong> {generated_time}</div>
                    <div><strong>Issued By:</strong> Clinic Administration</div>
                  </td>
                </tr>
              </table>
              <!-- Divider Line -->
              <div style="border-bottom:3px solid #0e7490;margin-top:16px;"></div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:20px 40px 36px 40px;">
              <h2 style="margin:0 0 16px;color:#0f172a;font-size:18px;font-weight:700;">
                Invoice {invoice.invoice_number}
              </h2>
              <p style="margin:0 0 24px;color:#334155;font-size:15px;line-height:1.6;">
                Dear <strong>{invoice.patient.user.full_name}</strong>,
              </p>
              <p style="margin:0 0 24px;color:#334155;font-size:15px;line-height:1.6;">
                Please find attached your digital invoice copy for your recent consultation/visit at <strong>Vertical Clinic</strong>. Below is a summary of your bill details.
              </p>

              <!-- Bill Info Cards / Meta Grid -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td width="32%" style="background:#f8fafc;padding:12px 16px;border-radius:8px;border:1px solid #e2e8f0;vertical-align:top;">
                    <div style="font-size:10px;color:#64748b;text-transform:uppercase;margin-bottom:4px;font-weight:600;">Date</div>
                    <div style="font-size:13px;color:#0f172a;font-weight:700;">{invoice.created_at.strftime("%Y-%m-%d")}</div>
                  </td>
                  <td width="2%"></td>
                  <td width="32%" style="background:#f8fafc;padding:12px 16px;border-radius:8px;border:1px solid #e2e8f0;vertical-align:top;">
                    <div style="font-size:10px;color:#64748b;text-transform:uppercase;margin-bottom:4px;font-weight:600;">Payment Method</div>
                    <div style="font-size:13px;color:#0f172a;font-weight:700;">{pay_mode}</div>
                  </td>
                  <td width="2%"></td>
                  <td width="32%" style="background:#f8fafc;padding:12px 16px;border-radius:8px;border:1px solid #e2e8f0;vertical-align:top;">
                    <div style="font-size:10px;color:#64748b;text-transform:uppercase;margin-bottom:4px;font-weight:600;">Status</div>
                    <div>
                      <span style="font-size:11px;font-weight:700;padding:2px 6px;border-radius:4px;text-transform:uppercase;background:{status_bg};color:{status_color};display:inline-block;margin-top:2px;">
                        {status_text}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Detailed Items Table -->
              <h3 style="margin:0 0 12px;color:#0f172a;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">
                Bill Breakdown
              </h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:28px;border-collapse:collapse;">
                <thead>
                  <tr style="background:#f1f5f9;">
                    <th align="left" style="font-size:12px;color:#475569;font-weight:600;border-bottom:1px solid #e2e8f0;padding:10px 8px;">Description</th>
                    <th align="right" style="font-size:12px;color:#475569;font-weight:600;border-bottom:1px solid #e2e8f0;padding:10px 8px;width:120px;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {table_rows_html}
                </tbody>
              </table>

              <!-- Totals Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td width="55%"></td>
                  <td width="45%">
                    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#334155;line-height:1.5;">
                      <tr>
                        <td align="left" style="padding: 4px 0;">Total Amount:</td>
                        <td align="right" style="padding: 4px 0;">₹{float(invoice.total_amount):.2f}</td>
                      </tr>
                      {discount_row_html}
                      {tax_row_html}
                      <tr style="font-weight:700;color:#0f172a;font-size:16px;">
                        <td align="left" style="padding: 8px 0;border-top:1px solid #e2e8f0;">Grand Total:</td>
                        <td align="right" style="padding: 8px 0;border-top:1px solid #e2e8f0;">₹{float(invoice.grand_total):.2f}</td>
                      </tr>
                      <tr style="color:#059669;">
                        <td align="left" style="padding: 4px 0;">Amount Paid:</td>
                        <td align="right" style="padding: 4px 0;">- ₹{float(invoice.amount_paid):.2f}</td>
                      </tr>
                      <tr style="font-weight:700;color:{balance_color};">
                        <td align="left" style="padding: 6px 0;border-top:1px double #e2e8f0;">Balance Due:</td>
                        <td align="right" style="padding: 6px 0;border-top:1px double #e2e8f0;">₹{float(invoice.balance_due):.2f}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Thank you block -->
              <p style="margin:0;color:#334155;font-size:15px;line-height:1.6;font-weight:600;text-align:center;">
                Thank you for choosing Vertical Clinic.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.5;">
                Report generated automatically from Vertical Clinic System
              </p>
              <p style="margin:4px 0 0;color:#94a3b8;font-size:11px;">
                This is an automated message — please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

        attachments = [
            (f"invoice_{invoice.invoice_number}.pdf", pdf_bytes, "application/pdf")
        ]

        try:
            await send_email(
                to=patient_email,
                subject=subject,
                html_body=html_body,
                plain_body=plain_body,
                attachments=attachments
            )
            return True
        except Exception as e:
            logger.error(f"Failed to send invoice email in helper: {e}")
            return False

    async def get_invoice(self, invoice_id: uuid.UUID) -> Invoice:
        """Fetch single invoice with details."""
        invoice = await self.invoice_repo.get_invoice_with_relations(invoice_id)
        if not invoice:
            from app.core.exceptions import BaseAPIException
            class InvoiceNotFoundError(BaseAPIException):
                def __init__(self):
                    super().__init__(
                        status_code=404,
                        error_code="INVOICE_NOT_FOUND",
                        message="Invoice not found."
                    )
            raise InvoiceNotFoundError()
        return invoice

    async def list_invoices(
        self,
        *,
        page: int = 1,
        limit: int = 20,
        patient_id: uuid.UUID | None = None,
        status: str | None = None,
    ) -> tuple[list[Invoice], int]:
        """Fetch paginated & filtered list of invoices."""
        skip = (page - 1) * limit
        return await self.invoice_repo.get_invoices_paginated(
            skip=skip,
            limit=limit,
            patient_id=patient_id,
            status=status,
        )

    async def update_invoice(
        self,
        invoice_id: uuid.UUID,
        request: InvoiceUpdate,
    ) -> Invoice:
        """Update invoice details."""
        invoice = await self.get_invoice(invoice_id)

        update_data = request.model_dump(exclude_unset=True)
        
        # If amounts are updated, recalculate grand total and balance due
        total = update_data.get("total_amount", invoice.total_amount)
        discount = update_data.get("discount_amount", invoice.discount_amount)
        tax = update_data.get("tax_amount", invoice.tax_amount)
        
        grand_total = max(0.0, total - discount + tax)
        balance_due = max(0.0, grand_total - invoice.amount_paid)

        update_data["grand_total"] = grand_total
        update_data["balance_due"] = balance_due

        # If balance due is 0, make sure status is paid (unless cancelled)
        current_status = update_data.get("status", invoice.status)
        if current_status != "cancelled":
            if balance_due <= 0:
                update_data["status"] = "paid"
            elif invoice.amount_paid > 0:
                update_data["status"] = "partially_paid"
            else:
                update_data["status"] = "unpaid"

        updated = await self.invoice_repo.update(invoice, update_data)
        await self.db.commit()
        logger.info(f"Invoice updated: {updated.invoice_number}")
        return await self.get_invoice(updated.id)
