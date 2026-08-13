import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_public_can_list_and_search_doctors(client: AsyncClient):
    """Anyone (public/patient) should be able to list and search doctors."""
    # 1. List all doctors
    response = await client.get("/api/v1/doctors/")
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["success"] is True
    assert len(res_json["data"]["items"]) >= 1
    assert res_json["data"]["total"] >= 1

    # 2. Search by specialization
    response_search = await client.get("/api/v1/doctors/?search=Orthodontist")
    assert response_search.status_code == 200
    res_search_json = response_search.json()
    assert len(res_search_json["data"]["items"]) == 1
    assert res_search_json["data"]["items"][0]["specialization"] == "Orthodontist"
    assert "Rohan Mehta" in res_search_json["data"]["items"][0]["user"]["full_name"]


@pytest.mark.asyncio
async def test_get_doctor_profile_by_id(client: AsyncClient):
    """Retrieve details of a single doctor profile."""
    # List first to get ID
    list_res = await client.get("/api/v1/doctors/")
    doctor_id = list_res.json()["data"]["items"][0]["id"]

    response = await client.get(f"/api/v1/doctors/{doctor_id}")
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["success"] is True
    assert res_json["data"]["id"] == doctor_id
    assert "user" in res_json["data"]
    assert "slots" in res_json["data"]


@pytest.mark.asyncio
async def test_doctor_update_profile(client: AsyncClient):
    """Doctors should be able to update their own profiles; patients cannot."""
    # 1. Login as Dr. Rohan Mehta
    login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "doctor@verticalclinic.com", "password": "Doctor@verticalclinic.com"},
    )
    token = login.json()["data"]["access_token"]

    # Get Rohan's doctor ID
    list_res = await client.get("/api/v1/doctors/")
    rohan_doc = next(d for d in list_res.json()["data"]["items"] if "Rohan" in d["user"]["full_name"])
    rohan_id = rohan_doc["id"]

    # 2. Update bio & fee
    update_res = await client.put(
        f"/api/v1/doctors/{rohan_id}",
        json={
            "bio": "Expert in pediatric and adult orthodontics.",
            "consultation_fee": 1000.0,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["data"]["bio"] == "Expert in pediatric and adult orthodontics."
    assert update_res.json()["data"]["consultation_fee"] == 1000.0

    # 3. Patient tries to update Dr. Rohan's profile -> Forbidden (403)
    patient_login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    patient_token = patient_login.json()["data"]["access_token"]
    
    forbidden_res = await client.put(
        f"/api/v1/doctors/{rohan_id}",
        json={"consultation_fee": 0.0},
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    assert forbidden_res.status_code == 403


@pytest.mark.asyncio
async def test_doctor_slot_management(client: AsyncClient):
    """Doctors/Admins can retrieve and bulk set slot availability."""
    # 1. Login as Dr. Rohan Mehta
    login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "doctor@verticalclinic.com", "password": "Doctor@verticalclinic.com"},
    )
    token = login.json()["data"]["access_token"]

    # Get Rohan's ID
    list_res = await client.get("/api/v1/doctors/")
    rohan_doc = next(d for d in list_res.json()["data"]["items"] if "Rohan" in d["user"]["full_name"])
    rohan_id = rohan_doc["id"]

    # 2. Set slots (Monday 09:00 - 13:00, Friday 14:00 - 18:00)
    slots_payload = [
        {"weekday": 0, "start_time": "09:00", "end_time": "13:00", "slot_duration_minutes": 30},
        {"weekday": 4, "start_time": "14:00", "end_time": "18:00", "slot_duration_minutes": 30},
    ]
    set_res = await client.post(
        f"/api/v1/doctors/{rohan_id}/slots",
        json=slots_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert set_res.status_code == 200
    slots_data = set_res.json()["data"]
    assert len(slots_data) == 2
    assert slots_data[0]["weekday"] == 0
    assert slots_data[1]["weekday"] == 4

    # 3. Retrieve slots publicly
    get_res = await client.get(f"/api/v1/doctors/{rohan_id}/slots")
    assert get_res.status_code == 200
    assert len(get_res.json()["data"]) == 2


@pytest.mark.asyncio
async def test_doctor_dashboard(client: AsyncClient):
    """Verify that a doctor can retrieve their dashboard overview successfully."""
    # 1. Login as Dr. Rohan Mehta
    login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "doctor@verticalclinic.com", "password": "Doctor@verticalclinic.com"},
    )
    assert login.status_code == 200
    token = login.json()["data"]["access_token"]

    # 2. Query Doctor Dashboard
    res = await client.get(
        "/api/v1/doctors/me/dashboard",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    res_data = res.json()
    assert res_data["success"] is True
    
    data = res_data["data"]
    assert "analytics" in data
    assert "today_appointments" in data
    assert "patient_queue" in data
    assert "recent_consultations" in data

    analytics = data["analytics"]
    assert "patients_treated_today" in analytics
    assert "upcoming_appointments" in analytics
    assert "completed_consultations" in analytics
    assert "tele_consultations_completed" in analytics
    assert "pending_follow_ups" in analytics


@pytest.mark.asyncio
async def test_doctor_followups(client: AsyncClient):
    """Verify that a doctor can retrieve their follow-ups list successfully."""
    # 1. Login as Dr. Rohan Mehta
    login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "doctor@verticalclinic.com", "password": "Doctor@verticalclinic.com"},
    )
    assert login.status_code == 200
    token = login.json()["data"]["access_token"]

    # 2. Query Doctor Follow-ups
    res = await client.get(
        "/api/v1/doctors/me/follow-ups",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    res_data = res.json()
    assert res_data["success"] is True
    assert "pending" in res_data["data"]
    assert "booked" in res_data["data"]

