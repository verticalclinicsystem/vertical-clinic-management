import pytest
import uuid
from httpx import AsyncClient
from datetime import datetime, timezone, timedelta

@pytest.mark.asyncio
async def test_ipd_lifecycle(client: AsyncClient):
    # 1. Login as Admin/Receptionist
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

    # 2. Get Beds Dashboard
    dash_res = await client.get("/api/v1/ipd/dashboard/beds", headers=headers)
    assert dash_res.status_code == 200
    beds = dash_res.json()["data"]
    assert len(beds) > 0

    # Ensure seeded beds exist
    available_beds = [b for b in beds if b["status"] == "available"]
    assert len(available_beds) > 0
    target_bed = available_beds[0]

    # Find a patient (e.g. PT-1001 or similar from seeds)
    # Let's search patients list
    pat_res = await client.get("/api/v1/patients/?limit=10", headers=headers)
    assert pat_res.status_code == 200
    patients = pat_res.json()["data"]["items"]
    assert len(patients) > 0
    patient = patients[0]

    # Find a doctor
    doc_res = await client.get("/api/v1/doctors/?limit=10", headers=headers)
    assert doc_res.status_code == 200
    doctors = doc_res.json()["data"]["items"]
    assert len(doctors) > 0
    doctor = doctors[0]

    # 3. Admit Patient
    admit_res = await client.post(
        "/api/v1/ipd/admissions",
        json={
            "patient_id": patient["id"],
            "bed_id": target_bed["id"],
            "admitting_doctor_id": doctor["id"],
            "diagnosis": "Severe dehydration and fever",
            "initial_deposit": 2000.0,
            "insurance_approved_amount": 0.0
        },
        headers=headers
    )
    assert admit_res.status_code == 201
    admission_id = admit_res.json()["data"]["admission_id"]

    # 4. Check Beds Dashboard (should show occupied bed)
    dash_res_2 = await client.get("/api/v1/ipd/dashboard/beds", headers=headers)
    assert dash_res_2.status_code == 200
    beds_2 = dash_res_2.json()["data"]
    updated_bed = next((b for b in beds_2 if b["id"] == target_bed["id"]), None)
    assert updated_bed is not None
    assert updated_bed["status"] == "occupied"
    assert updated_bed["active_admission"] is not None
    assert updated_bed["active_admission"]["patient_name"] is not None

    # 5. Record clinical vitals
    vitals_res = await client.post(
        f"/api/v1/ipd/admissions/{admission_id}/vitals",
        json={
            "temp": 99.4,
            "pulse": 82,
            "systolic_bp": 115,
            "diastolic_bp": 75,
            "spo2": 97,
            "respiratory_rate": 18,
            "nursing_notes": "Patient stable. Administered IV saline."
        },
        headers=headers
    )
    assert vitals_res.status_code == 201

    # Fetch vitals history
    vitals_history_res = await client.get(
        f"/api/v1/ipd/admissions/{admission_id}/vitals",
        headers=headers
    )
    assert vitals_history_res.status_code == 200
    vitals_data = vitals_history_res.json()["data"]
    assert len(vitals_data) > 0
    assert vitals_data[0]["temp"] == 99.4

    # 6. Schedule Medication administration
    sched_res = await client.post(
        f"/api/v1/ipd/admissions/{admission_id}/mac",
        json={
            "medicine_name": "Paracetamol 650mg",
            "dosage": "1 Tablet oral",
            "scheduled_time": (datetime.now(timezone.utc) + timedelta(hours=4)).isoformat()
        },
        headers=headers
    )
    assert sched_res.status_code == 201

    # Fetch MAC log
    mac_res = await client.get(
        f"/api/v1/ipd/admissions/{admission_id}/mac",
        headers=headers
    )
    assert mac_res.status_code == 200
    mac_items = mac_res.json()["data"]
    assert len(mac_items) > 0
    mac_item = mac_items[0]
    assert mac_item["medicine_name"] == "Paracetamol 650mg"
    assert mac_item["status"] == "scheduled"

    # Administer medicine
    admin_med_res = await client.patch(
        f"/api/v1/ipd/admissions/mac/{mac_item['id']}",
        json={"status": "administered"},
        headers=headers
    )
    assert admin_med_res.status_code == 200

    # Verify MAC log status updated
    mac_res_2 = await client.get(
        f"/api/v1/ipd/admissions/{admission_id}/mac",
        headers=headers
    )
    assert mac_res_2.json()["data"][0]["status"] == "administered"

    # 7. Get Bill Summary
    bill_res = await client.get(
        f"/api/v1/ipd/admissions/{admission_id}/bill-summary",
        headers=headers
    )
    assert bill_res.status_code == 200
    bill_data = bill_res.json()["data"]
    assert bill_data["subtotal"] > 0.0
    assert bill_data["initial_deposit"] == 2000.0

    # 8. Finalize Checkout
    checkout_res = await client.post(
        f"/api/v1/ipd/admissions/{admission_id}/finalize-checkout",
        headers=headers
    )
    assert checkout_res.status_code == 200

    # Ensure Bed status transitioned to cleaning
    dash_res_3 = await client.get("/api/v1/ipd/dashboard/beds", headers=headers)
    assert dash_res_3.status_code == 200
    final_bed = next((b for b in dash_res_3.json()["data"] if b["id"] == target_bed["id"]), None)
    assert final_bed is not None
    assert final_bed["status"] == "cleaning"


@pytest.mark.asyncio
async def test_admin_bed_management(client: AsyncClient):
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

    # 2. Get Branches to find a branch ID
    branch_res = await client.get("/api/v1/branches/", headers=headers)
    assert branch_res.status_code == 200
    branches = branch_res.json()["data"]["items"]
    assert len(branches) > 0
    branch_id = branches[0]["id"]

    # 3. Create a new Bed Category
    cat_name = f"Test Category-{uuid.uuid4().hex[:6]}"
    cat_res = await client.post(
        "/api/v1/ipd/categories",
        json={
            "name": cat_name,
            "base_charge_24h": 4000.0,
            "hourly_overtime_rate": 180.0,
            "tax_rate": 0.12
        },
        headers=headers
    )
    assert cat_res.status_code == 200
    cat_data = cat_res.json()["data"]
    assert cat_data["name"] == cat_name
    category_id = cat_data["id"]

    # 4. Register a physical bed in the branch under the category
    bed_number = f"Test-Bed-{uuid.uuid4().hex[:6]}"
    bed_res = await client.post(
        "/api/v1/ipd/beds",
        json={
            "bed_number": bed_number,
            "category_id": category_id,
            "branch_id": branch_id
        },
        headers=headers
    )
    assert bed_res.status_code == 200
    bed_data = bed_res.json()["data"]
    assert bed_data["bed_number"] == bed_number
    bed_id = bed_data["id"]

    # 5. Check if bed is listed in the dashboard
    dash_res = await client.get("/api/v1/ipd/dashboard/beds", headers=headers)
    assert dash_res.status_code == 200
    beds = dash_res.json()["data"]
    created_bed = next((b for b in beds if b["id"] == bed_id), None)
    assert created_bed is not None
    assert created_bed["bed_number"] == bed_number
    assert created_bed["status"] == "available"

    # 6. Decommission the bed asset
    del_res = await client.delete(f"/api/v1/ipd/beds/{bed_id}", headers=headers)
    assert del_res.status_code == 200

    # 7. Check that bed is removed from the dashboard
    dash_res_after = await client.get("/api/v1/ipd/dashboard/beds", headers=headers)
    assert dash_res_after.status_code == 200
    beds_after = dash_res_after.json()["data"]
    assert not any(b["id"] == bed_id for b in beds_after)


@pytest.mark.asyncio
async def test_ipd_admission_request_workflow(client: AsyncClient):
    # 1. Login as Admin
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "admin@verticalclinic.com", "password": "Admin@verticalclinic.com"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get patient
    pat_res = await client.get("/api/v1/patients/?limit=1", headers=headers)
    patients = pat_res.json()["data"]["items"]
    assert len(patients) > 0
    patient_id = patients[0]["id"]

    # 3. Create Doctor Admission Request
    req_res = await client.post(
        "/api/v1/ipd/admission-requests",
        json={
            "patient_id": patient_id,
            "reason": "Requires 48h observation & IV Fluids",
            "urgency": "urgent"
        },
        headers=headers
    )
    assert req_res.status_code == 200
    req_id = req_res.json()["data"]["request_id"]

    # 4. Fetch Pending Requests
    pending_res = await client.get("/api/v1/ipd/admission-requests/pending", headers=headers)
    assert pending_res.status_code == 200
    pending_items = pending_res.json()["data"]
    matching = [r for r in pending_items if r["id"] == req_id]
    assert len(matching) == 1
    assert matching[0]["urgency"] == "urgent"
    assert matching[0]["reason"] == "Requires 48h observation & IV Fluids"

    # 5. Fulfill Admission Request
    fulfill_res = await client.post(f"/api/v1/ipd/admission-requests/{req_id}/fulfill", headers=headers)
    assert fulfill_res.status_code == 200

    # 6. Verify no longer pending
    pending_res_2 = await client.get("/api/v1/ipd/admission-requests/pending", headers=headers)
    pending_items_2 = pending_res_2.json()["data"]
    assert not any(r["id"] == req_id for r in pending_items_2)


