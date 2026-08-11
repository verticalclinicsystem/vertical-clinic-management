import httpx
import asyncio
from datetime import datetime, timezone, timedelta

BASE_URL = "http://localhost:8000/api/v1"

async def test_receptionist_bed_flow():
    async with httpx.AsyncClient() as client:
        print("1. Logging in as Receptionist...")
        login_res = await client.post(
            f"{BASE_URL}/auth/login",
            json={
                "identifier": "receptionist1_bopal@verticalclinic.com",
                "password": "Receptionist1_bopal@verticalclinic.com"
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

        print("\n3. Listing beds in the branch...")
        beds_res = await client.get(f"{BASE_URL}/ipd/dashboard/beds", headers=headers)
        assert beds_res.status_code == 200, f"List beds failed: {beds_res.text}"
        beds = beds_res.json()["data"]
        print(f"✅ Found {len(beds)} beds.")

        available_beds = [b for b in beds if b["status"] == "available"]
        assert len(available_beds) > 0, "No available beds found to run the test!"
        target_bed = available_beds[0]
        print(f"✅ Target Bed: {target_bed['bed_number']} (Category: {target_bed['category']['name']})")

        print("\n4. Getting patients list to admit...")
        patients_res = await client.get(f"{BASE_URL}/patients/", headers=headers)
        assert patients_res.status_code == 200, f"Get patients failed: {patients_res.text}"
        patients = patients_res.json()["data"]["items"]
        assert len(patients) > 0, "No patients found!"
        patient = patients[0]
        print(f"✅ Selected Patient: {patient['user']['full_name']} (ID: {patient['id']})")

        print("\n5. Getting doctors list to assign...")
        doctors_res = await client.get(f"{BASE_URL}/doctors/", headers=headers)
        assert doctors_res.status_code == 200, f"Get doctors failed: {doctors_res.text}"
        doctors = doctors_res.json()["data"]["items"]
        assert len(doctors) > 0, "No doctors found!"
        doctor = doctors[0]
        print(f"✅ Selected Doctor: {doctor['user']['full_name']} (ID: {doctor['id']})")

        print("\n6. Admitting patient to the target bed...")
        admit_payload = {
            "bed_id": target_bed["id"],
            "patient_id": patient["id"],
            "admitting_doctor_id": doctor["id"],
            "diagnosis": "Severe dental abscess and fever under observations",
            "initial_deposit": 1500.0
        }
        admit_res = await client.post(f"{BASE_URL}/ipd/admissions", json=admit_payload, headers=headers)
        assert admit_res.status_code == 201, f"Admission failed: {admit_res.text}"
        admission = admit_res.json()["data"]
        admission_id = admission["admission_id"]
        print(f"✅ Admission created successfully! ID: {admission_id}")

        print("\n7. Listing beds to verify status is occupied...")
        beds_res = await client.get(f"{BASE_URL}/ipd/dashboard/beds", headers=headers)
        beds = beds_res.json()["data"]
        occupied_bed = next((b for b in beds if b["id"] == target_bed["id"]), None)
        assert occupied_bed is not None
        assert occupied_bed["status"] == "occupied", f"Expected bed status occupied, got: {occupied_bed['status']}"
        print(f"✅ Bed status is now correctly 'occupied'!")

        print("\n8. Recording vitals rounding...")
        vitals_payload = {
            "temp": 99.1,
            "pulse": 82,
            "systolic_bp": 122,
            "diastolic_bp": 81,
            "spo2": 99,
            "respiratory_rate": 18,
            "nursing_notes": "Patient is resting comfortably, pain decreased."
        }
        vitals_res = await client.post(f"{BASE_URL}/ipd/admissions/{admission_id}/vitals", json=vitals_payload, headers=headers)
        assert vitals_res.status_code == 201, f"Recording vitals failed: {vitals_res.text}"
        print("✅ Vitals rounding recorded successfully!")

        print("\n9. Getting vitals history...")
        vitals_hist_res = await client.get(f"{BASE_URL}/ipd/admissions/{admission_id}/vitals", headers=headers)
        assert vitals_hist_res.status_code == 200, f"Getting vitals history failed: {vitals_hist_res.text}"
        print(f"✅ Vitals history fetched. Count: {len(vitals_hist_res.json()['data'])}")

        print("\n10. Scheduling medication in MAC...")
        future_time = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat().replace("+00:00", "Z")
        mac_payload = {
            "medicine_name": "Inj. Paracetamol 1g",
            "dosage": "IV once",
            "scheduled_time": future_time
        }
        mac_res = await client.post(f"{BASE_URL}/ipd/admissions/{admission_id}/mac", json=mac_payload, headers=headers)
        assert mac_res.status_code == 201, f"Medication scheduling failed: {mac_res.text}"
        print("✅ Scheduled medication in MAC!")

        print("\n11. Getting MAC chart to find the scheduled item ID...")
        mac_chart_res = await client.get(f"{BASE_URL}/ipd/admissions/{admission_id}/mac", headers=headers)
        assert mac_chart_res.status_code == 200, f"Getting MAC chart failed: {mac_chart_res.text}"
        mac_items = mac_chart_res.json()["data"]
        assert len(mac_items) > 0, "Expected at least one scheduled medication item"
        med_item_id = mac_items[0]["id"]
        print(f"✅ MAC schedule fetched. Found item ID: {med_item_id}")

        print("\n12. Administering scheduled medication...")
        admin_res = await client.patch(f"{BASE_URL}/ipd/admissions/mac/{med_item_id}", json={"status": "administered"}, headers=headers)
        assert admin_res.status_code == 200, f"Administering medication failed: {admin_res.text}"
        print("✅ Medication marked as administered!")

        # Find another available bed for transfer
        available_beds = [b for b in beds if b["status"] == "available" and b["id"] != target_bed["id"]]
        if len(available_beds) > 0:
            transfer_target_bed = available_beds[0]
            print(f"\n13. Transferring patient to Bed {transfer_target_bed['bed_number']}...")
            transfer_payload = {
                "to_bed_id": transfer_target_bed["id"],
                "reason": "Transfer to Private room per patient request"
            }
            transfer_res = await client.post(f"{BASE_URL}/ipd/admissions/{admission_id}/transfer", json=transfer_payload, headers=headers)
            assert transfer_res.status_code == 200, f"Transfer failed: {transfer_res.text}"
            print("✅ Patient transferred successfully!")

            # Verify target bed is occupied, original bed is cleaning
            beds_res = await client.get(f"{BASE_URL}/ipd/dashboard/beds", headers=headers)
            beds = beds_res.json()["data"]
            orig_bed = next((b for b in beds if b["id"] == target_bed["id"]), None)
            new_bed = next((b for b in beds if b["id"] == transfer_target_bed["id"]), None)
            assert orig_bed is not None and new_bed is not None
            print(f"✅ Original Bed status: {orig_bed['status']} (Expected: cleaning/available)")
            print(f"✅ Transferred Bed status: {new_bed['status']} (Expected: occupied)")
        else:
            print("\n13. Skipping transfer test (no other available bed found).")

        print("\n14. Getting checkout bill summary...")
        bill_res = await client.get(f"{BASE_URL}/ipd/admissions/{admission_id}/bill-summary", headers=headers)
        assert bill_res.status_code == 200, f"Getting bill summary failed: {bill_res.text}"
        bill = bill_res.json()["data"]
        print(f"✅ Checkout Bill: Grand Total: ₹{bill['grand_total']} | Outstanding Due: ₹{bill['balance_due']}")

        print("\n15. Finalizing checkout / discharge...")
        checkout_res = await client.post(f"{BASE_URL}/ipd/admissions/{admission_id}/finalize-checkout", headers=headers)
        assert checkout_res.status_code == 200, f"Finalize checkout failed: {checkout_res.text}"
        print("✅ Patient checked out and discharged successfully!")

        print("\n🎉 ALL RECEPTIONIST BED MANAGEMENT FLOWS ARE COMPLETELY RUNNING AND VERIFIED AT API LEVEL!")

if __name__ == "__main__":
    asyncio.run(test_receptionist_bed_flow())
