"""
Unified Media Storage Service — dynamically routes file uploads and deletions
to Local, S3, or Cloudinary depending on STORAGE_BACKEND configuration.
"""
import os
import uuid
import shutil
import logging
from typing import Optional
from fastapi import UploadFile, HTTPException, Request
from app.config import settings

logger = logging.getLogger(__name__)


class StorageService:
    @staticmethod
    def _get_local_upload_dir() -> str:
        """Get the upload directory, falling back to static/uploads if configured path is not writable."""
        target_dir = settings.UPLOAD_DIR
        try:
            os.makedirs(target_dir, exist_ok=True)
            # Test writability
            test_file = os.path.join(target_dir, ".write_test")
            with open(test_file, "w") as f:
                f.write("test")
            os.remove(test_file)
            return target_dir
        except Exception:
            logger.warning(f"Configured UPLOAD_DIR ({target_dir}) is not writable. Falling back to static/uploads.")
            fallback_dir = "static/uploads"
            os.makedirs(fallback_dir, exist_ok=True)
            return fallback_dir

    @staticmethod
    async def upload_avatar(file: UploadFile, user_id: str, request: Optional[Request] = None) -> str:
        """
        Uploads and returns the URL of the avatar image.
        Supports: local, s3, cloudinary.
        """
        backend = settings.STORAGE_BACKEND
        if backend == "cloudinary":
            from app.services.cloudinary_service import CloudinaryService
            return await CloudinaryService.upload_avatar(file, user_id)
        
        elif backend == "s3":
            # Upload to S3
            ext = os.path.splitext(file.filename or "")[1].lower() or ".jpg"
            return await StorageService._upload_to_s3(file, f"avatars/avatar_{user_id}{ext}")
            
        else:  # local
            upload_dir = StorageService._get_local_upload_dir()
            ext = os.path.splitext(file.filename or "")[1].lower() or ".jpg"
            filename = f"avatar_{user_id}{ext}"
            filepath = os.path.join(upload_dir, filename)
            
            # Save file
            try:
                # Optional: use PIL to crop/resize avatar to 300x300
                from PIL import Image
                import io
                
                content = await file.read()
                image = Image.open(io.BytesIO(content))
                image.thumbnail((300, 300))
                image.save(filepath)
            except Exception as e:
                logger.error(f"Failed to process and save avatar locally: {e}")
                # Fallback to direct copy
                try:
                    await file.seek(0)
                    with open(filepath, "wb") as f:
                        shutil.copyfileobj(file.file, f)
                except Exception as e2:
                    logger.error(f"Local avatar fallback copy failed: {e2}")
                    raise HTTPException(status_code=500, detail="Failed to save avatar locally.")
            
            base_url = str(request.base_url) if request else "/"
            if not base_url.endswith("/"):
                base_url += "/"
            return f"{base_url}uploads/{filename}"

    @staticmethod
    async def delete_avatar(user_id: str) -> bool:
        """
        Deletes the user avatar image from storage.
        """
        backend = settings.STORAGE_BACKEND
        if backend == "cloudinary":
            from app.services.cloudinary_service import CloudinaryService
            return await CloudinaryService.delete_avatar(user_id)
        elif backend == "s3":
            # S3 avatars might have different extensions, so we just attempt deletion of standard paths
            for ext in [".jpg", ".jpeg", ".png", ".webp"]:
                await StorageService._delete_from_s3(f"avatars/avatar_{user_id}{ext}")
            return True
        else:  # local
            # Find and delete local avatar file
            filename_prefix = f"avatar_{user_id}"
            upload_dir = StorageService._get_local_upload_dir()
            try:
                for f in os.listdir(upload_dir):
                    if f.startswith(filename_prefix):
                        os.remove(os.path.join(upload_dir, f))
                return True
            except Exception as e:
                logger.error(f"Failed to delete local avatar: {e}")
                return False

    @staticmethod
    async def upload_medical_report(file: UploadFile, patient_id: str, request: Optional[Request] = None) -> str:
        """
        Uploads and returns the URL of the medical report (PDF / Image).
        Supports: local, s3, cloudinary.
        """
        backend = settings.STORAGE_BACKEND
        if backend == "cloudinary":
            from app.services.cloudinary_service import CloudinaryService
            return await CloudinaryService.upload_medical_report(file, patient_id)
        
        elif backend == "s3":
            ext = os.path.splitext(file.filename or "")[1].lower()
            if not ext and file.content_type == "application/pdf":
                ext = ".pdf"
            filename = f"report_{uuid.uuid4().hex}{ext}"
            return await StorageService._upload_to_s3(file, f"reports/{patient_id}/{filename}")
            
        else:  # local
            upload_dir = StorageService._get_local_upload_dir()
            ext = os.path.splitext(file.filename or "")[1].lower()
            if not ext and file.content_type == "application/pdf":
                ext = ".pdf"
            filename = f"report_{uuid.uuid4().hex}{ext}"
            filepath = os.path.join(upload_dir, filename)
            
            try:
                await file.seek(0)
                with open(filepath, "wb") as f:
                    shutil.copyfileobj(file.file, f)
            except Exception as e:
                logger.error(f"Failed to save local medical report: {e}")
                raise HTTPException(status_code=500, detail="Failed to save medical report locally.")
            
            base_url = str(request.base_url) if request else "/"
            if not base_url.endswith("/"):
                base_url += "/"
            return f"{base_url}uploads/{filename}"

    @staticmethod
    async def delete_medical_report(file_url: str) -> bool:
        """
        Deletes the medical report file from the configured storage backend.
        """
        if not file_url:
            return False
        
        backend = settings.STORAGE_BACKEND
        if backend == "cloudinary":
            from app.services.cloudinary_service import CloudinaryService
            return await CloudinaryService.delete_medical_report(file_url)
            
        elif backend == "s3":
            if ".amazonaws.com/" in file_url:
                try:
                    key = file_url.split(".amazonaws.com/")[1]
                    return await StorageService._delete_from_s3(key)
                except Exception as e:
                    logger.error(f"Failed to parse S3 key from URL {file_url}: {e}")
            return False
            
        else:  # local
            try:
                filename = file_url.split("/")[-1]
                upload_dir = StorageService._get_local_upload_dir()
                filepath = os.path.join(upload_dir, filename)
                if os.path.exists(filepath):
                    os.remove(filepath)
                return True
            except Exception as e:
                logger.error(f"Failed to delete local medical report: {e}")
                return False

    @staticmethod
    async def _upload_to_s3(file: UploadFile, key: str) -> str:
        """
        Helper method to upload file to S3.
        """
        import boto3
        
        if not settings.AWS_ACCESS_KEY_ID or not settings.AWS_SECRET_ACCESS_KEY:
            raise HTTPException(status_code=500, detail="AWS S3 credentials not configured.")
            
        s3 = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION
        )
        
        try:
            await file.seek(0)
            content_type = file.content_type or "application/octet-stream"
            s3.upload_fileobj(
                file.file,
                settings.AWS_S3_BUCKET,
                key,
                ExtraArgs={"ContentType": content_type}
            )
            return f"https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"
        except Exception as e:
            logger.error(f"S3 upload error: {e}")
            raise HTTPException(status_code=500, detail=f"S3 upload failed: {str(e)}")

    @staticmethod
    async def _delete_from_s3(key: str) -> bool:
        """
        Helper method to delete file from S3.
        """
        import boto3
        if not settings.AWS_ACCESS_KEY_ID or not settings.AWS_SECRET_ACCESS_KEY:
            return False
            
        s3 = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION
        )
        try:
            s3.delete_object(Bucket=settings.AWS_S3_BUCKET, Key=key)
            return True
        except Exception as e:
            logger.error(f"S3 deletion error: {e}")
            return False
