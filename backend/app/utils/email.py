"""
Email utility — async SMTP via aiosmtplib.

Usage:
    from app.utils.email import send_otp_email
    await send_otp_email(to="user@example.com", otp="123456", purpose="verify")
"""
from __future__ import annotations

import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

from app.config import settings

logger = logging.getLogger(__name__)

# ── OTP expiry is read from settings (set OTP_EXPIRE_MINUTES in .env) ──────────


# ── HTML templates ────────────────────────────────────────────────────────────

def _build_otp_html(otp: str, purpose: str, app_name: str) -> str:
    """Return a styled HTML email body for OTP delivery."""

    if purpose == "verify":
        heading = "Verify Your Email"
        subtext = (
            "Thank you for registering with <strong>{app_name}</strong>. "
            "Use the OTP below to activate your account."
        ).format(app_name=app_name)
        action_note = "This code is valid for account verification only."
    else:  # reset
        heading = "Password Reset Request"
        subtext = (
            "We received a request to reset your password on "
            "<strong>{app_name}</strong>. Use the OTP below to proceed."
        ).format(app_name=app_name)
        action_note = "If you did not request this, please ignore this email."

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>{heading}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:12px;
                      box-shadow:0 2px 12px rgba(0,0,0,0.08);overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0f7bab,#0a5c80);
                        padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;
                          letter-spacing:0.5px;">
                {app_name}
              </h1>
              <p style="margin:6px 0 0;color:#c8e8f5;font-size:13px;">
                Clinic Management System
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <h2 style="margin:0 0 12px;color:#1a2e3b;font-size:20px;">{heading}</h2>
              <p style="margin:0 0 28px;color:#4a5568;font-size:15px;line-height:1.6;">
                {subtext}
              </p>

              <!-- OTP Box -->
              <div style="background:#f0f7ff;border:2px dashed #0f7bab;
                          border-radius:10px;padding:24px;text-align:center;
                          margin-bottom:28px;">
                <p style="margin:0 0 8px;color:#4a5568;font-size:13px;
                            text-transform:uppercase;letter-spacing:1px;">
                  Your One-Time Password
                </p>
                <span style="font-size:42px;font-weight:800;color:#0f7bab;
                              letter-spacing:10px;font-family:'Courier New',monospace;">
                  {otp}
                </span>
                <p style="margin:12px 0 0;color:#718096;font-size:13px;">
                  ⏱ Expires in <strong>{settings.OTP_EXPIRE_MINUTES} minutes</strong>
                </p>
              </div>

              <!-- Security note -->
              <p style="margin:0 0 8px;color:#718096;font-size:13px;line-height:1.5;">
                🔒 <strong>Security tip:</strong> Never share this OTP with anyone.
                Our team will never ask for it.
              </p>
              <p style="margin:0;color:#718096;font-size:13px;">
                {action_note}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;
                        border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;color:#a0aec0;font-size:12px;">
                © 2025 {app_name}. All rights reserved.
              </p>
              <p style="margin:4px 0 0;color:#a0aec0;font-size:12px;">
                This is an automated message — please do not reply.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _build_otp_plain(otp: str, purpose: str, app_name: str) -> str:
    """Plaintext fallback for email clients that don't render HTML."""
    if purpose == "verify":
        intro = f"Thank you for registering with {app_name}."
        note = "Use this code to verify your email address."
    else:
        intro = f"We received a password reset request for your {app_name} account."
        note = "Use this code to reset your password. If you did not request this, ignore this email."

    return (
        f"{app_name} — One-Time Password\n"
        f"{'=' * 40}\n\n"
        f"{intro}\n\n"
        f"Your OTP: {otp}\n\n"
        f"{note}\n"
        f"This code expires in {settings.OTP_EXPIRE_MINUTES} minutes.\n\n"
        f"Never share this code with anyone.\n"
        f"{'=' * 40}\n"
        f"This is an automated message. Do not reply."
    )


# ── Core sender ───────────────────────────────────────────────────────────────

async def send_email(
    *,
    to: str,
    subject: str,
    html_body: str,
    plain_body: str,
) -> None:
    """
    Low-level async SMTP sender.
    Connects to SMTP_HOST:SMTP_PORT with STARTTLS and logs in
    using SMTP_USER / SMTP_PASSWORD from settings.
    """
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.FROM_NAME} <{settings.FROM_EMAIL}>"
    msg["To"] = to

    # Plain text first (fallback), HTML second (preferred by mail clients)
    msg.attach(MIMEText(plain_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    import asyncio
    try:
        # Use a 10-second timeout to allow Gmail TLS handshake to complete
        await asyncio.wait_for(
            aiosmtplib.send(
                msg,
                hostname=settings.SMTP_HOST,
                port=settings.SMTP_PORT,
                username=settings.SMTP_USER,
                password=settings.SMTP_PASSWORD,
                start_tls=settings.SMTP_PORT == 587, # only try start_tls on port 587
            ),
            timeout=10.0
        )
        logger.info("Email sent to=%r subject=%r", to, subject)
    except Exception as exc:
        logger.warning("Failed to send email to=%r: %s", to, exc)
        if settings.is_production:
            raise



# ── Public helpers ────────────────────────────────────────────────────────────

async def send_otp_email(*, to: str, otp: str, purpose: str) -> None:
    """
    Send a branded OTP email.

    Args:
        to:      Recipient email address.
        otp:     The 6-digit OTP string.
        purpose: ``"verify"`` for account verification, ``"reset"`` for password reset.
    """
    app_name = settings.APP_NAME
    subject = (
        f"Your {app_name} Verification Code"
        if purpose == "verify"
        else f"Your {app_name} Password Reset Code"
    )
    html_body = _build_otp_html(otp, purpose, app_name)
    plain_body = _build_otp_plain(otp, purpose, app_name)

    await send_email(to=to, subject=subject, html_body=html_body, plain_body=plain_body)
