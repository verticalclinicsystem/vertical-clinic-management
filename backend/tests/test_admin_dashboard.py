import pytest
from httpx import AsyncClient
from datetime import datetime, timezone

@pytest.mark.asyncio
async def test_admin_dashboard_staff_status_lifecycle(client: AsyncClient):
    # 1. Login as Admin
    login_response = await client.post(
        "/api/v1/auth/login",
        json={
            "identifier": "admin@verticalclinic.com",
            "password": "Admin@verticalclinic.com",
        },
    )
    assert login_response.status_code == 200
    access_token = login_response.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # 2. Get Dashboard Data
    dash_response = await client.get("/api/v1/admin/dashboard", headers=headers)
    assert dash_response.status_code == 200
    dash_data = dash_response.json()
    assert dash_data["success"] is True
    
    staff = dash_data["data"]["staff"]
    assert len(staff) > 0
    
    # Verify staff structure contains status, suspension_reason, suspended_until
    first_member = staff[0]
    assert "status" in first_member
    assert "suspension_reason" in first_member
    assert "suspended_until" in first_member
    assert first_member["status"] in ("active", "inactive", "suspended")

    # Find the doctor's user id (let's assume doctor@verticalclinic.com exists from seeds)
    doctor_member = next((s for s in staff if s["email"] == "doctor@verticalclinic.com"), None)
    assert doctor_member is not None
    doctor_user_id = doctor_member["id"]
    assert doctor_member["status"] == "active"

    # 3. Suspend Doctor
    suspend_response = await client.post(
        f"/api/v1/users/{doctor_user_id}/suspend",
        json={"duration_days": 3, "reason": "Test suspension"},
        headers=headers
    )
    assert suspend_response.status_code == 200

    # 4. Check dashboard again, verify doctor is reported as suspended
    dash_response2 = await client.get("/api/v1/admin/dashboard", headers=headers)
    assert dash_response2.status_code == 200
    staff2 = dash_response2.json()["data"]["staff"]
    doctor_member2 = next((s for s in staff2 if s["id"] == doctor_user_id), None)
    assert doctor_member2 is not None
    assert doctor_member2["status"] == "suspended"
    assert doctor_member2["suspension_reason"] == "Test suspension"
    assert doctor_member2["suspended_until"] is not None

    # 5. Unsuspend Doctor
    unsuspend_response = await client.post(
        f"/api/v1/users/{doctor_user_id}/suspend",
        json={"action": "unsuspend"},
        headers=headers
    )
    assert unsuspend_response.status_code == 200

    # 6. Check dashboard again, verify doctor is active
    dash_response3 = await client.get("/api/v1/admin/dashboard", headers=headers)
    assert dash_response3.status_code == 200
    staff3 = dash_response3.json()["data"]["staff"]
    doctor_member3 = next((s for s in staff3 if s["id"] == doctor_user_id), None)
    assert doctor_member3 is not None
    assert doctor_member3["status"] == "active"
    assert doctor_member3["suspension_reason"] is None
    assert doctor_member3["suspended_until"] is None
