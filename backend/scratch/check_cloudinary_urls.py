import asyncio
import httpx
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.medical_report import MedicalReport

async def check_urls():
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(MedicalReport))
            reports = result.scalars().all()
            print(f"Found {len(reports)} reports in database:")
            async with httpx.AsyncClient() as client:
                for r in reports:
                    print(f"\nID: {r.id}")
                    print(f"Report Name: {r.report_name}")
                    print(f"File URL: {r.file_url}")
                    if r.file_url:
                        try:
                            res = await client.get(r.file_url)
                            print(f"Status Code: {res.status_code}")
                            print(f"Content-Type: {res.headers.get('content-type')}")
                            print(f"Content-Disposition: {res.headers.get('content-disposition')}")
                            print(f"Response: {res.text}")
                        except Exception as e:
                            print(f"Error fetching URL: {e}")
                    else:
                        print("No file URL.")
        except Exception as e:
            print(f"DB Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_urls())
