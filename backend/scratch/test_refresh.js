import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

async function test() {
  try {
    // 1. Login
    console.log("Logging in...");
    const loginRes = await axios.post(`${API_BASE_URL}/api/v1/auth/login`, {
      identifier: 'patient1_bopal@verticalclinic.com',
      password: 'Password123!',
    });

    const { access_token, refresh_token } = loginRes.data.data;
    console.log("Login successful. Access token:", access_token.substring(0, 15) + "...");

    // Create axios instance with interceptor
    const api = axios.create({
      baseURL: `${API_BASE_URL}/api/v1`,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    api.interceptors.request.use((config) => {
      config.headers.Authorization = `Bearer ${access_token}`;
      return config;
    });

    // 2. Perform concurrent requests like fetchPortalData
    console.log("Sending concurrent dashboard requests...");
    const urls = [
      '/patients/me',
      '/patients/me/dashboard',
      '/patients/me/statistics',
      '/patients/me/timeline',
      '/patients/me/preferences',
      '/branches',
      '/doctors',
    ];

    const results = await Promise.allSettled(
      urls.map((url) => api.get(url))
    );

    results.forEach((res, idx) => {
      const url = urls[idx];
      if (res.status === 'fulfilled') {
        console.log(`✅ ${url}: 200 OK`);
      } else {
        console.log(`❌ ${url}: Failed with ${res.reason.response?.status} - ${JSON.stringify(res.reason.response?.data)}`);
      }
    });

  } catch (err) {
    console.error("Test failed:", err.message);
  }
}

test();
