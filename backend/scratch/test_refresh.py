import requests
import json
from jose import jwt
from app.config import settings

BASE_URL = "http://localhost:8000/api/v1"

def test_refresh_flow():
    # 1. Login
    login_payload = {
        "identifier": "kartikk.brainerhub@gmail.com",
        "password": "Password@123"
    }
    response = requests.post(f"{BASE_URL}/auth/login", json=login_payload)
    login_data = response.json()
    
    if not login_data.get("success"):
        print("Login failed:", login_data)
        return
        
    access_token = login_data["data"]["access_token"]
    refresh_token = login_data["data"]["refresh_token"]
    
    print("\n=== LOGIN ACCESS TOKEN ===")
    try:
        decoded_login = jwt.decode(access_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        print("Decoded Login Token:", json.dumps(decoded_login, indent=2))
    except Exception as e:
        print("Failed to decode login token:", e)
        
    # Test appointments with login token
    headers_login = {"Authorization": f"Bearer {access_token}"}
    res_appt_login = requests.get(f"{BASE_URL}/appointments", headers=headers_login)
    print("Appointments with Login Token status:", res_appt_login.status_code)
    
    # 2. Call refresh token endpoint
    refresh_res = requests.post(f"{BASE_URL}/auth/refresh-token", json={"refresh_token": refresh_token})
    print("\n=== REFRESH RESPONSE ===")
    print("Refresh status:", refresh_res.status_code)
    refresh_data = refresh_res.json()
    print("Refresh JSON:", json.dumps(refresh_data, indent=2))
    
    if not refresh_data.get("success"):
        print("Refresh failed")
        return
        
    refreshed_access_token = refresh_data["data"]["access_token"]
    
    print("\n=== REFRESHED ACCESS TOKEN ===")
    try:
        decoded_refreshed = jwt.decode(refreshed_access_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        print("Decoded Refreshed Token:", json.dumps(decoded_refreshed, indent=2))
    except Exception as e:
        print("Failed to decode refreshed token:", e)
        
    # Test appointments with refreshed token
    headers_refreshed = {"Authorization": f"Bearer {refreshed_access_token}"}
    res_appt_refreshed = requests.get(f"{BASE_URL}/appointments", headers=headers_refreshed)
    print("Appointments with Refreshed Token status:", res_appt_refreshed.status_code)
    print("Appointments with Refreshed Token JSON:", json.dumps(res_appt_refreshed.json(), indent=2))

if __name__ == "__main__":
    test_refresh_flow()
