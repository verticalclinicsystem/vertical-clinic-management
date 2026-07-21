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
