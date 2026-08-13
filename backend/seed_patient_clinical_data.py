import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from app.db.session import AsyncSessionLocal
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.appointment import Appointment
from app.models.consultation import Consultation
from app.models.prescription import Prescription, PrescriptionItem
from app.models.medical_report import MedicalReport
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.teleconsult import TeleConsultation
from sqlalchemy import select

async def seed():
    async with AsyncSessionLocal() as db:
        # Find doctor
        doc_stmt = select(Doctor)
        doc_res = await db.execute(doc_stmt)
        doctor = doc_res.scalars().first()
        if not doctor:
            print("No doctor found! Run reset_db.py first.")
            return

        # Find patient
        pat_stmt = select(Patient)
        pat_res = await db.execute(pat_stmt)
        patient = pat_res.scalars().first()
        if not patient:
            print("No patient found! Run reset_db.py first.")
            return

        print(f"Seeding clinical records for Patient: {patient.patient_code} under Doctor: Dr. Rohan Mehta")

        # 1. Past Consultations
        today = datetime.now(timezone.utc)
        
        # Consultation 1 (15 days ago)
        c1 = Consultation(
            id=uuid.uuid4(),
            patient_id=patient.id,
            doctor_id=doctor.id,
            branch_id=doctor.branch_id,
            consultation_datetime=today - timedelta(days=15),
            symptoms="Mild toothache on lower left molar, sensitivity to cold beverages.",
            diagnosis="Incipient dental caries on tooth #37 (occlusal surface). No root exposure.",
            notes="Advised restoration (composite filling) and fluoride mouthwash twice daily.",
            vitals_bp="118/76",
            vitals_pulse=72,
            vitals_temperature=98.4
        )
        db.add(c1)
        await db.flush()

        # Consultation 2 (5 days ago)
        c2 = Consultation(
            id=uuid.uuid4(),
            patient_id=patient.id,
            doctor_id=doctor.id,
            branch_id=doctor.branch_id,
            consultation_datetime=today - timedelta(days=5),
            symptoms="Orthodontic checkup. Routine monthly follow-up.",
            diagnosis="Malocclusion Class I. Braces alignment progressing as expected.",
            notes="Tightened upper archwire. Elastic band usage continued. Next checkup in 4 weeks.",
            vitals_bp="120/80",
            vitals_pulse=70,
            vitals_temperature=98.6
        )
        db.add(c2)
        await db.flush()

        # 2. Prescriptions
        # Prescription 1 (for c1)
        p1 = Prescription(
            id=uuid.uuid4(),
            consultation_id=c1.id,
            patient_id=patient.id,
            doctor_id=doctor.id,
            notes="Take medicines after meals. Use soft brush.",
            status="Active"
        )
        db.add(p1)
        await db.flush()

        pi1 = PrescriptionItem(
            id=uuid.uuid4(),
            prescription_id=p1.id,
            medicine_name="Amoxicillin 500mg",
            dosage="1-0-1",
            duration="5 days",
            instructions="After food"
        )
        pi2 = PrescriptionItem(
            id=uuid.uuid4(),
            prescription_id=p1.id,
            medicine_name="Ibuprofen 400mg",
            dosage="1-0-1",
            duration="3 days",
            instructions="After food, only if pain persists"
        )
        db.add(pi1)
        db.add(pi2)

        # 3. Medical Reports
        r1 = MedicalReport(
            id=uuid.uuid4(),
            patient_id=patient.id,
            report_type="X-Ray",
            report_name="OPG Dental Panoramic X-Ray",
            file_url="/uploads/report_80f90602523f4f71a4c318d492a80e45.pdf"
        )
        r2 = MedicalReport(
            id=uuid.uuid4(),
            patient_id=patient.id,
            report_type="Blood Test",
            report_name="Complete Blood Count",
            file_url="/uploads/report_80f90602523f4f71a4c318d492a80e45.pdf"
        )
        db.add(r1)
        db.add(r2)

        # 4. Invoices and Payments
        # Invoice 1 (Paid)
        inv1 = Invoice(
            id=uuid.uuid4(),
            patient_id=patient.id,
            consultation_id=c1.id,
            invoice_number="INV-2026-0001",
            total_amount=1200.00,
            discount_amount=100.00,
            tax_amount=198.00,
            grand_total=1298.00,
            amount_paid=1298.00,
            balance_due=0.00,
            status="paid"
        )
        db.add(inv1)
        await db.flush()

        pay1 = Payment(
            id=uuid.uuid4(),
            invoice_id=inv1.id,
            patient_id=patient.id,
            payment_number="PAY-2026-0001",
            amount=1298.00,
            payment_method="cash",
            payment_status="completed",
            transaction_reference="TXN-982104"
        )
        db.add(pay1)

        # Invoice 2 (Partially Paid)
        inv2 = Invoice(
            id=uuid.uuid4(),
            patient_id=patient.id,
            consultation_id=c2.id,
            invoice_number="INV-2026-0002",
            total_amount=2500.00,
            discount_amount=0.00,
            tax_amount=450.00,
            grand_total=2950.00,
            amount_paid=1000.00,
            balance_due=1950.00,
            status="partially_paid"
        )
        db.add(inv2)
        await db.flush()

        pay2 = Payment(
            id=uuid.uuid4(),
            invoice_id=inv2.id,
            patient_id=patient.id,
            payment_number="PAY-2026-0002",
            amount=1000.00,
            payment_method="card",
            payment_status="completed",
            transaction_reference="TXN-982105"
        )
        db.add(pay2)

        # 5. Teleconsultation linking
        # Find teleconsultation type appointment
        appt_stmt = select(Appointment).filter(Appointment.consultation_type == "teleconsultation")
        appt_res = await db.execute(appt_stmt)
        appt = appt_res.scalars().first()
        if appt:
            tele = TeleConsultation(
                id=uuid.uuid4(),
                appointment_id=appt.id,
                meeting_url="https://meet.jit.si/VerticalClinicConsultation",
                start_time=today - timedelta(hours=1),
                end_time=today + timedelta(hours=1),
                expiry_time=today + timedelta(hours=2),
                status="Ready",
                meeting_link_sent=True
            )
            db.add(tele)
            print("Seeded TeleConsultation link.")

        await db.commit()
        print("Successfully seeded all patient medical history, prescriptions, invoices, and diagnostics!")

if __name__ == "__main__":
    asyncio.run(seed())
