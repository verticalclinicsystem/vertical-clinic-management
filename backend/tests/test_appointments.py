import pytest
import uuid
from httpx import AsyncClient
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from app.models.appointment import Appointment
from app.models.patient import Patient
from app.models.doctor import Doctor

def get_next_weekday_slot(hour_offset=0):
    # Find next weekday (Monday=0 to Saturday=5)
    dt = datetime.now(timezone.utc) + timedelta(days=1)
    while dt.weekday() == 6:  # Skip Sunday
        dt += timedelta(days=1)
    # Start base at 09:30 AM IST (04:00 UTC)
    base_time = dt.replace(hour=4, minute=0, second=0, microsecond=0)
    return base_time + timedelta(hours=hour_offset)

async def clear_doctor_slots(client: AsyncClient, doctor):
    email = doctor["user"]["email"]
    password = "Doctor@verticalclinic.com"
    login_doc = await client.post(
        "/api/v1/auth/login",
        json={"identifier": email, "password": password},
    )
    token_doc = login_doc.json()["data"]["access_token"]
    await client.post(
        f"/api/v1/doctors/{doctor['id']}/slots",
        json=[],
        headers={"Authorization": f"Bearer {token_doc}"},
    )

@pytest.mark.asyncio
async def test_appointment_booking_and_dashboard_integration(client: AsyncClient):
    """Verify that a patient can book an appointment, and it appears in the dashboard."""
    # 1. Login as Priya Sharma (Patient)
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    token = login_res.json()["data"]["access_token"]

    # 2. Get doctors list to choose a doctor and branch
    docs_res = await client.get("/api/v1/doctors/")
    doctor = docs_res.json()["data"]["items"][0]
    doctor_id = doctor["id"]
    branch_id = doctor["branch_id"]

    # 3. Book an appointment for tomorrow (next weekday) at 09:30 AM IST
    booking_time = get_next_weekday_slot(hour_offset=0)
    booking_payload = {
        "doctor_id": doctor_id,
        "branch_id": branch_id,
        "appointment_datetime": booking_time.isoformat(),
        "treatment_type": "Braces Checkup",
        "consultation_type": "in_person",
        "notes": "Routine braces checkup.",
    }

    book_res = await client.post(
        "/api/v1/appointments/",
        json=booking_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert book_res.status_code == 201
    book_json = book_res.json()
    assert book_json["success"] is True
    assert book_json["data"]["treatment_type"] == "Braces Checkup"
    assert book_json["data"]["status"] == "confirmed"

    # 4. Verify in the Patient Dashboard that upcoming appointment count is updated
    dash_res = await client.get(
        "/api/v1/patients/me/dashboard",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert dash_res.status_code == 200
    dash_json = dash_res.json()
    assert dash_json["success"] is True
    assert dash_json["data"]["upcoming_appointments_count"] >= 1


@pytest.mark.asyncio
async def test_appointment_access_rules(client: AsyncClient, db_session):
    """Verify that only authorized roles can view or modify specific appointments."""
    # 1. Login as Priya (Patient)
    login_priya = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    token_priya = login_priya.json()["data"]["access_token"]

    # Get doctor details
    docs_res = await client.get("/api/v1/doctors/")
    doctor = docs_res.json()["data"]["items"][0]
    doctor_id = doctor["id"]
    branch_id = doctor["branch_id"]

    # Clear slots for doctor to bypass slot constraints
    await clear_doctor_slots(client, doctor)

    # 2. Book an appointment with offset=1 to avoid double-booking
    booking_time = get_next_weekday_slot(hour_offset=1)
    book_res = await client.post(
        "/api/v1/appointments/",
        json={
            "doctor_id": doctor_id,
            "branch_id": branch_id,
            "appointment_datetime": booking_time.isoformat(),
            "treatment_type": "Checkup",
            "consultation_type": "in_person",
        },
        headers={"Authorization": f"Bearer {token_priya}"},
    )
    assert book_res.status_code == 201
    appt_id = book_res.json()["data"]["id"]

    # 3. Try to access Priya's appointment with Admin
    login_admin = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "admin@verticalclinic.com", "password": "Admin@verticalclinic.com"},
    )
    token_admin = login_admin.json()["data"]["access_token"]

    admin_view = await client.get(
        f"/api/v1/appointments/{appt_id}",
        headers={"Authorization": f"Bearer {token_admin}"},
    )
    assert admin_view.status_code == 200
    assert admin_view.json()["data"]["id"] == appt_id

    # 4. Reschedule the appointment
    new_date = booking_time + timedelta(days=2)
    resched = await client.put(
        f"/api/v1/appointments/{appt_id}",
        json={"appointment_datetime": new_date.isoformat()},
        headers={"Authorization": f"Bearer {token_priya}"},
    )
    assert resched.status_code == 200
    new_date_resp = datetime.fromisoformat(resched.json()["data"]["appointment_datetime"].replace("Z", "+00:00"))
    assert abs((new_date_resp - new_date).total_seconds()) < 5


@pytest.mark.asyncio
async def test_appointment_cancellation_2_hour_rule(client: AsyncClient, db_session):
    """Verify that a patient cannot cancel an appointment scheduled less than 2 hours away."""
    # 1. Login as Priya (Patient)
    login_priya = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    token_priya = login_priya.json()["data"]["access_token"]

    # 2. Get details
    docs_res = await client.get("/api/v1/doctors/")
    doctor = docs_res.json()["data"]["items"][0]
    doctor_id = doctor["id"]
    branch_id = doctor["branch_id"]

    # Get patient ID
    patient_res = await client.get(
        "/api/v1/patients/me",
        headers={"Authorization": f"Bearer {token_priya}"},
    )
    patient_id = patient_res.json()["data"]["id"]

    # 3. Create appointment scheduled 1 hour from now directly in DB (to bypass working hours validation)
    appt_1h_id = uuid.uuid4()
    appt_1h = Appointment(
        id=appt_1h_id,
        patient_id=uuid.UUID(patient_id),
        doctor_id=uuid.UUID(doctor_id),
        branch_id=uuid.UUID(branch_id),
        appointment_datetime=datetime.now(timezone.utc) + timedelta(hours=1),
        treatment_type="Checkup",
        consultation_type="in_person",
        status="pending",
    )
    db_session.add(appt_1h)
    await db_session.commit()

    # Try to cancel -> should fail (400 Bad Request)
    cancel_1h = await client.put(
        f"/api/v1/appointments/{appt_1h_id}",
        json={"status": "cancelled"},
        headers={"Authorization": f"Bearer {token_priya}"},
    )
    assert cancel_1h.status_code == 400
    assert "within 2 hours" in cancel_1h.json()["message"]

    # 4. Create appointment scheduled 3 hours from now directly in DB
    appt_3h_id = uuid.uuid4()
    appt_3h = Appointment(
        id=appt_3h_id,
        patient_id=uuid.UUID(patient_id),
        doctor_id=uuid.UUID(doctor_id),
        branch_id=uuid.UUID(branch_id),
        appointment_datetime=datetime.now(timezone.utc) + timedelta(hours=3),
        treatment_type="Checkup",
        consultation_type="in_person",
        status="pending",
    )
    db_session.add(appt_3h)
    await db_session.commit()

    # Try to cancel -> should succeed (200 OK)
    cancel_3h = await client.put(
        f"/api/v1/appointments/{appt_3h_id}",
        json={"status": "cancelled"},
        headers={"Authorization": f"Bearer {token_priya}"},
    )
    assert cancel_3h.status_code == 200
    assert cancel_3h.json()["data"]["status"] == "cancelled"
    assert cancel_3h.json()["data"]["cancelled_by"] == "Patient"


@pytest.mark.asyncio
async def test_appointment_rescheduling_validation_rules(client: AsyncClient, db_session):
    """Verify rescheduling validation rules: max 2 times, and not within 2 hours of scheduled time."""
    # 1. Login as Priya (Patient)
    login_priya = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    token_priya = login_priya.json()["data"]["access_token"]

    # Get doctor details
    docs_res = await client.get("/api/v1/doctors/")
    doctor = docs_res.json()["data"]["items"][0]
    doctor_id = doctor["id"]
    branch_id = doctor["branch_id"]

    # Clear slots for doctor
    await clear_doctor_slots(client, doctor)

    # Get patient ID
    patient_res = await client.get(
        "/api/v1/patients/me",
        headers={"Authorization": f"Bearer {token_priya}"},
    )
    patient_id = patient_res.json()["data"]["id"]

    # 2. Create appointment scheduled 1.5 hours from now directly in DB
    appt_near_id = uuid.uuid4()
    appt_near = Appointment(
        id=appt_near_id,
        patient_id=uuid.UUID(patient_id),
        doctor_id=uuid.UUID(doctor_id),
        branch_id=uuid.UUID(branch_id),
        appointment_datetime=datetime.now(timezone.utc) + timedelta(hours=1.5),
        treatment_type="Checkup",
        consultation_type="in_person",
        status="pending",
    )
    db_session.add(appt_near)
    await db_session.commit()

    # Rescheduling this near appointment should fail because it is less than 2 hours away
    new_time_target = get_next_weekday_slot(hour_offset=3)
    resched_near = await client.put(
        f"/api/v1/appointments/{appt_near_id}",
        json={"appointment_datetime": new_time_target.isoformat()},
        headers={"Authorization": f"Bearer {token_priya}"},
    )
    assert resched_near.status_code == 400
    assert "within 2 hours" in resched_near.json()["message"]

    # 3. Create appointment scheduled 5 hours from now directly in DB
    appt_id = uuid.uuid4()
    appt = Appointment(
        id=appt_id,
        patient_id=uuid.UUID(patient_id),
        doctor_id=uuid.UUID(doctor_id),
        branch_id=uuid.UUID(branch_id),
        appointment_datetime=datetime.now(timezone.utc) + timedelta(hours=5),
        treatment_type="Checkup",
        consultation_type="in_person",
        status="pending",
    )
    db_session.add(appt)
    await db_session.commit()

    # 4. Now, reschedule the appointment (5 hours from now) - Reschedule 1 (using offset=2)
    new_time_1 = get_next_weekday_slot(hour_offset=2)
    resched_1 = await client.put(
        f"/api/v1/appointments/{appt_id}",
        json={"appointment_datetime": new_time_1.isoformat()},
        headers={"Authorization": f"Bearer {token_priya}"},
    )
    assert resched_1.status_code == 200
    assert resched_1.json()["data"]["reschedule_count"] == 1

    # Reschedule 2 (using offset=3)
    new_time_2 = get_next_weekday_slot(hour_offset=3)
    resched_2 = await client.put(
        f"/api/v1/appointments/{appt_id}",
        json={"appointment_datetime": new_time_2.isoformat()},
        headers={"Authorization": f"Bearer {token_priya}"},
    )
    assert resched_2.status_code == 200
    assert resched_2.json()["data"]["reschedule_count"] == 2

    # Reschedule 3 -> should fail because max limit is 2
    new_time_3 = get_next_weekday_slot(hour_offset=4)
    resched_3 = await client.put(
        f"/api/v1/appointments/{appt_id}",
        json={"appointment_datetime": new_time_3.isoformat()},
        headers={"Authorization": f"Bearer {token_priya}"},
    )
    assert resched_3.status_code == 400
    assert "Maximum reschedule limit" in resched_3.json()["message"]


@pytest.mark.asyncio
async def test_appointment_slots_and_double_booking(client: AsyncClient):
    """Verify that slot restrictions and double booking validations are correctly enforced."""
    # 1. Login as doctor (Dr. Rohan Mehta)
    login_doc = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "doctor@verticalclinic.com", "password": "Doctor@verticalclinic.com"},
    )
    token_doc = login_doc.json()["data"]["access_token"]

    # Get Rohan's ID
    docs_res = await client.get("/api/v1/doctors/")
    rohan_doc = next(d for d in docs_res.json()["data"]["items"] if "Rohan" in d["user"]["full_name"])
    rohan_id = rohan_doc["id"]
    branch_id = rohan_doc["branch_id"]

    # 2. Configure slots for Rohan: weekday=0 (Monday), 09:00 - 10:00, 30 min duration
    set_slots = await client.post(
        f"/api/v1/doctors/{rohan_id}/slots",
        json=[
            {"weekday": 0, "start_time": "09:00", "end_time": "10:00", "slot_duration_minutes": 30}
        ],
        headers={"Authorization": f"Bearer {token_doc}"},
    )
    assert set_slots.status_code == 200

    # 3. Query available slots for a Monday (e.g. 2026-07-20 is a Monday)
    slots_res = await client.get(
        f"/api/v1/appointments/available-slots?doctor_id={rohan_id}&date=2026-07-20"
    )
    assert slots_res.status_code == 200
    assert slots_res.json()["data"] == [
        {"time": "09:00", "status": "available"},
        {"time": "09:30", "status": "available"}
    ]

    # Verify query works when correct branch_id is supplied
    slots_res_branch = await client.get(
        f"/api/v1/appointments/available-slots?doctor_id={rohan_id}&date=2026-07-20&branch_id={branch_id}"
    )
    assert slots_res_branch.status_code == 200

    # Verify query fails (400 Bad Request) when mismatching branch_id is supplied
    slots_res_mismatch = await client.get(
        f"/api/v1/appointments/available-slots?doctor_id={rohan_id}&date=2026-07-20&branch_id={str(uuid.uuid4())}"
    )
    assert slots_res_mismatch.status_code == 400

    # 4. Login as Priya (Patient)
    login_priya = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    token_priya = login_priya.json()["data"]["access_token"]

    # Book valid slot (Monday 09:00 AM IST = 03:30 AM UTC)
    booking_dt = datetime(2026, 7, 20, 3, 30, tzinfo=timezone.utc)
    res_valid = await client.post(
        "/api/v1/appointments/",
        json={
            "doctor_id": rohan_id,
            "branch_id": branch_id,
            "appointment_datetime": booking_dt.isoformat(),
            "treatment_type": "Checkup",
            "consultation_type": "in_person",
        },
        headers={"Authorization": f"Bearer {token_priya}"},
    )
    assert res_valid.status_code == 201

    # Try booking at invalid time (Monday 09:15 AM IST = 03:45 AM UTC)
    booking_invalid_time = datetime(2026, 7, 20, 3, 45, tzinfo=timezone.utc)
    res_invalid_time = await client.post(
        "/api/v1/appointments/",
        json={
            "doctor_id": rohan_id,
            "branch_id": branch_id,
            "appointment_datetime": booking_invalid_time.isoformat(),
            "treatment_type": "Checkup",
            "consultation_type": "in_person",
        },
        headers={"Authorization": f"Bearer {token_priya}"},
    )
    assert res_invalid_time.status_code == 400
    assert "not within the doctor's available slots" in res_invalid_time.json()["message"]

    # Try booking exact same slot -> should fail due to double booking
    res_double = await client.post(
        "/api/v1/appointments/",
        json={
            "doctor_id": rohan_id,
            "branch_id": branch_id,
            "appointment_datetime": booking_dt.isoformat(),
            "treatment_type": "Checkup",
            "consultation_type": "in_person",
        },
        headers={"Authorization": f"Bearer {token_priya}"},
    )
    assert res_double.status_code == 400
    assert "already booked" in res_double.json()["message"]


@pytest.mark.asyncio
async def test_appointment_transitions_and_special_views(client: AsyncClient, db_session):
    """Verify state transitions and specialized queries (today, waiting-queue, calendar)."""
    # 1. Login as admin (acting as staff)
    login_staff = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "admin@verticalclinic.com", "password": "Admin@verticalclinic.com"},
    )
    token_staff = login_staff.json()["data"]["access_token"]

    # 2. Get doctors list
    docs_res = await client.get("/api/v1/doctors/")
    rohan = next(d for d in docs_res.json()["data"]["items"] if "Rohan" in d["user"]["full_name"])
    rohan_id = rohan["id"]
    branch_id = rohan["branch_id"]

    # 3. Create appointment directly in DB
    login_priya = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    token_priya = login_priya.json()["data"]["access_token"]
    patient_id = login_priya.json()["data"]["id"] if "id" in login_priya.json()["data"] else None
    
    if not patient_id:
        p_res = await client.get("/api/v1/patients/me", headers={"Authorization": f"Bearer {token_priya}"})
        patient_id = p_res.json()["data"]["id"]

    # Today at 11:00 AM UTC
    today_dt = datetime.now(timezone.utc).replace(hour=11, minute=0, second=0, microsecond=0)
    appt_id = uuid.uuid4()
    appt = Appointment(
        id=appt_id,
        patient_id=uuid.UUID(patient_id),
        doctor_id=uuid.UUID(rohan_id),
        branch_id=uuid.UUID(branch_id),
        appointment_datetime=today_dt,
        treatment_type="Cleaning",
        consultation_type="in_person",
        status="pending",
    )
    db_session.add(appt)
    await db_session.commit()

    # 4. Perform Transition Flow
    # Confirm
    conf = await client.patch(
        f"/api/v1/appointments/{appt_id}/confirm",
        headers={"Authorization": f"Bearer {token_staff}"},
    )
    assert conf.status_code == 200
    assert conf.json()["data"]["status"] == "confirmed"

    # Check-in
    ci = await client.patch(
        f"/api/v1/appointments/{appt_id}/check-in",
        headers={"Authorization": f"Bearer {token_staff}"},
    )
    assert ci.status_code == 200
    assert ci.json()["data"]["status"] == "checked_in"

    # Check that it appears in waiting queue
    wq = await client.get(
        "/api/v1/appointments/waiting-queue",
        headers={"Authorization": f"Bearer {token_staff}"},
    )
    assert wq.status_code == 200
    assert len(wq.json()["data"]) >= 1

    # Start
    login_doc = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "doctor@verticalclinic.com", "password": "Doctor@verticalclinic.com"},
    )
    token_doc = login_doc.json()["data"]["access_token"]
    start = await client.patch(
        f"/api/v1/appointments/{appt_id}/start",
        headers={"Authorization": f"Bearer {token_doc}"},
    )
    assert start.status_code == 200
    assert start.json()["data"]["status"] == "in_consultation"

    # Complete
    comp = await client.patch(
        f"/api/v1/appointments/{appt_id}/complete",
        headers={"Authorization": f"Bearer {token_doc}"},
    )
    assert comp.status_code == 200
    assert comp.json()["data"]["status"] == "completed"

    # 5. Verify today's appointments
    today_res = await client.get(
        "/api/v1/appointments/today",
        headers={"Authorization": f"Bearer {token_priya}"},
    )
    assert today_res.status_code == 200
    assert len(today_res.json()["data"]) >= 1


@pytest.mark.asyncio
async def test_patient_can_reschedule_appointment_via_patch(client: AsyncClient, db_session):
    """Verify that a patient can reschedule an appointment using PATCH /appointments/{id}/reschedule."""
    # 1. Login as patient
    login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    token = login.json()["data"]["access_token"]
    patient_id = login.json()["data"]["id"] if "id" in login.json()["data"] else None
    
    if not patient_id:
        p_res = await client.get("/api/v1/patients/me", headers={"Authorization": f"Bearer {token}"})
        patient_id = p_res.json()["data"]["id"]

    # 2. Get doctor details
    docs_res = await client.get("/api/v1/doctors/")
    doctor = docs_res.json()["data"]["items"][0]
    doctor_id = doctor["id"]
    branch_id = doctor["branch_id"]

    # Clear slots for doctor
    await clear_doctor_slots(client, doctor)

    # 3. Create appointment directly in DB
    tomorrow = get_next_weekday_slot(hour_offset=1)
    appt_id = uuid.uuid4()
    appt = Appointment(
        id=appt_id,
        patient_id=uuid.UUID(patient_id),
        doctor_id=uuid.UUID(doctor_id),
        branch_id=uuid.UUID(branch_id),
        appointment_datetime=tomorrow,
        treatment_type="Checkup",
        consultation_type="in_person",
        status="pending",
    )
    db_session.add(appt)
    await db_session.commit()

    # 4. Reschedule using PATCH /appointments/{id}/reschedule
    new_time = tomorrow + timedelta(hours=1)
    resched = await client.patch(
        f"/api/v1/appointments/{appt_id}/reschedule",
        json={"new_datetime": new_time.isoformat()},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resched.status_code == 200
    resched_data = resched.json()["data"]
    
    # Parse returned time
    returned_time = datetime.fromisoformat(resched_data["appointment_datetime"].replace("Z", "+00:00"))
    assert abs((returned_time - new_time).total_seconds()) < 5


@pytest.mark.asyncio
async def test_sunday_working_hours_validation(client: AsyncClient):
    """Verify Sunday working hours validation rules (09:00 AM - 02:00 PM IST)."""
    # 1. Login as Priya (Patient)
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    token = login_res.json()["data"]["access_token"]

    # 2. Get doctor details
    docs_res = await client.get("/api/v1/doctors/")
    doctor = docs_res.json()["data"]["items"][0]
    doctor_id = doctor["id"]
    branch_id = doctor["branch_id"]

    # 3. Query slots on a Sunday (2026-07-19 is a Sunday)
    slots_res = await client.get(
        f"/api/v1/appointments/available-slots?doctor_id={doctor_id}&date=2026-07-19"
    )
    assert slots_res.status_code == 200
    slots_data = slots_res.json()["data"]
    # Sunday slots should be present and within 09:00 - 14:00 (last start time is 12:30 due to 13:00-14:00 lunch break)
    assert len(slots_data) > 0
    times = [s["time"] for s in slots_data]
    assert "09:00" in times
    assert "12:30" in times
    assert "13:30" in times
    assert next(s for s in slots_data if s["time"] == "13:30")["status"] == "lunch_break"
    assert "14:00" not in times
    assert "15:00" not in times

    # 4. Try booking a valid Sunday slot (e.g. 10:00 AM IST = 04:30 AM UTC on Sunday 2026-07-19)
    valid_sunday_dt = datetime(2026, 7, 19, 4, 30, tzinfo=timezone.utc)
    res_valid = await client.post(
        "/api/v1/appointments/",
        json={
            "doctor_id": doctor_id,
            "branch_id": branch_id,
            "appointment_datetime": valid_sunday_dt.isoformat(),
            "treatment_type": "Checkup",
            "consultation_type": "in_person",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_valid.status_code == 201

    # 5. Try booking an invalid Sunday slot (e.g. 06:00 PM IST = 12:30 PM UTC on Sunday 2026-07-19)
    # This is outside the 09:00 AM - 02:00 PM Sunday window
    invalid_sunday_dt = datetime(2026, 7, 19, 12, 30, tzinfo=timezone.utc)
    res_invalid = await client.post(
        "/api/v1/appointments/",
        json={
            "doctor_id": doctor_id,
            "branch_id": branch_id,
            "appointment_datetime": invalid_sunday_dt.isoformat(),
            "treatment_type": "Checkup",
            "consultation_type": "in_person",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_invalid.status_code == 400
    assert "working hours on Sunday" in res_invalid.json()["message"]


@pytest.mark.asyncio
async def test_receptionist_booking_flexibility_override(client: AsyncClient, db_session):
    """Verify that a receptionist can bypass scheduling constraints such as lead time, Sunday working hours, double bookings, etc."""
    # 1. Login as Priya (Patient) to get patient profile id
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    token_patient = login_res.json()["data"]["access_token"]
    p_res = await client.get("/api/v1/patients/me", headers={"Authorization": f"Bearer {token_patient}"})
    patient_id = p_res.json()["data"]["id"]

    # 2. Login as receptionist (acting as staff)
    login_recep = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "receptionist@verticalclinic.com", "password": "Receptionist@123"},
    )
    assert login_recep.status_code == 200
    token_recep = login_recep.json()["data"]["access_token"]

    # 3. Get doctor details
    docs_res = await client.get("/api/v1/doctors/")
    doctor = docs_res.json()["data"]["items"][0]
    doctor_id = doctor["id"]
    branch_id = doctor["branch_id"]

    # Try to book a Sunday slot outside clinic hours for this patient as a receptionist
    # This should be allowed and return 201 Created (normally fails for patient)
    sunday_invalid_dt = datetime(2026, 7, 19, 12, 30, tzinfo=timezone.utc) # 6 PM IST Sunday
    res_recep_booking = await client.post(
        "/api/v1/appointments/",
        json={
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "branch_id": branch_id,
            "appointment_datetime": sunday_invalid_dt.isoformat(),
            "treatment_type": "Emergency Checkup",
            "consultation_type": "in_person",
        },
        headers={"Authorization": f"Bearer {token_recep}"},
    )
    assert res_recep_booking.status_code == 201
    appt_id = res_recep_booking.json()["data"]["id"]

    # Now reschedule the appointment to a time less than 2 hours away or reschedule multiple times
    # A receptionist should be able to reschedule without 2-hour buffer error or count constraints
    now_dt = datetime.now(timezone.utc) + timedelta(minutes=45)
    res_recep_resched = await client.put(
        f"/api/v1/appointments/{appt_id}",
        json={"appointment_datetime": now_dt.isoformat()},
        headers={"Authorization": f"Bearer {token_recep}"},
    )
    assert res_recep_resched.status_code == 200
    assert res_recep_resched.json()["data"]["reschedule_count"] == 1

