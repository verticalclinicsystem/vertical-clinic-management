"""
Cloudinary Cloud Media Service — Handles uploads for user avatars, medical reports (PDF/X-Rays),
and clinical attachments with automatic compression and CDN URL generation.
"""
import os
import logging
from typing import Optional
from fastapi import UploadFile, HTTPException

import cloudinary
import cloudinary.uploader

logger = logging.getLogger(__name__)

from app.config import settings

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
    secure=True
)

class CloudinaryService:
    @staticmethod
    async def upload_file(
        file: UploadFile,
        folder: str = "vclinic/general",
        is_image: bool = True
    ) -> dict:
        """
        Uploads any file (Image/PDF/Doc) to Cloudinary CDN.
        Returns a dict containing secure_url, public_id, and format details.
        """
        try:
            contents = await file.read()
            resource_type = "image" if is_image else "auto"

            # Perform upload to Cloudinary
            response = cloudinary.uploader.upload(
                contents,
                folder=folder,
                resource_type=resource_type,
                overwrite=True
            )
            
            logger.info(f"Successfully uploaded file to Cloudinary: {response.get('secure_url')}")
            return {
                "url": response.get("secure_url"),
                "public_id": response.get("public_id"),
                "format": response.get("format"),
                "bytes": response.get("bytes")
            }
        except Exception as e:
            logger.error(f"Cloudinary upload error: {e}")
            raise HTTPException(status_code=500, detail=f"Cloudinary upload failed: {str(e)}")

    @staticmethod
    async def upload_avatar(file: UploadFile, user_id: str) -> str:
        """
        Uploads and auto-crops profile avatar picture to vclinic/avatars.
        """
        try:
            contents = await file.read()
            response = cloudinary.uploader.upload(
                contents,
                folder="vclinic/avatars",
                public_id=f"avatar_{user_id}",
                overwrite=True,
                transformation=[
                    {"width": 300, "height": 300, "crop": "fill", "gravity": "face"},
                    {"quality": "auto", "fetch_format": "auto"}
                ]
            )
            return response.get("secure_url", "")
        except Exception as e:
            logger.error(f"Cloudinary avatar upload error: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to upload profile picture: {str(e)}")

    @staticmethod
    async def upload_medical_report(file: UploadFile, patient_id: str) -> str:
        """
        Uploads medical report (PDF / X-Ray / Scan) to vclinic/medical_reports.
        """
        try:
            contents = await file.read()
            # Determine if PDF or Image
            ext = os.path.splitext(file.filename or "")[1].lower()
            resource_type = "raw" if ext == ".pdf" else "auto"

            response = cloudinary.uploader.upload(
                contents,
                folder=f"vclinic/reports/{patient_id}",
                resource_type=resource_type,
                overwrite=True
            )
            return response.get("secure_url", "")
        except Exception as e:
            logger.error(f"Cloudinary medical report upload error: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to upload medical report: {str(e)}")

    @staticmethod
    async def delete_avatar(user_id: str) -> bool:
        """
        Deletes the user avatar image from Cloudinary cloud storage.
        """
        try:
            public_id = f"vclinic/avatars/avatar_{user_id}"
            res = cloudinary.uploader.destroy(public_id, invalidate=True)
            logger.info(f"Cloudinary destroy avatar result for user {user_id}: {res}")
            return res.get("result") in ["ok", "not found"]
        except Exception as e:
            logger.error(f"Cloudinary avatar deletion error: {e}")
            return False

    @staticmethod
    async def delete_medical_report(file_url: str) -> bool:
        """
        Deletes a medical report from Cloudinary using its file URL.
        """
        if not file_url:
            return False
        try:
            parts = file_url.split('/')
            if 'upload' in parts:
                idx = parts.index('upload')
                resource_type = parts[idx - 1] if idx > 0 else 'image'
                remaining = parts[idx + 1:]
                if remaining and remaining[0].startswith('v') and remaining[0][1:].isdigit():
                    remaining = remaining[1:]
                public_id_with_ext = '/'.join(remaining)
                public_id = os.path.splitext(public_id_with_ext)[0]
                
                res = cloudinary.uploader.destroy(public_id, resource_type=resource_type, invalidate=True)
                logger.info(f"Cloudinary destroy medical report result for {public_id}: {res}")
                return res.get("result") in ["ok", "not found"]
        except Exception as e:
            logger.error(f"Cloudinary medical report deletion error: {e}")
        return False
