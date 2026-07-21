import pytest
from httpx import AsyncClient
from uuid import uuid4

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
