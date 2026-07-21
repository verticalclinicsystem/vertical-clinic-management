import httpx
import asyncio

BASE_URL = "http://localhost:8000/api/v1"

async def test_receptionist_api_flow():
    async with httpx.AsyncClient() as client:
        print("1. Logging in as Receptionist...")
        login_res = await client.post(
            f"{BASE_URL}/auth/login",
            json={
                "identifier": "receptionist@verticalclinic.com",
                "password": "Receptionist@123"
            }
        )
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        token_data = login_res.json()["data"]
        token = token_data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("✅ Receptionist logged in successfully!")

        print("\n2. Getting current user profile info...")
        me_res = await client.get(f"{BASE_URL}/auth/me", headers=headers)
        assert me_res.status_code == 200, f"Get me failed: {me_res.text}"
        user_info = me_res.json()["data"]
        branch_id = user_info["branch_id"]
        print(f"✅ Current User: {user_info['full_name']} | Branch ID: {branch_id}")

        print("\n3. Listing appointments for branch...")
        appts_res = await client.get(f"{BASE_URL}/appointments/?branch_id={branch_id}", headers=headers)
        assert appts_res.status_code == 200, f"List appointments failed: {appts_res.text}"
        appts = appts_res.json()["data"]["items"]
        print(f"✅ Found {len(appts)} appointments for today/branch")

        # Let's find one that is pending or confirmed to test check-in
        pending_appt = next((a for a in appts if a["status"] in ["pending", "confirmed"]), None)
        if pending_appt:
            print(f"\n4. Performing check-in on appointment {pending_appt['id']}...")
            checkin_res = await client.patch(f"{BASE_URL}/appointments/{pending_appt['id']}/check-in", headers=headers)
            assert checkin_res.status_code == 200, f"Check-in failed: {checkin_res.text}"
            print("✅ Checked in successfully!")
        else:
            print("\n4. Skipping check-in test (no pending/confirmed appt found).")

        print("\n5. Registering a new walk-in patient...")
        reg_payload = {
            "email": "aarav.nair@example.com",
            "phone": "+919900990099",
            "full_name": "Aarav Nair",
            "password": "Patient123!"
        }
        # Check if patient already exists, if so delete/use existing or create new with random phone/email
        import time
        ts = str(int(time.time()))[-6:]
        reg_payload["email"] = f"aarav.nair{ts}@example.com"
        reg_payload["phone"] = f"+9199{ts}99"

        reg_res = await client.post(f"{BASE_URL}/auth/register", json=reg_payload)
        # Note: public registration endpoint
        assert reg_res.status_code == 201, f"Registration failed: {reg_res.text}"
        registered_user = reg_res.json()["data"]
        print(f"✅ Patient registered: {registered_user['email']}")

        print("\n5.5. Fetching OTP from DB and verifying registration...")
        from app.db.session import AsyncSessionLocal
        from app.models.otp import OtpRecord
        from sqlalchemy import select
        async with AsyncSessionLocal() as db_session:
            otp_stmt = select(OtpRecord).filter(OtpRecord.email == reg_payload["email"]).order_by(OtpRecord.created_at.desc())
            otp_res = await db_session.execute(otp_stmt)
            otp_obj = otp_res.scalars().first()
            assert otp_obj is not None, "OTP not found in DB!"
            otp_code = otp_obj.code
            print(f"   Found OTP Code: {otp_code}")

        verify_res = await client.post(
            f"{BASE_URL}/auth/verify-otp",
            json={
                "email": reg_payload["email"],
                "otp": otp_code
            }
        )
        assert verify_res.status_code == 200, f"OTP verification failed: {verify_res.text}"
        print("✅ Patient registration verified successfully with OTP!")

        print("\n6. Searching for the new patient's profile by name...")
        search_res = await client.get(f"{BASE_URL}/patients/?search={reg_payload['full_name']}", headers=headers)
        assert search_res.status_code == 200, f"Patient search failed: {search_res.text}"
        patients_list = search_res.json()["data"]["items"]
        assert len(patients_list) > 0, "No patients matched the registered name"
        patient_profile = patients_list[0]
        patient_id = patient_profile["id"]
        print(f"✅ Found Patient profile ID: {patient_id}")

        print("\n7. Updating clinical demographics...")
        update_payload = {
            "date_of_birth": "1995-05-12T00:00:00Z",
            "gender": "Male",
            "address": "Bopal, Ahmedabad",
            "preferred_branch_id": branch_id
        }
        update_res = await client.put(f"{BASE_URL}/patients/{patient_id}", json=update_payload, headers=headers)
        assert update_res.status_code == 200, f"Update profile failed: {update_res.text}"
        print("✅ Patient profile updated successfully!")

        print("\n8. Activating the patient profile...")
        activate_res = await client.post(f"{BASE_URL}/patients/{patient_id}/activate", headers=headers)
        assert activate_res.status_code == 200, f"Activate failed: {activate_res.text}"
        print("✅ Patient profile activated!")

        # Let's get a doctor ID to schedule an appointment
        print("\n9. Fetching doctors at this branch...")
        doctors_res = await client.get(f"{BASE_URL}/doctors/?limit=100", headers=headers)
        assert doctors_res.status_code == 200, f"Fetch doctors failed: {doctors_res.text}"
        doctors = doctors_res.json()["data"]["items"]
        branch_doctors = [d for d in doctors if d["branch_id"] == branch_id]
        assert len(branch_doctors) > 0, "No doctors found at this branch"
        doctor_id = branch_doctors[0]["id"]
        print(f"✅ Found Doctor ID: {doctor_id} practicing at branch")

        print("\n10. Scheduling a new appointment...")
        from datetime import datetime, timedelta
        target_date = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        slots_res = await client.get(
            f"{BASE_URL}/appointments/available-slots?doctor_id={doctor_id}&date={target_date}&consultation_type=in_person",
            headers=headers
        )
        assert slots_res.status_code == 200, f"Failed to retrieve available slots: {slots_res.text}"
        available_slots = [s for s in slots_res.json().get("data", []) if s.get("status") == "available"]
        
        if not available_slots:
            for offset in range(2, 8):
                target_date = (datetime.now() + timedelta(days=offset)).strftime("%Y-%m-%d")
                slots_res = await client.get(
                    f"{BASE_URL}/appointments/available-slots?doctor_id={doctor_id}&date={target_date}&consultation_type=in_person",
                    headers=headers
                )
                available_slots = [s for s in slots_res.json().get("data", []) if s.get("status") == "available"]
                if available_slots:
                    break
        
        assert len(available_slots) > 0, "No available slots found for the doctor over the next week"
        selected_slot = available_slots[0]
        start_time = selected_slot["time"]
        appt_time = f"{target_date}T{start_time}:00Z"
        
        appt_payload = {
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "branch_id": branch_id,
            "appointment_datetime": appt_time,
            "treatment_type": "Routine Checkup",
            "consultation_type": "in_person",
            "notes": "Walk-in registration testing."
        }
        appt_res = await client.post(f"{BASE_URL}/appointments/", json=appt_payload, headers=headers)
        assert appt_res.status_code == 201, f"Booking appointment failed: {appt_res.text}"
        booked_appt = appt_res.json()["data"]
        print(f"✅ Appointment booked successfully for date: {booked_appt['appointment_datetime']}")

        print("\n11. Generating billing invoice...")
        invoice_payload = {
            "patient_id": patient_id,
            "total_amount": 1200.0,
            "discount_amount": 200.0,
            "tax_amount": 50.0,
            "status": "unpaid"
        }
        invoice_res = await client.post(f"{BASE_URL}/billing/", json=invoice_payload, headers=headers)
        assert invoice_res.status_code == 201, f"Generating invoice failed: {invoice_res.text}"
        invoice = invoice_res.json()["data"]
        invoice_id = invoice["id"]
        print(f"✅ Invoice generated! Number: {invoice['invoice_number']} | Grand Total: {invoice['grand_total']} | Balance Due: {invoice['balance_due']}")

        print("\n12. Recording payment...")
        payment_payload = {
            "invoice_id": invoice_id,
            "amount": invoice["balance_due"],
            "payment_method": "cash",
            "transaction_reference": "REF12345"
        }
        payment_res = await client.post(f"{BASE_URL}/payments/", json=payment_payload, headers=headers)
        assert payment_res.status_code == 201, f"Recording payment failed: {payment_res.text}"
        payment = payment_res.json()["data"]
        print(f"✅ Payment recorded! Paid: {payment['amount']}")

        print("\n13. Fetching receipt PDF...")
        pdf_res = await client.get(f"{BASE_URL}/billing/{invoice_id}/pdf", headers=headers)
        assert pdf_res.status_code == 200, f"PDF fetch failed: {pdf_res.text}"
        assert pdf_res.headers.get("content-type") == "application/pdf", f"Expected PDF but got: {pdf_res.headers.get('content-type')}"
        print("✅ Receipt PDF generated and downloaded successfully!")

        print("\n🎉 ALL RECEPTIONIST API WORKFLOWS ARE VERIFIED AND WORKING PERFECTLY!")

if __name__ == "__main__":
    asyncio.run(test_receptionist_api_flow())
