import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_patient_can_get_own_profile(client: AsyncClient):
    """A patient should be able to get their own clinical profile via /patients/me."""
    login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    token = login.json()["data"]["access_token"]

    response = await client.get(
        "/api/v1/patients/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["success"] is True
    assert res_json["data"]["patient_code"] == "PT-10001"
    assert res_json["data"]["gender"] == "F"
    assert res_json["data"]["blood_group"] == "O+"
    assert res_json["data"]["allergies"] == "Penicillin"


@pytest.mark.asyncio
async def test_staff_cannot_get_me_profile(client: AsyncClient):
    """An admin/doctor should fail to call /patients/me since they don't have a patient clinical profile."""
    login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "admin@verticalclinic.com", "password": "Admin@verticalclinic.com"},
    )
    token = login.json()["data"]["access_token"]

    response = await client.get(
        "/api/v1/patients/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 400
    res_json = response.json()
    assert res_json["success"] is False
    assert "clinical profiles" in res_json["message"]


@pytest.mark.asyncio
async def test_patient_can_patch_own_profile(client: AsyncClient):
    """A patient should be able to patch their own clinical profile via /patients/me."""
    login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    token = login.json()["data"]["access_token"]

    # Patch details
    response = await client.patch(
        "/api/v1/patients/me",
        json={
            "full_name": "Priya S. Sharma",
            "gender": "F",
            "blood_group": "O-",
            "allergies": "Penicillin, Peanuts",
            "chronic_conditions": "None",
            "address": "123 Main Street, Satellite, Ahmedabad",
            "emergency_contact_name": "Suresh Sharma",
            "emergency_contact_relation": "Father",
            "emergency_contact_phone": "+919825099887",
            "insurance_provider": "Star Health",
            "insurance_policy_no": "SH-4471-2291",
            "preferred_payment_method": "UPI",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["success"] is True
    assert res_json["data"]["blood_group"] == "O-"
    assert res_json["data"]["allergies"] == "Penicillin, Peanuts"
    assert res_json["data"]["address"] == "123 Main Street, Satellite, Ahmedabad"
    assert res_json["data"]["emergency_contact_name"] == "Suresh Sharma"
    assert res_json["data"]["emergency_contact_relation"] == "Father"
    assert res_json["data"]["emergency_contact_phone"] == "+919825099887"
    assert res_json["data"]["insurance_provider"] == "Star Health"
    assert res_json["data"]["insurance_policy_no"] == "SH-4471-2291"
    assert res_json["data"]["preferred_payment_method"] == "UPI"
    assert res_json["data"]["user"]["full_name"] == "Priya S. Sharma"



@pytest.mark.asyncio
async def test_staff_can_list_and_search_patients(client: AsyncClient):
    """A doctor/admin should be able to list and search patients."""
    # Login as admin
    login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "admin@verticalclinic.com", "password": "Admin@verticalclinic.com"},
    )
    token = login.json()["data"]["access_token"]

    # 1. List all patients
    response = await client.get(
        "/api/v1/patients/",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["success"] is True
    assert len(res_json["data"]["items"]) >= 1
    assert res_json["data"]["total"] >= 1

    # 2. Search patients by name
    response_search = await client.get(
        "/api/v1/patients/?search=Priya",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response_search.status_code == 200
    res_search_json = response_search.json()
    assert len(res_search_json["data"]["items"]) == 1
    assert res_search_json["data"]["items"][0]["patient_code"] == "PT-10001"


@pytest.mark.asyncio
async def test_patient_cannot_list_patients(client: AsyncClient):
    """A patient should not be authorized to list/search patient profiles."""
    login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    token = login.json()["data"]["access_token"]

    response = await client.get(
        "/api/v1/patients/",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_patient_profile_retrieval_by_id(client: AsyncClient):
    """Verify who can retrieve a patient profile by ID."""
    import uuid
    # 1. Get the patient ID first as admin
    admin_login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "admin@verticalclinic.com", "password": "Admin@verticalclinic.com"},
    )
    admin_token = admin_login.json()["data"]["access_token"]
    
    list_res = await client.get(
        "/api/v1/patients/",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    patients = list_res.json()["data"]["items"]
    priya_id = next(p["id"] for p in patients if p["patient_code"] == "PT-10001")
    # Use a random non-existent UUID to test cross-patient access denial
    nonexistent_id = str(uuid.uuid4())

    # 2. Doctor retrieves Priya's profile -> Success
    doc_login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "doctor@verticalclinic.com", "password": "Doctor@verticalclinic.com"},
    )
    doc_token = doc_login.json()["data"]["access_token"]
    response = await client.get(
        f"/api/v1/patients/{priya_id}",
        headers={"Authorization": f"Bearer {doc_token}"},
    )
    assert response.status_code == 200

    # 3. Priya retrieves own profile by ID -> Success
    priya_login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    priya_token = priya_login.json()["data"]["access_token"]
    response = await client.get(
        f"/api/v1/patients/{priya_id}",
        headers={"Authorization": f"Bearer {priya_token}"},
    )
    assert response.status_code == 200

    # 4. Priya retrieves a non-existent patient profile by ID -> 403 or 404
    response = await client.get(
        f"/api/v1/patients/{nonexistent_id}",
        headers={"Authorization": f"Bearer {priya_token}"},
    )
    assert response.status_code in (403, 404)


@pytest.mark.asyncio
async def test_patient_profile_update_by_id(client: AsyncClient):
    """Verify who can update a patient profile by ID."""
    import uuid
    admin_login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "admin@verticalclinic.com", "password": "Admin@verticalclinic.com"},
    )
    admin_token = admin_login.json()["data"]["access_token"]
    list_res = await client.get(
        "/api/v1/patients/",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    patients = list_res.json()["data"]["items"]
    priya_id = next(p["id"] for p in patients if p["patient_code"] == "PT-10001")
    nonexistent_id = str(uuid.uuid4())

    priya_login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    priya_token = priya_login.json()["data"]["access_token"]

    # 1. Priya updates own profile by ID -> Success
    response = await client.put(
        f"/api/v1/patients/{priya_id}",
        json={"blood_group": "A-"},
        headers={"Authorization": f"Bearer {priya_token}"},
    )
    assert response.status_code == 200

    # 2. Priya updates a non-existent patient's profile by ID -> 403 or 404
    response = await client.put(
        f"/api/v1/patients/{nonexistent_id}",
        json={"blood_group": "A-"},
        headers={"Authorization": f"Bearer {priya_token}"},
    )
    assert response.status_code in (403, 404)

    # 3. Admin updates Priya's profile by ID -> Success
    response = await client.put(
        f"/api/v1/patients/{priya_id}",
        json={"allergies": "None"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_admin_deactivate_and_activate_patient(client: AsyncClient):
    """Admin or receptionist should be able to deactivate and activate patient profiles, others cannot."""
    admin_login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "admin@verticalclinic.com", "password": "Admin@verticalclinic.com"},
    )
    admin_token = admin_login.json()["data"]["access_token"]
    list_res = await client.get(
        "/api/v1/patients/",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    patients = list_res.json()["data"]["items"]
    priya_id = next(p["id"] for p in patients if p["patient_code"] == "PT-10001")

    priya_login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    priya_token = priya_login.json()["data"]["access_token"]

    # 1. Priya tries to deactivate own profile -> Forbidden (403)
    response = await client.post(
        f"/api/v1/patients/{priya_id}/deactivate",
        headers={"Authorization": f"Bearer {priya_token}"},
    )
    assert response.status_code == 403

    # 2. Admin deactivates Priya's profile -> Success
    response = await client.post(
        f"/api/v1/patients/{priya_id}/deactivate",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    assert response.json()["data"]["is_active"] is False

    # 3. Admin activates Priya's profile -> Success
    response = await client.post(
        f"/api/v1/patients/{priya_id}/activate",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    assert response.json()["data"]["is_active"] is True


@pytest.mark.asyncio
async def test_patient_dashboard(client: AsyncClient):
    """Verify that a patient can retrieve their dashboard layout metrics."""
    login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    token = login.json()["data"]["access_token"]

    response = await client.get(
        "/api/v1/patients/me/dashboard",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["success"] is True
    assert res_json["data"]["patient_code"] == "PT-10001"
    assert "upcoming_appointments_count" in res_json["data"]
    assert "active_prescriptions_count" in res_json["data"]
    assert "balance_due" in res_json["data"]
    assert "visits_this_year" in res_json["data"]
    assert "upcoming_appointments" in res_json["data"]
    assert "recent_prescriptions" in res_json["data"]


@pytest.mark.asyncio
async def test_medical_reports_flow(client: AsyncClient):
    """Verify end-to-end medical reports upload, retrieval, and delete flow."""
    # 1. Log in as Patient (Priya)
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["data"]["access_token"]
    user_data = login_res.json()["data"]["user"]

    # Get Priya's patient profile to know her patient ID
    profile_res = await client.get(
        "/api/v1/patients/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert profile_res.status_code == 200
    patient_id = profile_res.json()["data"]["id"]

    # 2. Upload medical report
    file_payload = {"file": ("test_xray.png", b"fake-file-binary-content", "image/png")}
    form_payload = {"report_type": "X-Ray"}
    upload_res = await client.post(
        "/api/v1/medical-reports/upload",
        headers={"Authorization": f"Bearer {token}"},
        data=form_payload,
        files=file_payload,
    )
    assert upload_res.status_code == 201
    upload_data = upload_res.json()
    assert upload_data["success"] is True
    assert upload_data["message"] == "Medical report uploaded successfully."
    assert upload_data["data"]["report_type"] == "X-Ray"
    assert upload_data["data"]["report_name"] == "test_xray.png"
    assert "file_url" in upload_data["data"]
    report_id = upload_data["data"]["id"]

    # 3. List my reports (Patient views own reports)
    list_res = await client.get(
        "/api/v1/medical-reports",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["success"] is True
    assert len(list_data["data"]) >= 1
    assert any(r["id"] == report_id for r in list_data["data"])

    # 4. List reports as Doctor (Staff views patient's reports)
    doc_login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "doctor@verticalclinic.com", "password": "Doctor@verticalclinic.com"},
    )
    assert doc_login.status_code == 200
    doc_token = doc_login.json()["data"]["access_token"]


    staff_list_res = await client.get(
        f"/api/v1/medical-reports/patient/{patient_id}",
        headers={"Authorization": f"Bearer {doc_token}"},
    )
    assert staff_list_res.status_code == 200
    staff_list_data = staff_list_res.json()
    assert staff_list_data["success"] is True
    assert len(staff_list_data["data"]) >= 1

    # 5. Delete report (Patient deletes own report)
    delete_res = await client.delete(
        f"/api/v1/medical-reports/{report_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert delete_res.status_code == 200
    assert delete_res.json()["success"] is True
    assert delete_res.json()["message"] == "Medical report deleted successfully."

    # 6. Verify it is no longer listed
    list_after_delete_res = await client.get(
        "/api/v1/medical-reports",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert list_after_delete_res.status_code == 200
    assert not any(r["id"] == report_id for r in list_after_delete_res.json()["data"])


@pytest.mark.asyncio
async def test_patient_can_get_own_appointments(client: AsyncClient):
    """Verify that a patient can retrieve and filter their own appointments."""
    login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    token = login.json()["data"]["access_token"]

    # 1. Fetch appointments without filters
    res = await client.get(
        "/api/v1/patients/me/appointments",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    res_json = res.json()
    assert res_json["success"] is True
    assert "items" in res_json["data"]
    assert "total" in res_json["data"]

    # 2. Filter by status
    res_status = await client.get(
        "/api/v1/patients/me/appointments?status=pending",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_status.status_code == 200
    assert res_status.json()["success"] is True
    for item in res_status.json()["data"]["items"]:
        assert item["status"] in ("confirmed", "rescheduled")

    # 3. Search by doctor's name
    res_search = await client.get(
        "/api/v1/patients/me/appointments?search=Rohan",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_search.status_code == 200
    assert res_search.json()["success"] is True


@pytest.mark.asyncio
async def test_patient_prescriptions_flow(client: AsyncClient):
    """Verify that a patient can list, retrieve details, and download PDFs of prescriptions."""
    # 1. Login as patient (Priya Sharma)
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    token = login_res.json()["data"]["access_token"]

    # 2. Get list of patient's prescriptions
    list_res = await client.get(
        "/api/v1/patients/me/prescriptions",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert list_res.status_code == 200
    list_json = list_res.json()
    assert list_json["success"] is True
    assert "items" in list_json["data"]
    
    # If there are prescriptions, verify detail & pdf downloads
    if list_json["data"]["items"]:
        presc_id = list_json["data"]["items"][0]["id"]
        
        # 3. Retrieve specific prescription details
        detail_res = await client.get(
            f"/api/v1/prescriptions/{presc_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert detail_res.status_code == 200
        assert detail_res.json()["success"] is True
        assert detail_res.json()["data"]["id"] == presc_id
        
        # 4. Download PDF
        pdf_res = await client.get(
            f"/api/v1/prescriptions/{presc_id}/pdf",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert pdf_res.status_code == 200
        assert pdf_res.headers["content-type"] == "application/pdf"
        assert len(pdf_res.content) > 0


@pytest.mark.asyncio
async def test_patient_medical_history_flow(client: AsyncClient):
    """Verify that a patient can retrieve their medical history, treatment plans, and reports."""
    # 1. Login as patient (Priya Sharma)
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    token = login_res.json()["data"]["access_token"]

    # 2. Get medical history (consultations)
    history_res = await client.get(
        "/api/v1/patients/me/medical-history",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert history_res.status_code == 200
    assert history_res.json()["success"] is True
    assert "items" in history_res.json()["data"]

    # 3. Get treatment plans
    treatments_res = await client.get(
        "/api/v1/patients/me/treatments",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert treatments_res.status_code == 200
    assert treatments_res.json()["success"] is True
    assert "items" in treatments_res.json()["data"]

    # 4. Get reports
    reports_res = await client.get(
        "/api/v1/patients/me/reports",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert reports_res.status_code == 200
    assert reports_res.json()["success"] is True
    assert isinstance(reports_res.json()["data"], list)


@pytest.mark.asyncio
async def test_patient_billing_flow(client: AsyncClient):
    """Verify that a patient can retrieve their bills, invoice details, and download invoice PDFs."""
    # 1. Login as patient (Priya Sharma)
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    token = login_res.json()["data"]["access_token"]

    # 2. Get billing list
    list_res = await client.get(
        "/api/v1/patients/me/billing",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert list_res.status_code == 200
    list_json = list_res.json()
    assert list_json["success"] is True
    assert "items" in list_json["data"]

    # If there are invoices, verify detail & pdf downloads
    if list_json["data"]["items"]:
        invoice_id = list_json["data"]["items"][0]["id"]

        # 3. Retrieve specific invoice details
        detail_res = await client.get(
            f"/api/v1/billing/{invoice_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert detail_res.status_code == 200
        assert detail_res.json()["success"] is True
        assert detail_res.json()["data"]["id"] == invoice_id

        # 4. Download PDF
        pdf_res = await client.get(
            f"/api/v1/billing/{invoice_id}/pdf",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert pdf_res.status_code == 200
        assert pdf_res.headers["content-type"] == "application/pdf"
        assert len(pdf_res.content) > 0


@pytest.mark.asyncio
async def test_patient_follow_ups_flow(client: AsyncClient):
    """Verify that a patient can retrieve recommended follow-ups."""
    # 1. Login as patient (Priya Sharma)
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    token = login_res.json()["data"]["access_token"]

    # 2. Get follow-up recommendations
    res = await client.get(
        "/api/v1/patients/me/follow-ups",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert isinstance(data["data"], list)


@pytest.mark.asyncio
async def test_patient_dashboard_flow(client: AsyncClient):
    """Verify that a patient can retrieve their patient dashboard data."""
    # 1. Login as patient (Priya Sharma)
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    token = login_res.json()["data"]["access_token"]

    # 2. Get dashboard
    res = await client.get(
        "/api/v1/patients/me/dashboard",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "upcoming_appointments" in data["data"]
    assert "appointment_history" in data["data"]
    assert "prescriptions" in data["data"]
    assert "medical_history" in data["data"]
    assert "reports" in data["data"]
    assert "bills" in data["data"]
    assert "follow_ups" in data["data"]


@pytest.mark.asyncio
async def test_patient_preferences_flow(client: AsyncClient):
    """Verify that a patient can retrieve and update preferences."""
    # 1. Login as patient (Priya Sharma)
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    token = login_res.json()["data"]["access_token"]

    # 2. Get preferences
    get_res = await client.get(
        "/api/v1/patients/me/preferences",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_res.status_code == 200
    get_data = get_res.json()
    assert get_data["success"] is True
    assert "language" in get_data["data"]
    assert "notification_email" in get_data["data"]

    # 3. Update preferences
    patch_res = await client.patch(
        "/api/v1/patients/me/preferences",
        json={
            "language": "es",
            "notification_email": False,
            "notification_push": True,
            "consultation_preference": "teleconsultation",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert patch_res.status_code == 200
    patch_data = patch_res.json()
    assert patch_data["success"] is True
    assert patch_data["data"]["language"] == "es"
    assert patch_data["data"]["notification_email"] is False
    assert patch_data["data"]["notification_push"] is True
    assert patch_data["data"]["consultation_preference"] == "teleconsultation"


@pytest.mark.asyncio
async def test_patient_statistics_flow(client: AsyncClient):
    """Verify that a patient can retrieve statistics."""
    # 1. Login as patient (Priya Sharma)
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    token = login_res.json()["data"]["access_token"]

    # 2. Get stats
    res = await client.get(
        "/api/v1/patients/me/statistics",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "total_visits" in data["data"]
    assert "upcoming_appointments" in data["data"]
    assert "cancelled_appointments" in data["data"]
    assert "active_prescriptions" in data["data"]
    assert "pending_bills" in data["data"]
    assert "balance_due" in data["data"]


@pytest.mark.asyncio
async def test_patient_timeline_flow(client: AsyncClient):
    """Verify that a patient can retrieve their chronological timeline."""
    # 1. Login as patient (Priya Sharma)
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    token = login_res.json()["data"]["access_token"]

    # 2. Get timeline
    res = await client.get(
        "/api/v1/patients/me/timeline",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert isinstance(data["data"], list)
    if len(data["data"]) > 0:
        event = data["data"][0]
        assert "event_type" in event
        assert "title" in event
        assert "datetime" in event
        assert "details" in event


@pytest.mark.asyncio
async def test_receptionist_can_create_walkin_patient(client: AsyncClient):
    """Verify that a receptionist can register a walk-in patient (pre-verified)."""
    import uuid
    # 1. Login as Admin
    login_admin = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "admin@verticalclinic.com", "password": "Admin@verticalclinic.com"},
    )
    assert login_admin.status_code == 200
    token_admin = login_admin.json()["data"]["access_token"]

    # 2. Get branches to get a valid branch ID
    branches_res = await client.get("/api/v1/branches/")
    assert branches_res.status_code == 200
    branch_id = branches_res.json()["data"]["items"][0]["id"]

    # 3. Create a new user with receptionist role
    receptionist_email = f"recep_walkin_{uuid.uuid4().hex[:6]}@verticalclinic.com"
    user_payload = {
        "full_name": "Walkin Receptionist",
        "email": receptionist_email,
        "phone": "+919999922222",
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

    # 4. Login as receptionist
    login_recep = await client.post(
        "/api/v1/auth/login",
        json={"identifier": receptionist_email, "password": "Password@123"},
    )
    assert login_recep.status_code == 200
    token_recep = login_recep.json()["data"]["access_token"]

    # 5. Register Walk-in Patient
    response = await client.post(
        "/api/v1/patients/",
        json={
            "full_name": "Ramesh Kumar Walkin",
            "email": f"ramesh.walkin.{uuid.uuid4().hex[:6]}@example.com",
            "phone": f"+9199999{uuid.uuid4().hex[:5]}",
            "gender": "M",
            "date_of_birth": "1985-05-15T00:00:00",
            "blood_group": "B+",
            "address": "456 Walkin Ave, Ahmedabad",
        },
        headers={"Authorization": f"Bearer {token_recep}"},
    )
    assert response.status_code == 201
    res_json = response.json()
    assert res_json["success"] is True
    assert res_json["message"] == "Walk-in patient registered successfully."
    assert res_json["data"]["user"]["full_name"] == "Ramesh Kumar Walkin"
    assert res_json["data"]["user"]["is_verified"] is True
    assert res_json["data"]["blood_group"] == "B+"
    assert res_json["data"]["address"] == "456 Walkin Ave, Ahmedabad"
    assert "patient_code" in res_json["data"]


@pytest.mark.asyncio
async def test_patient_preferences_boolean_validation(client: AsyncClient):
    """Verify that preference updates validate boolean values and reject invalid types/nulls."""
    # 1. Login as patient
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    token = login_res.json()["data"]["access_token"]

    # 2. Update preferences with valid boolean strings -> Success (coerced)
    patch_res = await client.patch(
        "/api/v1/patients/me/preferences",
        json={
            "notification_email": "false",
            "notification_push": "true",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["data"]["notification_email"] is False
    assert patch_res.json()["data"]["notification_push"] is True

    # 3. Update preferences with invalid null/None value -> Validation Error (422)
    patch_invalid_res = await client.patch(
        "/api/v1/patients/me/preferences",
        json={
            "notification_email": None,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert patch_invalid_res.status_code == 422


@pytest.mark.asyncio
async def test_staff_can_get_patient_history_profile(client: AsyncClient):
    """Verify that receptionist/doctor/admin can retrieve patient history and profile, but patient cannot."""
    # 1. Login as Admin to get the patient ID
    admin_login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "admin@verticalclinic.com", "password": "Admin@verticalclinic.com"},
    )
    admin_token = admin_login.json()["data"]["access_token"]
    
    list_res = await client.get(
        "/api/v1/patients/",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    patients = list_res.json()["data"]["items"]
    priya_id = next(p["id"] for p in patients if p["patient_code"] == "PT-10001")

    # 2. Login as Doctor -> Success
    doc_login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "doctor@verticalclinic.com", "password": "Doctor@verticalclinic.com"},
    )
    doc_token = doc_login.json()["data"]["access_token"]
    
    response = await client.get(
        f"/api/v1/patients/{priya_id}/history-profile",
        headers={"Authorization": f"Bearer {doc_token}"},
    )
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["success"] is True
    assert "patient" in res_json["data"]
    assert "upcoming_appointments" in res_json["data"]
    assert "medical_history" in res_json["data"]
    assert "prescriptions" in res_json["data"]
    assert "bills" in res_json["data"]

    # 3. Login as Patient Priya -> Forbidden (403)
    priya_login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    priya_token = priya_login.json()["data"]["access_token"]
    
    forbidden_response = await client.get(
        f"/api/v1/patients/{priya_id}/history-profile",
        headers={"Authorization": f"Bearer {priya_token}"},
    )
    assert forbidden_response.status_code == 403


@pytest.mark.asyncio
async def test_patient_me_reports_endpoints(client: AsyncClient):
    """Verify patient can upload and delete reports using POST and DELETE /patients/me/reports endpoints."""
    # 1. Log in as Patient (Priya)
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["data"]["access_token"]

    # 2. Upload medical report via /patients/me/reports
    file_payload = {"file": ("test_report_me.pdf", b"fake-pdf-content", "application/pdf")}
    form_payload = {"report_type": "MRI", "title": "My MRI Scan"}
    upload_res = await client.post(
        "/api/v1/patients/me/reports",
        headers={"Authorization": f"Bearer {token}"},
        data=form_payload,
        files=file_payload,
    )
    assert upload_res.status_code == 201
    upload_data = upload_res.json()
    assert upload_data["success"] is True
    assert upload_data["message"] == "Medical report uploaded successfully."
    assert upload_data["data"]["report_type"] == "MRI"
    assert upload_data["data"]["report_name"] == "My MRI Scan"
    assert "file_url" in upload_data["data"]
    report_id = upload_data["data"]["id"]

    # 3. GET /patients/me/reports to confirm it is listed
    list_res = await client.get(
        "/api/v1/patients/me/reports",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["success"] is True
    assert any(r["id"] == report_id for r in list_data["data"])

    # 4. DELETE /patients/me/reports/{report_id} to delete it
    delete_res = await client.delete(
        f"/api/v1/patients/me/reports/{report_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert delete_res.status_code == 200
    assert delete_res.json()["success"] is True
    assert delete_res.json()["message"] == "Medical report deleted successfully."

    # 5. GET /patients/me/reports to confirm it is deleted
    list_after_delete_res = await client.get(
        "/api/v1/patients/me/reports",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert list_after_delete_res.status_code == 200
    assert not any(r["id"] == report_id for r in list_after_delete_res.json()["data"])










