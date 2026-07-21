"""
Unit tests for Branch Management API endpoints.
"""
import pytest
from httpx import AsyncClient


async def get_auth_headers(client: AsyncClient, email: str, password: str) -> dict[str, str]:
    """Helper to login and return auth headers."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"identifier": email, "password": password},
    )
    assert response.status_code == 200
    token = response.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_create_branch_admin_success(client: AsyncClient):
    """Admin should be able to create a branch with valid data."""
    headers = await get_auth_headers(client, "admin@verticalclinic.com", "Admin@verticalclinic.com")
    response = await client.post(
        "/api/v1/branches/",
        headers=headers,
        json={
            "name": "Testing Branch",
            "code": "TESTING",
            "address": "123 Test Street",
            "city": "Ahmedabad",
            "phone": "+919999911111",
            "email": "testing@suvidhadental.com",
            "gst_number": "24AACCS1234K1ZP",
        },
    )
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["name"] == "Testing Branch"
    assert data["code"] == "TESTING"
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_create_branch_duplicate_code_rejected(client: AsyncClient):
    """Creating a branch with an existing branch code should return 409 Conflict."""
    headers = await get_auth_headers(client, "admin@verticalclinic.com", "Admin@verticalclinic.com")
    
    # "SAT" is seeded by default
    response = await client.post(
        "/api/v1/branches/",
        headers=headers,
        json={
            "name": "Satellite Duplicate",
            "code": "SAT",  # Seeded code
            "address": "456 Test Street",
            "city": "Ahmedabad",
            "phone": "+919999922222",
            "email": "satdup@suvidhadental.com",
            "gst_number": "24AACCS1234K1ZP",
        },
    )
    assert response.status_code == 409
    assert "already exists" in response.json()["message"].lower()


@pytest.mark.asyncio
async def test_create_branch_invalid_gst_rejected(client: AsyncClient):
    """Creating a branch with invalid GST should fail schema validation (422)."""
    headers = await get_auth_headers(client, "admin@verticalclinic.com", "Admin@verticalclinic.com")
    response = await client.post(
        "/api/v1/branches/",
        headers=headers,
        json={
            "name": "Invalid GST Branch",
            "code": "INVGST",
            "address": "123 Test Street",
            "city": "Ahmedabad",
            "phone": "+919999933333",
            "email": "invgst@suvidhadental.com",
            "gst_number": "invalid-gst-format",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_branch_patient_forbidden(client: AsyncClient):
    """Patients must not be allowed to create a branch."""
    headers = await get_auth_headers(client, "patient@verticalclinic.com", "Patient@verticalclinic.com")
    response = await client.post(
        "/api/v1/branches/",
        headers=headers,
        json={
            "name": "Forbid Branch",
            "code": "FORBID",
            "address": "123 Test Street",
            "city": "Ahmedabad",
            "phone": "+919999944444",
            "email": "forbid@suvidhadental.com",
            "gst_number": "24AACCS1234K1ZP",
        },
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_list_branches_public(client: AsyncClient):
    """Listing branches should be accessible without auth."""
    response = await client.get("/api/v1/branches/")
    assert response.status_code == 200
    data = response.json()["data"]
    assert "items" in data
    assert len(data["items"]) >= 1  # Standard seeded branches


@pytest.mark.asyncio
async def test_get_branch_details(client: AsyncClient):
    """Fetching specific branch details by ID."""
    # List first to get a valid ID
    list_res = await client.get("/api/v1/branches/")
    assert list_res.status_code == 200
    branch_id = list_res.json()["data"]["items"][0]["id"]

    response = await client.get(f"/api/v1/branches/{branch_id}")
    assert response.status_code == 200
    assert response.json()["data"]["id"] == branch_id


@pytest.mark.asyncio
async def test_update_branch_admin_success(client: AsyncClient):
    """Admin should be able to update branch details."""
    headers = await get_auth_headers(client, "admin@verticalclinic.com", "Admin@verticalclinic.com")
    
    list_res = await client.get("/api/v1/branches/")
    branch_id = list_res.json()["data"]["items"][0]["id"]

    response = await client.put(
        f"/api/v1/branches/{branch_id}",
        headers=headers,
        json={
            "name": "Updated Branch Name",
            "phone": "+919000000000",
        },
    )
    assert response.status_code == 200
    assert response.json()["data"]["name"] == "Updated Branch Name"


@pytest.mark.asyncio
async def test_deactivate_activate_branch(client: AsyncClient):
    """Admin should be able to deactivate and reactivate a branch."""
    headers = await get_auth_headers(client, "admin@verticalclinic.com", "Admin@verticalclinic.com")
    
    list_res = await client.get("/api/v1/branches/")
    branch_id = list_res.json()["data"]["items"][0]["id"]

    # Deactivate
    deact_res = await client.patch(f"/api/v1/branches/{branch_id}/deactivate", headers=headers)
    assert deact_res.status_code == 200
    assert deact_res.json()["data"]["is_active"] is False

    # Activate
    act_res = await client.patch(f"/api/v1/branches/{branch_id}/activate", headers=headers)
    assert act_res.status_code == 200
    assert act_res.json()["data"]["is_active"] is True


@pytest.mark.asyncio
async def test_branch_dashboard_authorization(client: AsyncClient):
    """Admin/Doctor/Staff can access dashboard, but Patient cannot."""
    list_res = await client.get("/api/v1/branches/")
    branch_id = list_res.json()["data"]["items"][0]["id"]

    admin_headers = await get_auth_headers(client, "admin@verticalclinic.com", "Admin@verticalclinic.com")
    patient_headers = await get_auth_headers(client, "patient@verticalclinic.com", "Patient@verticalclinic.com")

    # Admin access -> 200 OK
    res_admin = await client.get(f"/api/v1/branches/{branch_id}/dashboard", headers=admin_headers)
    assert res_admin.status_code == 200
    assert "low_stock_items" in res_admin.json()["data"]

    # Patient access -> 403 Forbidden
    res_patient = await client.get(f"/api/v1/branches/{branch_id}/dashboard", headers=patient_headers)
    assert res_patient.status_code == 403


@pytest.mark.asyncio
async def test_get_branch_associations(client: AsyncClient):
    """Admin can fetch staff, public can list doctors, doctor can list patients."""
    list_res = await client.get("/api/v1/branches/")
    branch_id = list_res.json()["data"]["items"][0]["id"]

    admin_headers = await get_auth_headers(client, "admin@verticalclinic.com", "Admin@verticalclinic.com")

    # Staff list (Admin only)
    res_staff = await client.get(f"/api/v1/branches/{branch_id}/staff", headers=admin_headers)
    assert res_staff.status_code == 200
    assert isinstance(res_staff.json()["data"], list)

    # Doctors list (Public)
    res_docs = await client.get(f"/api/v1/branches/{branch_id}/doctors")
    assert res_docs.status_code == 200
    assert isinstance(res_docs.json()["data"], list)

    # Patients list (Admin)
    res_patients = await client.get(f"/api/v1/branches/{branch_id}/patients", headers=admin_headers)
    assert res_patients.status_code == 200
    assert isinstance(res_patients.json()["data"], list)
