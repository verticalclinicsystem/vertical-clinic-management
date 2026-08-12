import asyncio
import httpx
from fastapi import UploadFile
from io import BytesIO
from app.services.cloudinary_service import CloudinaryService

async def test_upload():
    # Make a dummy PDF
    pdf_content = b"%PDF-1.5 test pdf content"
    dummy_file = UploadFile(
        filename="test_upload.pdf",
        file=BytesIO(pdf_content),
        headers={"content-type": "application/pdf"}
    )
    
    print("Uploading to Cloudinary...")
    try:
        url = await CloudinaryService.upload_medical_report(dummy_file, "test_patient_id")
        print(f"Uploaded URL: {url}")
        
        # Now let's try to fetch it
        async with httpx.AsyncClient() as client:
            res = await client.get(url)
            print(f"Fetch status: {res.status_code}")
            print(f"Fetch headers: {dict(res.headers)}")
            if res.status_code != 200:
                print(f"Fetch response body: {res.text[:1000]}")
    except Exception as e:
        print(f"Upload/Fetch error: {e}")

if __name__ == "__main__":
    asyncio.run(test_upload())
