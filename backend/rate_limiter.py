"""
Sliding-window rate limiter backed by MongoDB.
Collections:
  - rate_limits: one doc per request event, with a TTL index on `expires_at`.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request

from database import db

logger = logging.getLogger(__name__)

# ---- Constants ----
PHONE_OTP_LIMIT = 5       # max OTP requests per phone number per hour
IP_OTP_LIMIT    = 20      # max OTP requests per IP per hour
WINDOW_SECONDS  = 3600    # 1 hour sliding window


# ---- TTL index bootstrap (call once at startup) ----
async def ensure_rate_limit_index() -> None:
    """Create TTL index on rate_limits.expires_at if it doesn't exist yet."""
    await db.rate_limits.create_index(
        "expires_at",
        expireAfterSeconds=0,  # MongoDB deletes when expires_at < now
        name="rate_limit_ttl",
        background=True,
    )


# ---- Helpers ----
def get_client_ip(request: Request) -> str:
    """Extract the real client IP, respecting X-Forwarded-For proxy headers."""
    xff = request.headers.get("X-Forwarded-For", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def _count_recent(key: str) -> int:
    """Count requests for `key` in the current sliding window."""
    window_start = datetime.now(timezone.utc) - timedelta(seconds=WINDOW_SECONDS)
    return await db.rate_limits.count_documents(
        {"key": key, "created_at": {"$gte": window_start}}
    )


async def _record(key: str, tag: str, extra: dict | None = None) -> None:
    """Insert one rate-limit event document."""
    now = datetime.now(timezone.utc)
    doc = {
        "key": key,
        "tag": tag,
        "created_at": now,
        "expires_at": now + timedelta(seconds=WINDOW_SECONDS),
    }
    if extra:
        doc.update(extra)
    await db.rate_limits.insert_one(doc)


# ---- Public API ----
async def check_phone_rate_limit(phone: str, request: Request) -> None:
    """
    Enforce:
      - 5 OTP requests per phone per hour
      - 20 OTP requests per IP per hour

    Logs abuse and raises HTTP 429 with a user-friendly message on violation.
    """
    ip = get_client_ip(request)
    phone_key = f"otp:phone:{phone}"
    ip_key    = f"otp:ip:{ip}"

    phone_count = await _count_recent(phone_key)
    ip_count    = await _count_recent(ip_key)

    # ---- Phone limit ----
    if phone_count >= PHONE_OTP_LIMIT:
        logger.warning(
            "[RATE_LIMIT] Phone limit reached | phone=%s | count=%d/%d | ip=%s",
            phone, phone_count, PHONE_OTP_LIMIT, ip,
        )
        raise HTTPException(
            status_code=429,
            detail=(
                f"You have requested too many OTPs for this number. "
                f"Please wait 1 hour before trying again."
            ),
        )

    # ---- IP limit ----
    if ip_count >= IP_OTP_LIMIT:
        logger.warning(
            "[RATE_LIMIT] IP limit reached | ip=%s | count=%d/%d | phone=%s",
            ip, ip_count, IP_OTP_LIMIT, phone,
        )
        raise HTTPException(
            status_code=429,
            detail=(
                "Too many OTP requests from your network. "
                "Please wait 1 hour before trying again."
            ),
        )

    # ---- Record this request ----
    await _record(phone_key, "otp_phone", {"phone": phone, "ip": ip})
    await _record(ip_key, "otp_ip",    {"phone": phone, "ip": ip})

    logger.info(
        "[RATE_LIMIT] OTP allowed | phone=%s | phone_count=%d/%d | ip=%s | ip_count=%d/%d",
        phone, phone_count + 1, PHONE_OTP_LIMIT,
        ip,    ip_count    + 1, IP_OTP_LIMIT,
    )


async def check_firebase_verify_rate_limit(phone: str, request: Request) -> None:
    """
    Same limits but for the /firebase/verify endpoint.
    Fires AFTER Firebase token is verified (phone is known).
    Uses separate key-space so attempts don't share quota with send-otp.
    """
    ip = get_client_ip(request)
    phone_key = f"fb_verify:phone:{phone}"
    ip_key    = f"fb_verify:ip:{ip}"

    phone_count = await _count_recent(phone_key)
    ip_count    = await _count_recent(ip_key)

    if phone_count >= PHONE_OTP_LIMIT:
        logger.warning(
            "[RATE_LIMIT] Firebase verify phone limit | phone=%s count=%d/%d ip=%s",
            phone, phone_count, PHONE_OTP_LIMIT, ip,
        )
        raise HTTPException(
            429,
            "Too many login attempts for this number. Please wait 1 hour.",
        )

    if ip_count >= IP_OTP_LIMIT:
        logger.warning(
            "[RATE_LIMIT] Firebase verify IP limit | ip=%s count=%d/%d phone=%s",
            ip, ip_count, IP_OTP_LIMIT, phone,
        )
        raise HTTPException(
            429,
            "Too many login attempts from your network. Please wait 1 hour.",
        )

    await _record(phone_key, "fb_verify_phone", {"phone": phone, "ip": ip})
    await _record(ip_key,    "fb_verify_ip",    {"phone": phone, "ip": ip})

    logger.info(
        "[RATE_LIMIT] Firebase verify allowed | phone=%s %d/%d | ip=%s %d/%d",
        phone, phone_count + 1, PHONE_OTP_LIMIT,
        ip,    ip_count    + 1, IP_OTP_LIMIT,
    )
