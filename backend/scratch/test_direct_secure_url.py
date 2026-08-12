import asyncio
import httpx

async def test_direct_secure_url():
    url = "https://res.cloudinary.com/wgsdvsm6/raw/private/s--mRWKCfdJ--/v1786539600/vclinic/reports/test_patient_id/eke0nk6wglzmuv2xqpq1"
    print(f"Fetching signed secure_url directly: {url}")
    
    async with httpx.AsyncClient() as client:
        res = await client.get(url)
        print(f"Status Code: {res.status_code}")
        print(f"Headers: {dict(res.headers)}")
        if res.status_code == 200:
            print("SUCCESS! Bytes:", len(res.content))
        else:
            print(f"Response: {res.text[:500]}")

if __name__ == "__main__":
    asyncio.run(test_direct_secure_url())
