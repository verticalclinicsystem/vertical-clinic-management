import pytest
from httpx import AsyncClient
from datetime import datetime, timedelta, timezone


@pytest.mark.asyncio
async def test_consultation_prescription_treatment_flow(client: AsyncClient):
    """Verify recording a consultation, issuing a prescription, and setting up a treatment plan."""
    # 1. Log in as Doctor (Dr. Rohan Mehta)
    login_doc = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "doctor@verticalclinic.com", "password": "Doctor@verticalclinic.com"},
    )
    token_doc = login_doc.json()["data"]["access_token"]

    # 2. Log in as Patient (Priya Sharma) to get patient/appointment context
    login_pat = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    token_pat = login_pat.json()["data"]["access_token"]
    patient_id = login_pat.json()["data"]["user"]["id"] # wait, let's query patient profile to get patient.id
    
    pat_profile = await client.get(
        "/api/v1/patients/me",
        headers={"Authorization": f"Bearer {token_pat}"},
    )
    patient_id = pat_profile.json()["data"]["id"]

    # Let's get Rohan's doctor profile details
    docs_res = await client.get("/api/v1/doctors/")
    rohan_doc = next(d for d in docs_res.json()["data"]["items"] if "Rohan" in d["user"]["full_name"])
    doctor_id = rohan_doc["id"]
    branch_id = rohan_doc["branch_id"]

    # 3. Create a dummy appointment to link
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).replace(hour=14, minute=0, second=0, microsecond=0)
    appt_res = await client.post(
        "/api/v1/appointments/",
        json={
            "doctor_id": doctor_id,
            "branch_id": branch_id,
            "appointment_datetime": tomorrow.isoformat(),
            "treatment_type": "Consultation",
            "consultation_type": "in_person",
            "notes": "Initial visit.",
        },
        headers={"Authorization": f"Bearer {token_pat}"},
    )
    appt_id = appt_res.json()["data"]["id"]

    # 4. Record a Consultation (by Doctor Rohan)
    consult_res = await client.post(
        "/api/v1/consultations/",
        json={
            "appointment_id": appt_id,
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "branch_id": branch_id,
            "symptoms": "Severe pain in lower jaw",
            "diagnosis": "Acute Pulpitis - Tooth 36",
            "notes": "Patient needs root canal treatment.",
            "vitals_bp": "120/80",
            "vitals_pulse": 72,
            "vitals_temperature": 98.6,
        },
        headers={"Authorization": f"Bearer {token_doc}"},
    )
    assert consult_res.status_code == 201
    consult_data = consult_res.json()["data"]
    assert consult_data["symptoms"] == "Severe pain in lower jaw"
    assert consult_data["diagnosis"] == "Acute Pulpitis - Tooth 36"
    consultation_id = consult_data["id"]

    # Verify that the linked appointment is automatically updated to "completed"
    check_appt = await client.get(
        f"/api/v1/appointments/{appt_id}",
        headers={"Authorization": f"Bearer {token_pat}"},
    )
    assert check_appt.json()["data"]["status"] == "completed"

    # 5. Issue a Prescription for this consultation (by Doctor Rohan)
    prescription_res = await client.post(
        "/api/v1/prescriptions/",
        json={
            "consultation_id": consultation_id,
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "notes": "Take medicines after food. Avoid cold drinks.",
            "items": [
                {
                    "medicine_name": "Amoxicillin 500mg",
                    "dosage": "1-0-1",
                    "duration": "5 days",
                    "instructions": "After food",
                },
                {
                    "medicine_name": "Paracetamol 650mg",
                    "dosage": "1-1-1",
                    "duration": "3 days",
                    "instructions": "Only in case of pain",
                }
            ],
        },
        headers={"Authorization": f"Bearer {token_doc}"},
    )
    assert prescription_res.status_code == 201
    presc_data = prescription_res.json()["data"]
    assert presc_data["notes"] == "Take medicines after food. Avoid cold drinks."
    assert len(presc_data["items"]) == 2
    assert presc_data["items"][0]["medicine_name"] == "Amoxicillin 500mg"
    prescription_id = presc_data["id"]

    # 6. Create a Treatment Plan with procedures (by Doctor Rohan)
    plan_res = await client.post(
        "/api/v1/treatment-plans/",
        json={
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "title": "Root Canal Treatment - Tooth 36",
            "status": "active",
            "total_cost": 4500.0,
            "notes": "Requires 2 sittings.",
            "procedures": [
                {
                    "procedure_name": "Access Opening & Cleaning",
                    "cost": 2000.0,
                    "status": "planned",
                    "notes": "First sitting",
                },
                {
                    "procedure_name": "Obturation & Permanent Filling",
                    "cost": 2500.0,
                    "status": "planned",
                    "notes": "Second sitting",
                }
            ]
        },
        headers={"Authorization": f"Bearer {token_doc}"},
    )
    assert plan_res.status_code == 201
    plan_data = plan_res.json()["data"]
    assert plan_data["title"] == "Root Canal Treatment - Tooth 36"
    assert len(plan_data["procedures"]) == 2
    assert plan_data["procedures"][0]["procedure_name"] == "Access Opening & Cleaning"
    plan_id = plan_data["id"]

    # 7. Check Patient views only their own data
    # Patient get consultation details
    pat_consult = await client.get(
        f"/api/v1/consultations/{consultation_id}",
        headers={"Authorization": f"Bearer {token_pat}"},
    )
    assert pat_consult.status_code == 200
    assert pat_consult.json()["data"]["symptoms"] == "Severe pain in lower jaw"

    # Patient list prescriptions
    pat_presc = await client.get(
        "/api/v1/prescriptions/",
        headers={"Authorization": f"Bearer {token_pat}"},
    )
    assert pat_presc.status_code == 200
    assert len(pat_presc.json()["data"]["items"]) >= 1

    # Patient get treatment plan
    pat_plan = await client.get(
        f"/api/v1/treatment-plans/{plan_id}",
        headers={"Authorization": f"Bearer {token_pat}"},
    )
    assert pat_plan.status_code == 200
    assert pat_plan.json()["data"]["title"] == "Root Canal Treatment - Tooth 36"


@pytest.mark.asyncio
async def test_ai_clinical_assistance(client: AsyncClient):
    """Verify AI analysis endpoints for voice to text dictation and fallback logic."""
    # 1. Log in as Doctor
    login_doc = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "doctor@verticalclinic.com", "password": "Doctor@verticalclinic.com"},
    )
    token_doc = login_doc.json()["data"]["access_token"]

    # 2. Test analysis with a scenario
    res_scenario = await client.post(
        "/api/v1/ai/analyze-notes",
        json={"text": "Adjusting braces for patient", "scenario": "braces"},
        headers={"Authorization": f"Bearer {token_doc}"},
    )
    assert res_scenario.status_code == 200
    data = res_scenario.json()["data"]
    assert "braces" in data["summary"].lower() or "braces" in data["suggested_treatment_plan"].lower()

    # 3. Test analysis with keyword fallback
    res_keyword = await client.post(
        "/api/v1/ai/analyze-notes",
        json={"text": "Patient has severe pain in molar tooth 19 and wants root canal treatment", "scenario": None},
        headers={"Authorization": f"Bearer {token_doc}"},
    )
    assert res_keyword.status_code == 200
    data_kw = res_keyword.json()["data"]
    assert "root canal" in data_kw["suggested_treatment_plan"].lower()
    assert len(data_kw["suggested_medications"]) > 0

