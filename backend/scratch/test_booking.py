import requests
import json

BASE_URL = "http://localhost:8000/api/v1"

def test_booking():
    # 1. Login
    login_payload = {
        "identifier": "kartikk.brainerhub@gmail.com",
        "password": "Password@123"
    }
    response = requests.post(f"{BASE_URL}/auth/login", json=login_payload)
    print("Login Response Status:", response.status_code)
    login_data = response.json()
    print("Login Response JSON:", json.dumps(login_data, indent=2))
    
    if not login_data.get("success"):
        print("Login failed")
        return
        
    access_token = login_data["data"]["access_token"]
    
    # 2. Get branches
    headers = {"Authorization": f"Bearer {access_token}"}
    branches_res = requests.get(f"{BASE_URL}/branches", headers=headers)
    print("Branches Response:", json.dumps(branches_res.json(), indent=2))
    branch_data = branches_res.json()["data"]
    branch_id = (branch_data["items"] if "items" in branch_data else branch_data)[0]["id"]
    
    # 3. Get doctors
    doctors_res = requests.get(f"{BASE_URL}/doctors", headers=headers)
    print("Doctors Response:", json.dumps(doctors_res.json(), indent=2))
    doctor_data = doctors_res.json()["data"]
    doctor_id = (doctor_data["items"] if "items" in doctor_data else doctor_data)[0]["id"]
    
    print(f"Using Branch ID: {branch_id}")
    print(f"Using Doctor ID: {doctor_id}")
    
    # 4. Get available slots
    slots_res = requests.get(f"{BASE_URL}/appointments/available-slots?doctor_id={doctor_id}&date=2026-07-23", headers=headers)
    slots = slots_res.json()["data"]
    available_slots = [s for s in slots if s["status"] == "available"]
    
    if not available_slots:
        print("No available slots found for 2026-07-23")
        return
        
    target_slot = available_slots[0]["time"]
    print(f"Using Slot: {target_slot}")
    
    # 5. Book appointment
    booking_payload = {
        "doctor_id": doctor_id,
        "branch_id": branch_id,
        "appointment_datetime": f"2026-07-23T{target_slot}:00",
        "consultation_type": "in_person",
        "treatment_type": "Routine Checkup"
    }
    
    booking_res = requests.post(f"{BASE_URL}/appointments", json=booking_payload, headers=headers)
    print("Booking Response Status:", booking_res.status_code)
    print("Booking Response JSON:", json.dumps(booking_res.json(), indent=2))

if __name__ == "__main__":
    test_booking()
