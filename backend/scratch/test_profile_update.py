import requests
import json

BASE_URL = "http://localhost:8000/api/v1"

def test_profile_update():
    # 1. Login
    login_payload = {
        "identifier": "kartikk.brainerhub@gmail.com",
        "password": "Password@123"
    }
    response = requests.post(f"{BASE_URL}/auth/login", json=login_payload)
    login_data = response.json()
    access_token = login_data["data"]["access_token"]
    
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # 2. Get profile
    profile_res = requests.get(f"{BASE_URL}/patients/me", headers=headers)
    print("Initial Profile:")
    print("is_profile_completed:", profile_res.json()["data"]["is_profile_completed"])
    
    # 3. Patch profile
    payload = {
        "phone": "7894561251",
        "emergency_contact_name": "Emergency Person",
        "emergency_contact_phone": "9876543210",
        "allergies": "None",
        "insurance_provider": "",
        "insurance_policy_no": "",
        "address": "Some test address",
        "blood_group": "O+",
        "date_of_birth": "2004-07-22",
        "height": "175",
        "weight": "70",
        "chronic_conditions": "None",
        "is_profile_completed": True
    }
    
    patch_res = requests.patch(f"{BASE_URL}/patients/me", json=payload, headers=headers)
    print("\nPatch Response Status:", patch_res.status_code)
    patch_data = patch_res.json()
    print("Patch Response JSON:")
    print(json.dumps(patch_data, indent=2))
    
    # 4. Get profile again
    profile_res2 = requests.get(f"{BASE_URL}/patients/me", headers=headers)
    print("\nProfile After Patch:")
    print("is_profile_completed:", profile_res2.json()["data"]["is_profile_completed"])

if __name__ == "__main__":
    test_profile_update()
