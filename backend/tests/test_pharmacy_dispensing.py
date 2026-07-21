import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy import select
from app.models.patient import Patient
from app.models.doctor import Doctor
from app.models.consultation import Consultation
from app.models.inventory import Medicine, StockTransaction
from app.models.prescription import Prescription


@pytest.mark.asyncio
async def test_pharmacy_inventory_and_dispense_workflow(client: AsyncClient, db_session):
    """Test full pharmacy workflow: inventory listing, adding medicine, and dispensing prescriptions."""
    # 1. Log in as Doctor Rohan to create a prescription later
    login_doc = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "doctor@verticalclinic.com", "password": "Doctor@verticalclinic.com"},
    )
    token_doc = login_doc.json()["data"]["access_token"]

    # 2. Query patient and doctor profiles directly from database to create a consultation
    patient = (await db_session.execute(select(Patient))).scalars().first()
    doctor = (await db_session.execute(select(Doctor))).scalars().first()
    assert patient is not None
    assert doctor is not None

    # Insert a consultation directly to database to bypass appointment constraints
    consultation = Consultation(
        id=uuid.uuid4(),
        patient_id=patient.id,
        doctor_id=doctor.id,
        branch_id=doctor.branch_id,
        symptoms="Mild tooth sensitivity",
        diagnosis="Enamel erosion",
    )
    db_session.add(consultation)
    await db_session.commit()

    # 3. Create a prescription via Doctor Rohan
    rx_response = await client.post(
        "/api/v1/prescriptions/",
        json={
            "consultation_id": str(consultation.id),
            "patient_id": str(patient.id),
            "doctor_id": str(doctor.id),
            "notes": "Dispense 1 pack of Paracetamol.",
            "items": [
                {
                    "medicine_name": "Paracetamol 650mg",
                    "dosage": "1-0-1",
                    "duration": "3 days",
                    "instructions": "After meals",
                }
            ],
        },
        headers={"Authorization": f"Bearer {token_doc}"},
    )
    assert rx_response.status_code == 201
    rx_data = rx_response.json()["data"]
    assert rx_data["status"] == "Pending"
    prescription_id = rx_data["id"]

    # Verify that initial stock of Paracetamol 650mg is unchanged (320 units)
    med_paracetamol = (
        await db_session.execute(
            select(Medicine).where(Medicine.name == "Paracetamol 650mg")
        )
    ).scalar_one()
    initial_stock = med_paracetamol.stock_qty
    assert initial_stock == 320

    # 4. Log in as Pharmacist Meera Iyer
    login_pharma = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "pharmacist@verticalclinic.com", "password": "Pharmacist@verticalclinic.com"},
    )
    assert login_pharma.status_code == 200
    token_pharma = login_pharma.json()["data"]["access_token"]

    # 5. Test Listing Inventory via Pharmacist
    inv_res = await client.get(
        "/api/v1/inventory/",
        headers={"Authorization": f"Bearer {token_pharma}"},
    )
    assert inv_res.status_code == 200
    inv_data = inv_res.json()["data"]
    assert inv_data["total"] >= 5
    assert any(m["name"] == "Paracetamol 650mg" for m in inv_data["items"])

    # 6. Test Adding a new Medicine SKU via Pharmacist
    new_med_res = await client.post(
        "/api/v1/inventory/",
        json={
            "name": "Amoxicillin 250mg",
            "category": "Antibiotic",
            "unit": "Capsules",
            "unit_price": 5.0,
            "stock_qty": 150,
            "reorder_level": 40,
            "supplier": "Cipla Ltd.",
            "hsn_code": "30041010",
        },
        headers={"Authorization": f"Bearer {token_pharma}"},
    )
    assert new_med_res.status_code == 201
    assert new_med_res.json()["data"]["name"] == "Amoxicillin 250mg"

    # 7. Test Dispensing the Prescription
    dispense_res = await client.post(
        f"/api/v1/prescriptions/{prescription_id}/dispense",
        headers={"Authorization": f"Bearer {token_pharma}"},
    )
    assert dispense_res.status_code == 200
    dispensed_data = dispense_res.json()["data"]
    assert dispensed_data["status"] == "Dispensed"

    # Verify that medicine stock was reduced by 10 units (from 320 to 310)
    db_session.expire_all()
    db_med = (
        await db_session.execute(
            select(Medicine).where(Medicine.name == "Paracetamol 650mg")
        )
    ).scalar_one()
    assert db_med.stock_qty == 310

    # Check that stock transaction was logged
    tx = (
        await db_session.execute(
            select(StockTransaction).where(
                StockTransaction.reference_id == uuid.UUID(prescription_id)
            )
        )
    ).scalars().first()
    assert tx is not None
    assert tx.change_qty == -10
    assert tx.transaction_type == "dispense"
