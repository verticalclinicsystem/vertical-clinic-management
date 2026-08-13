import pytest
from httpx import AsyncClient
from uuid import uuid4
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession

@pytest.mark.asyncio
async def test_receptionist_endpoints(client: AsyncClient):
    # 1. Login as admin to get token
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "admin@verticalclinic.com", "password": "Admin@verticalclinic.com"},
    )
    assert login_res.status_code == 200
    token_admin = login_res.json()["data"]["access_token"]

    # 2. Get branches to get a valid branch ID
    branches_res = await client.get("/api/v1/branches/")
    assert branches_res.status_code == 200
    branch_id = branches_res.json()["data"]["items"][0]["id"]

    # 3. Create a new user with receptionist role
    receptionist_email = f"new_recep_{uuid4().hex[:6]}@verticalclinic.com"
    user_payload = {
        "full_name": "Test Receptionist",
        "email": receptionist_email,
        "phone": "+919999911111",
        "password": "Password@123",
        "role": "receptionist",
        "branch_id": branch_id,
    }
    
    create_res = await client.post(
        "/api/v1/users/",
        json=user_payload,
        headers={"Authorization": f"Bearer {token_admin}"},
    )
    assert create_res.status_code == 201
    user_id = create_res.json()["data"]["id"]

    # 4. Fetch the receptionist profile created automatically by AuthService
    receps_res = await client.get(
        "/api/v1/receptionists/",
        headers={"Authorization": f"Bearer {token_admin}"},
    )
    assert receps_res.status_code == 200
    items = receps_res.json()["data"]["items"]
    
    # Find our receptionist profile
    profile = next((item for item in items if str(item["user_id"]) == user_id), None)
    assert profile is not None
    recep_id = profile["id"]

    # 5. Get receptionist details
    detail_res = await client.get(
        f"/api/v1/receptionists/{recep_id}",
        headers={"Authorization": f"Bearer {token_admin}"},
    )
    assert detail_res.status_code == 200
    assert detail_res.json()["data"]["employee_id"] == profile["employee_id"]

    # 6. Update receptionist profile
    update_payload = {
        "shift_start": "08:00",
        "shift_end": "16:00",
        "bio": "Experienced receptionist."
    }
    update_res = await client.put(
        f"/api/v1/receptionists/{recep_id}",
        json=update_payload,
        headers={"Authorization": f"Bearer {token_admin}"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["data"]["shift_start"] == "08:00"
    assert update_res.json()["data"]["bio"] == "Experienced receptionist."

    # 7. Delete (Deactivate) receptionist profile
    delete_res = await client.delete(
        f"/api/v1/receptionists/{recep_id}",
        headers={"Authorization": f"Bearer {token_admin}"},
    )
    assert delete_res.status_code == 200

    # Verify deactivation
    detail_res_after = await client.get(
        f"/api/v1/receptionists/{recep_id}",
        headers={"Authorization": f"Bearer {token_admin}"},
    )
    assert detail_res_after.status_code == 200
    assert detail_res_after.json()["data"]["is_active"] is False


@pytest.mark.asyncio
async def test_receptionist_overrides(client: AsyncClient, db_session: AsyncSession):
    # 1. Login as receptionist
    login_recep = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "receptionist@verticalclinic.com", "password": "Receptionist@123"},
    )
    assert login_recep.status_code == 200
    token_recep = login_recep.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token_recep}"}

    # 2. Login as patient to get patient ID
    login_patient = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    assert login_patient.status_code == 200
    token_patient = login_patient.json()["data"]["access_token"]
    patient_id = login_patient.json()["data"].get("id")
    if not patient_id:
        p_res = await client.get("/api/v1/patients/me", headers={"Authorization": f"Bearer {token_patient}"})
        patient_id = p_res.json()["data"]["id"]

    # 3. Get doctor details
    docs_res = await client.get("/api/v1/doctors/")
    doctor = docs_res.json()["data"]["items"][0]
    doctor_id = doctor["id"]
    branch_id = doctor["branch_id"]

    # Register a 2nd patient to avoid patient overlap checks on double-booking
    patient_email_2 = f"second_pat_{uuid4().hex[:6]}@example.com"
    register_pat_res = await client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Second Patient",
            "email": patient_email_2,
            "phone": f"+9199999{uuid4().int % 100000:05d}",
            "password": "Password@123",
        }
    )
    assert register_pat_res.status_code == 201

    # Manually verify the second patient in DB
    from app.models.user import User
    from sqlalchemy import select
    stmt = select(User).where(User.email == patient_email_2)
    res = await db_session.execute(stmt)
    user2 = res.scalar_one()
    user2.is_verified = True
    await db_session.commit()

    login_patient2 = await client.post(
        "/api/v1/auth/login",
        json={"identifier": patient_email_2, "password": "Password@123"},
    )
    assert login_patient2.status_code == 200
    token_patient2 = login_patient2.json()["data"]["access_token"]
    
    p2_res = await client.get("/api/v1/patients/me", headers={"Authorization": f"Bearer {token_patient2}"})
    patient_id_2 = p2_res.json()["data"]["id"]

    # 4. Out-of-Slot Booking (Custom time booking during Lunch hour 13:30)
    tomorrow_date = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
    custom_lunch_dt = f"{tomorrow_date}T13:30:00"

    book_lunch_res = await client.post(
        "/api/v1/appointments/",
        json={
            "doctor_id": doctor_id,
            "branch_id": branch_id,
            "appointment_datetime": custom_lunch_dt,
            "treatment_type": "Checkup",
            "consultation_type": "in_person",
            "notes": "Emergency lunch hour booking",
            "patient_id": patient_id
        },
        headers=headers
    )
    assert book_lunch_res.status_code == 201
    appt_id = book_lunch_res.json()["data"]["id"]

    # 5. Last-Minute Reschedule (2-Hour Buffer Bypass)
    one_hour_from_now = datetime.now(timezone.utc) + timedelta(hours=1)
    new_resched_dt = one_hour_from_now + timedelta(minutes=15)
    
    resched_res = await client.post(
        f"/api/v1/appointments/{appt_id}/reschedule",
        json={
            "new_datetime": new_resched_dt.isoformat(),
            "consultation_type": "teleconsultation"
        },
        headers=headers
    )
    assert resched_res.status_code == 200
    assert resched_res.json()["data"]["consultation_type"] == "teleconsultation"

    # 6. Unlimited Rescheduling (Reschedule Limit Bypass)
    new_resched_dt_2 = new_resched_dt + timedelta(minutes=15)
    resched_res = await client.post(
        f"/api/v1/appointments/{appt_id}/reschedule",
        json={"new_datetime": new_resched_dt_2.isoformat()},
        headers=headers
    )
    assert resched_res.status_code == 200

    new_resched_dt_3 = new_resched_dt_2 + timedelta(minutes=15)
    resched_res = await client.post(
        f"/api/v1/appointments/{appt_id}/reschedule",
        json={"new_datetime": new_resched_dt_3.isoformat()},
        headers=headers
    )
    assert resched_res.status_code == 200

    # 7. Double-Booking (Overlapping Appointments) - Now Blocked for everyone
    book_double_res = await client.post(
        "/api/v1/appointments/",
        json={
            "doctor_id": doctor_id,
            "branch_id": branch_id,
            "appointment_datetime": new_resched_dt_3.isoformat(),
            "treatment_type": "Checkup",
            "consultation_type": "in_person",
            "notes": "Double booked emergency checkup",
            "patient_id": patient_id_2
        },
        headers=headers
    )
    assert book_double_res.status_code == 400
    assert "already booked" in book_double_res.json()["message"]
