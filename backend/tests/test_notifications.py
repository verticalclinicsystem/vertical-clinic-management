import pytest
import uuid
from httpx import AsyncClient
from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.models.user import User

@pytest.mark.asyncio
async def test_notifications_flow(client: AsyncClient, db_session: AsyncSession):
    # 1. Login as patient
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    token = login_res.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Get user id of patient
    stmt = select(User).where(User.email == "patient@verticalclinic.com")
    res = await db_session.execute(stmt)
    user = res.scalar_one()

    # Create dummy notification in DB for patient
    notification = Notification(
        user_id=user.id,
        title="Test Notification",
        message="This is a test notification message",
        type="general",
        is_read=False
    )
    db_session.add(notification)
    await db_session.commit()

    # 2. Get notifications list
    list_res = await client.get("/api/v1/notifications", headers=headers)
    assert list_res.status_code == 200
    list_json = list_res.json()
    assert list_json["success"] is True
    assert len(list_json["data"]) >= 1
    
    # Find our notification in the returned list
    noti_data = next((n for n in list_json["data"] if n["id"] == str(notification.id)), None)
    assert noti_data is not None
    assert noti_data["title"] == "Test Notification"
    assert noti_data["message"] == "This is a test notification message"
    assert noti_data["is_read"] is False

    # 3. Mark notification as read
    read_res = await client.patch(f"/api/v1/notifications/{notification.id}/read", headers=headers)
    assert read_res.status_code == 200
    read_json = read_res.json()
    assert read_json["success"] is True
    assert read_json["data"]["is_read"] is True

    # 4. Create another dummy notification
    notification2 = Notification(
        user_id=user.id,
        title="Test Notification 2",
        message="This is another test notification",
        type="general",
        is_read=False
    )
    db_session.add(notification2)
    await db_session.commit()

    # Verify we have at least one unread notification
    list_res = await client.get("/api/v1/notifications", headers=headers)
    unread_exists = any(not n["is_read"] for n in list_res.json()["data"])
    assert unread_exists is True

    # 5. Mark all as read
    all_res = await client.patch("/api/v1/notifications/read-all", headers=headers)
    assert all_res.status_code == 200
    assert all_res.json()["success"] is True

    # 6. Verify all are read now
    list_res = await client.get("/api/v1/notifications", headers=headers)
    assert all(n["is_read"] for n in list_res.json()["data"]) is True


@pytest.mark.asyncio
async def test_automated_notifications_triggers(client: AsyncClient, db_session: AsyncSession):
    # 1. Login as admin to retrieve auth and profile structures
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "admin@verticalclinic.com", "password": "Admin@verticalclinic.com"},
    )
    admin_token = login_res.json()["data"]["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Get user id of patient
    stmt = select(User).where(User.email == "patient@verticalclinic.com")
    res = await db_session.execute(stmt)
    patient_user = res.scalar_one()

    # Get patient profile id
    from app.models.patient import Patient
    patient_stmt = select(Patient).where(Patient.user_id == patient_user.id)
    patient_res = await db_session.execute(patient_stmt)
    patient_profile = patient_res.scalar_one()

    # Get doctor profile id
    from app.models.doctor import Doctor
    doc_stmt = select(Doctor)
    doc_res = await db_session.execute(doc_stmt)
    doctor_profile = doc_res.scalars().first()

    # 3. Trigger invoice creation
    from app.schemas.invoice import InvoiceCreate
    from app.services.billing_service import BillingService
    billing_service = BillingService(db_session)
    invoice = await billing_service.create_invoice(
        InvoiceCreate(
            patient_id=patient_profile.id,
            total_amount=500.0,
            discount_amount=0.0,
            tax_amount=0.0
        )
    )

    # Verify notification created
    stmt = select(Notification).where(
        Notification.user_id == patient_user.id,
        Notification.title == "Invoice Generated"
    )
    noti_res = await db_session.execute(stmt)
    assert noti_res.scalars().first() is not None

    # 4. Trigger payment creation
    from app.schemas.payment import PaymentCreate
    from app.services.payment_service import PaymentService
    payment_service = PaymentService(db_session)
    await payment_service.create_payment(
        PaymentCreate(
            invoice_id=invoice.id,
            amount=100.0,
            payment_method="cash",
            transaction_reference="TXN-12345"
        )
    )

    # Verify notification created
    stmt = select(Notification).where(
        Notification.user_id == patient_user.id,
        Notification.title == "Payment Received"
    )
    noti_res = await db_session.execute(stmt)
    assert noti_res.scalars().first() is not None

    # 5. Trigger prescription creation
    from app.models.consultation import Consultation
    from datetime import datetime, timezone
    cons_stmt = select(Consultation)
    cons_res = await db_session.execute(cons_stmt)
    consultation = cons_res.scalars().first()
    if not consultation:
        consultation = Consultation(
            patient_id=patient_profile.id,
            doctor_id=doctor_profile.id,
            branch_id=doctor_profile.branch_id if hasattr(doctor_profile, 'branch_id') else patient_profile.preferred_branch_id,
            consultation_datetime=datetime.now(timezone.utc),
            symptoms="Fever",
            diagnosis="Viral Fever",
            notes="Rest and hydration"
        )
        db_session.add(consultation)
        await db_session.commit()

    from app.schemas.prescription import PrescriptionCreate, PrescriptionItemCreate
    from app.services.prescription_service import PrescriptionService
    presc_service = PrescriptionService(db_session)
    await presc_service.create_prescription(
        PrescriptionCreate(
            consultation_id=consultation.id,
            patient_id=patient_profile.id,
            doctor_id=doctor_profile.id,
            items=[
                PrescriptionItemCreate(
                    medicine_name="Paracetamol",
                    dosage="1-0-1",
                    duration="3 days",
                    quantity=6
                )
            ]
        )
    )

    # Verify notification created
    stmt = select(Notification).where(
        Notification.user_id == patient_user.id,
        Notification.title == "New Prescription Added"
    )
    noti_res = await db_session.execute(stmt)
    assert noti_res.scalars().first() is not None

    # 6. Trigger medical report creation
    from app.services.medical_report_service import MedicalReportService
    report_service = MedicalReportService(db_session)
    await report_service.create_report(
        user_id=patient_user.id,
        report_type="Blood Test",
        report_name="CBC_Report.pdf",
        file_url="https://example.com/reports/cbc.pdf"
    )

    # Verify notification created
    stmt = select(Notification).where(
        Notification.user_id == patient_user.id,
        Notification.title == "Medical Report Uploaded"
    )
    noti_res = await db_session.execute(stmt)
    assert noti_res.scalars().first() is not None


@pytest.mark.asyncio
async def test_doctor_delay_broadcast(client: AsyncClient, db_session: AsyncSession):
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "receptionist@verticalclinic.com", "password": "Receptionist@123"},
    )
    token = login_res.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get a doctor
    from app.models.doctor import Doctor
    doc_res = await db_session.execute(select(Doctor))
    doctor = doc_res.scalars().first()
    assert doctor is not None

    # 3. Call delay broadcast endpoint
    delay_res = await client.post(
        f"/api/v1/appointments/doctor/{doctor.id}/delay",
        json={"delay_minutes": 45},
        headers=headers
    )
    assert delay_res.status_code == 200
    res_data = delay_res.json()
    assert res_data["success"] is True
    assert "notified_count" in res_data["data"]


@pytest.mark.asyncio
async def test_queue_token_assignment(client: AsyncClient, db_session: AsyncSession):
    # 1. Login as patient
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    token = login_res.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get a doctor and branch
    docs_res = await client.get("/api/v1/doctors/")
    doctor = docs_res.json()["data"]["items"][0]
    doctor_id = doctor["id"]
    branch_id = doctor["branch_id"]

    # Clear slots for doctor to bypass slot constraints
    from tests.test_appointments import clear_doctor_slots, get_next_weekday_slot
    await clear_doctor_slots(client, doctor)

    # 3. Create appointment
    booking_time = get_next_weekday_slot(hour_offset=8)
    booking_res = await client.post(
        "/api/v1/appointments/",
        json={
            "doctor_id": doctor_id,
            "branch_id": branch_id,
            "appointment_datetime": booking_time.isoformat(),
            "treatment_type": "Checkup",
            "consultation_type": "in_person",
            "notes": "Regular medical health checkup"
        },
        headers=headers
    )
    assert booking_res.status_code == 201
    booking_json = booking_res.json()
    assert booking_json["success"] is True
    assert booking_json["data"]["token_number"] is not None
    assert booking_json["data"]["token_number"] >= 1


