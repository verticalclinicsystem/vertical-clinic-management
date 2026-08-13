"""
Authentication endpoint tests.
All tests use the test database with per-test rollback.
"""
import pytest
from httpx import AsyncClient


# ── Login Tests ───────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_login_with_email_success(client: AsyncClient):
    """Seeded admin user should be able to login via email."""
    response = await client.post(
        "/api/v1/auth/login",
        json={
            "identifier": "admin@verticalclinic.com",
            "password": "Admin@verticalclinic.com",
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["role"] == "admin"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    """Login with wrong password must return 401."""
    response = await client.post(
        "/api/v1/auth/login",
        json={
            "identifier": "admin@verticalclinic.com",
            "password": "WrongPass!",
        },
    )
    assert response.status_code == 401
    assert response.json()["error_code"] == "INVALID_CREDENTIALS"


@pytest.mark.asyncio
async def test_login_unknown_email(client: AsyncClient):
    """Login with unknown email must return 401."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "nobody@example.com", "password": "Test@123"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_with_phone(client: AsyncClient):
    """Login using phone number as identifier."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "+919825011234", "password": "Patient@verticalclinic.com"},
    )
    assert response.status_code == 200
    assert response.json()["data"]["user"]["role"] == "patient"


# ── Registration Tests ────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_patient_registration_success(client: AsyncClient):
    """New patient should be able to self-register."""
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Test Patient",
            "email": "newpatient@example.com",
            "phone": "+919999988888",
            "password": "Test@1234",
        },
    )
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["email"] == "newpatient@example.com"


@pytest.mark.asyncio
async def test_registration_duplicate_email(client: AsyncClient):
    """Duplicate email registration must return 409."""
    # Register once
    await client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "User One",
            "email": "dup@example.com",
            "phone": "+919111122222",
            "password": "Test@1234",
        },
    )
    # Register again with same email
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "User Two",
            "email": "dup@example.com",
            "phone": "+919333344444",
            "password": "Test@1234",
        },
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_weak_password_rejected(client: AsyncClient):
    """Password without uppercase or digit should be rejected."""
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Weak Pass",
            "email": "weak@example.com",
            "phone": "+919555566666",
            "password": "weakpassword",
        },
    )
    assert response.status_code == 422


# ── Token & Profile Tests ─────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_get_me_authenticated(client: AsyncClient):
    """Authenticated user should get their profile from /auth/me."""
    login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    token = login.json()["data"]["access_token"]

    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["email"] == "patient@verticalclinic.com"
    assert data["role"] == "patient"


@pytest.mark.asyncio
async def test_get_me_unauthenticated(client: AsyncClient):
    """Calling /me without token must return 401."""
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_token_refresh(client: AsyncClient):
    """Should return a new access token given a valid refresh token."""
    login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "admin@verticalclinic.com", "password": "Admin@verticalclinic.com"},
    )
    refresh_token = login.json()["data"]["refresh_token"]

    response = await client.post(
        "/api/v1/auth/refresh-token",
        json={"refresh_token": refresh_token},
    )
    assert response.status_code == 200
    assert "access_token" in response.json()["data"]

@pytest.mark.asyncio
async def test_token_refresh_fails_after_revocation(client: AsyncClient):
    """Token refresh should fail after user session is revoked / token_version is incremented."""
    login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "admin@verticalclinic.com", "password": "Admin@verticalclinic.com"},
    )
    admin_token = login.json()["data"]["access_token"]
    refresh_token = login.json()["data"]["refresh_token"]
    
    me_res = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    admin_id = me_res.json()["data"]["id"]

    revoke_res = await client.post(
        f"/api/v1/users/{admin_id}/revoke-sessions",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert revoke_res.status_code == 200

    refresh_res = await client.post(
        "/api/v1/auth/refresh-token",
        json={"refresh_token": refresh_token},
    )
    assert refresh_res.status_code == 401


@pytest.mark.asyncio
async def test_change_password(client: AsyncClient):
    """User should be able to change their password."""
    # Login as pharmacist
    login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "pharmacist@verticalclinic.com", "password": "Pharmacist@verticalclinic.com"},
    )
    token = login.json()["data"]["access_token"]

    # Change password (new password must satisfy: uppercase + digit + special char)
    response = await client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "Pharmacist@verticalclinic.com", "new_password": "NewPass@1234"},
    )
    assert response.status_code == 200

    # Verify new password works
    new_login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "pharmacist@verticalclinic.com", "password": "NewPass@1234"},
    )
    assert new_login.status_code == 200


# ── RBAC Tests ────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_patient_cannot_access_admin_users(client: AsyncClient):
    """A patient token must not be able to list all users."""
    login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    token = login.json()["data"]["access_token"]

    response = await client.get(
        "/api/v1/users/",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_can_list_users(client: AsyncClient):
    """Admin should be able to list all users."""
    login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "admin@verticalclinic.com", "password": "Admin@verticalclinic.com"},
    )
    token = login.json()["data"]["access_token"]

    response = await client.get(
        "/api/v1/users/",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["success"] is True
    assert isinstance(res_json["data"], list)


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    """Health endpoint should always return 200."""
    response = await client.get("/health")
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["success"] is True
    assert res_json["data"]["status"] == "ok"


@pytest.mark.asyncio
async def test_role_specific_onboarding(client: AsyncClient):
    """Admin should be able to create users via role-specific endpoints."""
    # 1. Login as admin
    login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "admin@verticalclinic.com", "password": "Admin@verticalclinic.com"},
    )
    token = login.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Retrieve branch ID
    branch_res = await client.get("/api/v1/branches/", headers=headers)
    branch_id = branch_res.json()["data"]["items"][0]["id"]

    # 2. Create Doctor
    doc_res = await client.post(
        "/api/v1/users/doctor",
        headers=headers,
        json={
            "full_name": "Dr. Onboarded Doctor",
            "email": "onboarded_doc@example.com",
            "phone": "+919876543210",
            "password": "SecureDoctor123!",
            "branch_id": branch_id,
            "specialization": "Pediatrician",
            "qualification": "MD",
            "experience_years": 8,
            "consultation_fee": 800.0,
            "bio": "Expert pediatrician",
            "registration_number": "DOC-12345",
        }
    )
    assert doc_res.status_code == 201
    assert doc_res.json()["data"]["role"] == "doctor"

    # 3. Create Receptionist
    recep_res = await client.post(
        "/api/v1/users/receptionist",
        headers=headers,
        json={
            "full_name": "Sarah Receptionist",
            "email": "onboarded_recep@example.com",
            "phone": "+919876543211",
            "password": "SecureRecep123!",
            "branch_id": branch_id,
            "shift_start": "08:00",
            "shift_end": "16:00",
            "bio": "Reception manager",
        }
    )
    assert recep_res.status_code == 201
    assert recep_res.json()["data"]["role"] == "receptionist"

    # 4. Create Pharmacist
    pharm_res = await client.post(
        "/api/v1/users/pharmacist",
        headers=headers,
        json={
            "full_name": "John Pharmacist",
            "email": "onboarded_pharm@example.com",
            "phone": "+919876543212",
            "password": "SecurePharm123!",
            "branch_id": branch_id,
        }
    )
    assert pharm_res.status_code == 201
    assert pharm_res.json()["data"]["role"] == "pharmacist"

    # 5. Create Admin
    admin_res = await client.post(
        "/api/v1/users/admin",
        headers=headers,
        json={
            "full_name": "Alex Admin",
            "email": "onboarded_admin@example.com",
            "phone": "+919876543213",
            "password": "SecureAdmin123!",
            "branch_id": branch_id,
        }
    )
    assert admin_res.status_code == 201
    assert admin_res.json()["data"]["role"] == "admin"


@pytest.mark.asyncio
async def test_delete_user(client: AsyncClient):
    """Admin can delete a staff member but cannot delete their own account."""
    # 1. Login as admin
    login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "admin@verticalclinic.com", "password": "Admin@verticalclinic.com"},
    )
    token = login.json()["data"]["access_token"]
    admin_id = login.json()["data"]["user"]["id"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Try to delete self -> must fail with 400
    self_del = await client.delete(f"/api/v1/users/{admin_id}", headers=headers)
    assert self_del.status_code == 400

    # 3. Create a temporary staff user to delete
    pharm_res = await client.post(
        "/api/v1/users/pharmacist",
        headers=headers,
        json={
            "full_name": "Temp Pharmacist",
            "email": "temp_pharm@example.com",
            "phone": "+919876543599",
            "password": "SecurePharm123!",
            "branch_id": None,
        }
    )
    assert pharm_res.status_code == 201
    temp_user_id = pharm_res.json()["data"]["id"]

    # 4. Admin deletes the temp user -> must succeed with 200
    del_res = await client.delete(f"/api/v1/users/{temp_user_id}", headers=headers)
    assert del_res.status_code == 200

    # 5. Try to retrieve deleted user -> must fail with 404
    get_res = await client.get(f"/api/v1/users/{temp_user_id}", headers=headers)
    assert get_res.status_code == 404


# ── Suspension and Session Revocation Tests ──────────────────────────────────
@pytest.mark.asyncio
async def test_user_suspension_flow(client: AsyncClient):
    """Admin can suspend a user, which prevents them from using active token or logging in. Admin can unsuspend them."""
    # 1. Login as admin
    login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "admin@verticalclinic.com", "password": "Admin@verticalclinic.com"},
    )
    admin_token = login.json()["data"]["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Login as patient
    patient_login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    patient_token = patient_login.json()["data"]["access_token"]
    patient_id = patient_login.json()["data"]["user"]["id"]
    patient_headers = {"Authorization": f"Bearer {patient_token}"}

    # Verify patient can call /auth/me
    me_res = await client.get("/api/v1/auth/me", headers=patient_headers)
    assert me_res.status_code == 200

    # 3. Admin suspends patient for 3 days
    suspend_res = await client.post(
        f"/api/v1/users/{patient_id}/suspend",
        headers=admin_headers,
        json={"duration_days": 3, "reason": "Disruptive behavior"}
    )
    assert suspend_res.status_code == 200
    assert suspend_res.json()["data"]["suspension_reason"] == "Disruptive behavior"
    assert suspend_res.json()["data"]["suspended_until"] is not None

    # 4. Try to call /auth/me with suspended patient's active token -> must be 401/Unauthorized
    me_res2 = await client.get("/api/v1/auth/me", headers=patient_headers)
    assert me_res2.status_code == 401

    # Try to login as suspended patient -> must be 401
    login_res2 = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    assert login_res2.status_code == 401

    # 5. Admin unsuspends patient
    unsuspend_res = await client.post(
        f"/api/v1/users/{patient_id}/suspend",
        json={"action": "unsuspend"},
        headers=admin_headers
    )
    assert unsuspend_res.status_code == 200
    assert unsuspend_res.json()["data"]["suspended_until"] is None
    assert unsuspend_res.json()["data"]["suspension_reason"] is None

    # 6. Patient logs in again -> must succeed
    login_res3 = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    assert login_res3.status_code == 200


@pytest.mark.asyncio
async def test_session_revocation_me(client: AsyncClient):
    """User can revoke all their own sessions, invalidating current token."""
    # 1. Login as pharmacist
    login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "pharmacist@verticalclinic.com", "password": "Pharmacist@verticalclinic.com"},
    )
    token = login.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Call /auth/me to verify working
    res1 = await client.get("/api/v1/auth/me", headers=headers)
    assert res1.status_code == 200

    # 2. Revoke all sessions
    revoke_res = await client.post("/api/v1/users/me/revoke-sessions", headers=headers)
    assert revoke_res.status_code == 200

    # 3. Call /auth/me again with same token -> must be 401
    res2 = await client.get("/api/v1/auth/me", headers=headers)
    assert res2.status_code == 401


@pytest.mark.asyncio
async def test_admin_force_revoke_sessions(client: AsyncClient):
    """Admin can force-revoke sessions of another user."""
    # 1. Login as admin
    admin_login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "admin@verticalclinic.com", "password": "Admin@verticalclinic.com"},
    )
    admin_token = admin_login.json()["data"]["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Login as patient
    patient_login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    patient_token = patient_login.json()["data"]["access_token"]
    patient_id = patient_login.json()["data"]["user"]["id"]
    patient_headers = {"Authorization": f"Bearer {patient_token}"}

    # Verify patient working
    res1 = await client.get("/api/v1/auth/me", headers=patient_headers)
    assert res1.status_code == 200

    # 3. Admin force revokes patient's sessions
    force_res = await client.post(
        f"/api/v1/users/{patient_id}/revoke-sessions",
        headers=admin_headers
    )
    assert force_res.status_code == 200

    # 4. Patient's active token is now invalid
    res2 = await client.get("/api/v1/auth/me", headers=patient_headers)
    assert res2.status_code == 401


