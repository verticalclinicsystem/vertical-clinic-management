import asyncio
import logging
import sys

logging.basicConfig(level=logging.INFO, stream=sys.stdout)

from app.utils.email import send_otp_email

async def main():
    try:
        print("Attempting to send OTP email...")
        await send_otp_email(to="kartikk.brainerhub@gmail.com", otp="123456", purpose="verify")
        print("Success!")
    except Exception as e:
        print("Failed with exception:")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
