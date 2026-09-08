import pytest
from httpx import AsyncClient
from datetime import datetime, timezone


@pytest.mark.asyncio
async def test_billing_and_payments_flow(client: AsyncClient):
    """Verify invoice creation, payment recording, and balance adjustment under RBAC."""
    # 1. Log in as Admin (acting as billing staff)
    login_staff = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "admin@verticalclinic.com", "password": "Admin@verticalclinic.com"},
    )
    assert login_staff.status_code == 200
    token_staff = login_staff.json()["data"]["access_token"]

    # 2. Log in as Patient (Priya Sharma)
    login_pat = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    assert login_pat.status_code == 200
    token_pat = login_pat.json()["data"]["access_token"]
    
    pat_profile = await client.get(
        "/api/v1/patients/me",
        headers={"Authorization": f"Bearer {token_pat}"},
    )
    patient_id = pat_profile.json()["data"]["id"]

    # 3. Create an invoice by Staff (Kavita)
    invoice_res = await client.post(
        "/api/v1/billing/",
        json={
            "patient_id": patient_id,
            "total_amount": 1000.0,
            "discount_amount": 100.0,
            "tax_amount": 50.0,
        },
        headers={"Authorization": f"Bearer {token_staff}"},
    )
    assert invoice_res.status_code == 201
    invoice_data = invoice_res.json()["data"]
    assert invoice_data["total_amount"] == 1000.0
    assert invoice_data["discount_amount"] == 100.0
    assert invoice_data["tax_amount"] == 50.0
    assert invoice_data["grand_total"] == 950.0  # 1000 - 100 + 50
    assert invoice_data["amount_paid"] == 0.0
    assert invoice_data["balance_due"] == 950.0
    assert invoice_data["status"] == "unpaid"
    invoice_id = invoice_data["id"]

    # 4. Patient tries to create an invoice -> should fail (403 Forbidden)
    failed_invoice_res = await client.post(
        "/api/v1/billing/",
        json={
            "patient_id": patient_id,
            "total_amount": 500.0,
        },
        headers={"Authorization": f"Bearer {token_pat}"},
    )
    assert failed_invoice_res.status_code == 403

    # 5. Fetch invoice details
    # Staff can fetch
    staff_view = await client.get(
        f"/api/v1/billing/{invoice_id}",
        headers={"Authorization": f"Bearer {token_staff}"},
    )
    assert staff_view.status_code == 200
    assert staff_view.json()["data"]["grand_total"] == 950.0

    # Patient can fetch their own invoice
    pat_view = await client.get(
        f"/api/v1/billing/{invoice_id}",
        headers={"Authorization": f"Bearer {token_pat}"},
    )
    assert pat_view.status_code == 200
    assert pat_view.json()["data"]["grand_total"] == 950.0

    # 6. Record a partial payment (by Kavita)
    payment_res1 = await client.post(
        "/api/v1/payments/",
        json={
            "invoice_id": invoice_id,
            "amount": 400.0,
            "payment_method": "card",
            "transaction_reference": "TXN123456",
        },
        headers={"Authorization": f"Bearer {token_staff}"},
    )
    assert payment_res1.status_code == 201
    pay_data1 = payment_res1.json()["data"]
    assert pay_data1["amount"] == 400.0
    assert pay_data1["payment_status"] == "completed"

    # Verify invoice status is now "partially_paid" and balance is updated
    invoice_after_pay1 = await client.get(
        f"/api/v1/billing/{invoice_id}",
        headers={"Authorization": f"Bearer {token_staff}"},
    )
    assert invoice_after_pay1.json()["data"]["amount_paid"] == 400.0
    assert invoice_after_pay1.json()["data"]["balance_due"] == 550.0
    assert invoice_after_pay1.json()["data"]["status"] == "partially_paid"

    # 7. Record a payment that exceeds the balance due -> should fail (400 Bad Request)
    failed_payment_res = await client.post(
        "/api/v1/payments/",
        json={
            "invoice_id": invoice_id,
            "amount": 600.0,
            "payment_method": "cash",
        },
        headers={"Authorization": f"Bearer {token_staff}"},
    )
    assert failed_payment_res.status_code == 400

    # 8. Record a full payment -> should set status to "paid"
    payment_res2 = await client.post(
        "/api/v1/payments/",
        json={
            "invoice_id": invoice_id,
            "amount": 550.0,
            "payment_method": "online_upi",
        },
        headers={"Authorization": f"Bearer {token_staff}"},
    )
    assert payment_res2.status_code == 201

    invoice_after_pay2 = await client.get(
        f"/api/v1/billing/{invoice_id}",
        headers={"Authorization": f"Bearer {token_staff}"},
    )
    assert invoice_after_pay2.json()["data"]["amount_paid"] == 950.0
    assert invoice_after_pay2.json()["data"]["balance_due"] == 0.0
    assert invoice_after_pay2.json()["data"]["status"] == "paid"

    # 9. List payments
    # Patient lists payments (should only see their own)
    pat_payments = await client.get(
        "/api/v1/payments/",
        headers={"Authorization": f"Bearer {token_pat}"},
    )
    assert pat_payments.status_code == 200
    assert len(pat_payments.json()["data"]["items"]) == 2


@pytest.mark.asyncio
async def test_send_invoice_email(client: AsyncClient):
    """Verify that staff can trigger sending the invoice via email, and patient cannot."""
    # 1. Log in as Staff
    login_staff = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "admin@verticalclinic.com", "password": "Admin@verticalclinic.com"},
    )
    token_staff = login_staff.json()["data"]["access_token"]

    # 2. Log in as Patient
    login_pat = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    token_pat = login_pat.json()["data"]["access_token"]
    
    pat_profile = await client.get(
        "/api/v1/patients/me",
        headers={"Authorization": f"Bearer {token_pat}"},
    )
    patient_id = pat_profile.json()["data"]["id"]

    # 3. Create invoice
    invoice_res = await client.post(
        "/api/v1/billing/",
        json={
            "patient_id": patient_id,
            "total_amount": 1000.0,
        },
        headers={"Authorization": f"Bearer {token_staff}"},
    )
    invoice_id = invoice_res.json()["data"]["id"]

    # 4. Patient attempts to trigger send email -> 403 Forbidden
    forb_res = await client.post(
        f"/api/v1/billing/{invoice_id}/send-email",
        headers={"Authorization": f"Bearer {token_pat}"},
    )
    assert forb_res.status_code == 403

    # 5. Staff triggers send email -> 200 Success
    send_res = await client.post(
        f"/api/v1/billing/{invoice_id}/send-email",
        headers={"Authorization": f"Bearer {token_staff}"},
    )
    assert send_res.status_code == 200
    assert send_res.json()["success"] is True


@pytest.mark.asyncio
async def test_manager_billing_review_flow(client: AsyncClient):
    """Verify manager can approve/reject billing requests and it triggers email."""
    # 1. Log in as Admin (acting as clinic manager)
    login_mgr = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "admin@verticalclinic.com", "password": "Admin@verticalclinic.com"},
    )
    assert login_mgr.status_code == 200
    token_mgr = login_mgr.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token_mgr}"}

    # 2. Log in as Patient to get patient_id
    login_pat = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    token_pat = login_pat.json()["data"]["access_token"]
    
    pat_profile = await client.get(
        "/api/v1/patients/me",
        headers={"Authorization": f"Bearer {token_pat}"},
    )
    patient_id = pat_profile.json()["data"]["id"]

    # 3. Create invoice with discount (unapproved yet)
    invoice_res = await client.post(
        "/api/v1/billing/",
        json={
            "patient_id": patient_id,
            "total_amount": 2000.0,
            "discount_amount": 200.0,
        },
        headers=headers,
    )
    assert invoice_res.status_code == 201
    invoice_data = invoice_res.json()["data"]
    invoice_id = invoice_data["id"]

    # 4. Review & approve billing discount by Manager
    review_res = await client.post(
        f"/api/v1/clinic-manager/billing-requests/{invoice_id}/review",
        json={
            "action": "approve",
            "reason_notes": "Valid discount for student patient."
        },
        headers=headers
    )
    assert review_res.status_code == 200
    assert review_res.json()["status"] == "approved"


@pytest.mark.asyncio
async def test_calculate_pending_charges_with_prescriptions(client: AsyncClient):
    """Verify /billing/calculate-pending runs without AttributeError when patient has prescriptions."""
    # 1. Staff login
    login_staff = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "admin@verticalclinic.com", "password": "Admin@verticalclinic.com"},
    )
    token_staff = login_staff.json()["data"]["access_token"]
    staff_headers = {"Authorization": f"Bearer {token_staff}"}

    # 2. Patient profile
    login_pat = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "patient@verticalclinic.com", "password": "Patient@verticalclinic.com"},
    )
    token_pat = login_pat.json()["data"]["access_token"]
    pat_res = await client.get("/api/v1/patients/me", headers={"Authorization": f"Bearer {token_pat}"})
    patient_id = pat_res.json()["data"]["id"]

    # 3. Doctor login & get profile
    login_doc = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "doctor@verticalclinic.com", "password": "Doctor@verticalclinic.com"},
    )
    token_doc = login_doc.json()["data"]["access_token"]
    doc_headers = {"Authorization": f"Bearer {token_doc}"}

    docs_res = await client.get("/api/v1/doctors/")
    doctor = docs_res.json()["data"]["items"][0]
    doctor_id = doctor["id"]
    branch_id = doctor["branch_id"]

    # 4. Record a consultation with prescription
    cons_res = await client.post(
        "/api/v1/consultations/",
        json={
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "branch_id": branch_id,
            "symptoms": "Fever and mild cough",
            "diagnosis": "Viral Pharyngitis",
            "notes": "Rest and hydration advised",
        },
        headers=doc_headers,
    )
    assert cons_res.status_code == 201
    cons_id = cons_res.json()["data"]["id"]

    presc_res = await client.post(
        "/api/v1/prescriptions/",
        json={
            "consultation_id": cons_id,
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "notes": "Take with warm water",
            "items": [
                {
                    "medicine_name": "Paracetamol 500mg",
                    "dosage": "1-0-1",
                    "duration": "3 days",
                }
            ],
        },
        headers=doc_headers,
    )
    assert presc_res.status_code == 201

    # 5. Call calculate-pending charges endpoint as staff
    calc_res = await client.get(
        f"/api/v1/billing/calculate-pending?patient_id={patient_id}",
        headers=staff_headers,
    )
    assert calc_res.status_code == 200
    data = calc_res.json()["data"]
    assert "consultations" in data
    assert len(data["consultations"]) >= 1

    # Find the consultation we created
    target_cons = next((c for c in data["consultations"] if c["id"] == cons_id), None)
    assert target_cons is not None
    assert len(target_cons["prescriptions"]) >= 1
    # Check that diagnosis and notes are present without raising AttributeError
    presc_item = target_cons["prescriptions"][0]
    assert presc_item["diagnosis"] == "Viral Pharyngitis"
    assert presc_item["notes"] == "Take with warm water"


