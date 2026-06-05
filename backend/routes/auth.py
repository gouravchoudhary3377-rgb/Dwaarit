from __future__ import annotations

import logging
import random
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request

from audit import log_event, log_login, recent_failed_login_count
from config import EMERGENT_SESSION_URL, MSG91_AUTH_KEY, MSG91_ENABLED, MSG91_TEMPLATE_ID, OTP_DEV_MODE
from database import db
from models import GoogleSessionIn, LoginIn, MobileSendOTPIn, MobileVerifyOTPIn, SignupIn, TokenOut, UserPublic
from security import (
    get_current_user,
    hash_password,
    issue_jwt,
    verify_password,
)

logger = logging.getLogger(__name__)

# Brute-force protection thresholds
MAX_FAILED_LOGINS_PER_EMAIL = 5
LOCKOUT_WINDOW_MINUTES = 15

router = APIRouter(prefix="/auth", tags=["auth"])


def public_user(doc: dict) -> UserPublic:
    return UserPublic(
        user_id=doc["user_id"],
        email=doc["email"],
        name=doc.get("name", ""),
        role=doc.get("role", "customer"),
        auth_provider=doc.get("auth_provider", "password"),
        picture=doc.get("picture"),
        mobile=doc.get("mobile"),
        mobile_verified=bool(doc.get("mobile_verified", False)),
    )


@router.post("/signup", response_model=TokenOut)
async def signup(body: SignupIn, request: Request):
    if await db.users.find_one({"email": body.email.lower()}):
        await log_event(
            action="auth.signup",
            status="failure",
            details={"email": body.email.lower(), "reason": "email_exists"},
            request=request,
        )
        raise HTTPException(409, "Email already registered")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    doc = {
        "user_id": user_id,
        "email": body.email.lower(),
        "name": body.name,
        "password_hash": hash_password(body.password),
        "role": "customer",
        "auth_provider": "password",
        "picture": None,
        "mobile": None,
        "mobile_verified": False,
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(doc)
    await log_event(
        action="auth.signup",
        user_id=user_id,
        role="customer",
        target_type="user",
        target_id=user_id,
        details={"email": body.email.lower()},
        request=request,
    )
    await log_login(email=body.email, success=True, user_id=user_id, provider="password", request=request)
    return TokenOut(token=issue_jwt(user_id), user=public_user(doc))


@router.post("/login", response_model=TokenOut)
async def login(body: LoginIn, request: Request):
    email = body.email.lower()

    # Brute-force protection: count recent failures for this email
    fail_count = await recent_failed_login_count(email=email, minutes=LOCKOUT_WINDOW_MINUTES)
    if fail_count >= MAX_FAILED_LOGINS_PER_EMAIL:
        await log_event(
            action="auth.login.locked",
            status="failure",
            details={"email": email, "failures": fail_count},
            request=request,
        )
        raise HTTPException(
            429,
            f"Too many failed attempts. Try again in {LOCKOUT_WINDOW_MINUTES} minutes.",
        )

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not user.get("password_hash"):
        await log_login(email=email, success=False, provider="password", reason="not_found", request=request)
        await log_event(
            action="auth.login",
            status="failure",
            details={"email": email, "reason": "not_found"},
            request=request,
        )
        raise HTTPException(401, "Invalid credentials")
    if not verify_password(body.password, user["password_hash"]):
        await log_login(
            email=email,
            success=False,
            user_id=user.get("user_id"),
            provider="password",
            reason="bad_password",
            request=request,
        )
        await log_event(
            action="auth.login",
            status="failure",
            user_id=user.get("user_id"),
            role=user.get("role"),
            details={"email": email, "reason": "bad_password"},
            request=request,
        )
        raise HTTPException(401, "Invalid credentials")

    await log_login(email=email, success=True, user_id=user["user_id"], provider="password", request=request)
    await log_event(
        action="auth.login",
        user_id=user["user_id"],
        role=user.get("role"),
        request=request,
    )
    return TokenOut(token=issue_jwt(user["user_id"]), user=public_user(user))


@router.post("/session", response_model=TokenOut)
async def google_session(body: GoogleSessionIn, request: Request):
    async with httpx.AsyncClient(timeout=15.0) as h:
        r = await h.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": body.session_id})
    if r.status_code != 200:
        raise HTTPException(401, "Invalid Google session")
    data = r.json()
    email = (data.get("email") or "").lower()
    name = data.get("name") or email.split("@")[0]
    picture = data.get("picture")
    session_token = data.get("session_token")
    if not email or not session_token:
        raise HTTPException(400, "Malformed Google session data")

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if user:
        user_id = user["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture}},
        )
        user["name"] = name
        user["picture"] = picture
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "password_hash": None,
            "role": "customer",
            "auth_provider": "google",
            "picture": picture,
            "mobile": None,
            "mobile_verified": False,
            "created_at": datetime.now(timezone.utc),
        }
        await db.users.insert_one(user)

    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
    })
    await log_login(email=email, success=True, user_id=user_id, provider="google", request=request)
    await log_event(
        action="auth.login.google",
        user_id=user_id,
        role=user.get("role"),
        request=request,
    )
    return TokenOut(token=session_token, user=public_user(user))


@router.get("/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


# -------- MSG91 OTP sender --------
_INDIAN_MOBILE_RE = re.compile(r"^[6-9]\d{9}$")  # 10-digit Indian mobile

MSG91_OTP_URL = "https://control.msg91.com/api/v5/otp"


def _validate_indian_mobile(mobile: str) -> str:
    """Strip spaces/country code and validate 10-digit Indian number."""
    m = mobile.strip().replace(" ", "").replace("-", "")
    # Strip leading +91 or 91
    if m.startswith("+91"):
        m = m[3:]
    elif m.startswith("91") and len(m) == 12:
        m = m[2:]
    if not _INDIAN_MOBILE_RE.match(m):
        raise HTTPException(400, "Please enter a valid 10-digit Indian mobile number (6–9 series)")
    return m


async def _send_otp_msg91(mobile: str, otp: str) -> dict:
    """Call MSG91 OTP API. Raises HTTPException on fatal failures."""
    payload = {
        "template_id": MSG91_TEMPLATE_ID,
        "mobile": f"91{mobile}",
        "otp": otp,
    }
    headers = {
        "Authkey": MSG91_AUTH_KEY,
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(MSG91_OTP_URL, json=payload, headers=headers)

        data: dict = {}
        try:
            data = resp.json()
        except Exception:
            data = {"raw": resp.text}

        if resp.status_code == 200 and data.get("type") == "success":
            logger.info("MSG91 OTP sent to 91%s | request_id=%s", mobile, data.get("request_id", ""))
            return data

        # Non-success — log and surface a clean error
        logger.error(
            "MSG91 OTP send failed: status=%s body=%s mobile=91%s",
            resp.status_code, data, mobile,
        )
        detail = data.get("message") or data.get("raw") or "SMS gateway error"
        raise HTTPException(502, f"Could not send OTP: {detail}")

    except httpx.TimeoutException:
        logger.error("MSG91 request timed out for 91%s", mobile)
        raise HTTPException(504, "SMS gateway timed out — please try again")
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Unexpected error calling MSG91 for 91%s", mobile)
        raise HTTPException(502, "SMS gateway unavailable — please try again") from exc


# -------- Mobile OTP Login --------
OTP_TTL = 300  # 5 minutes


@router.post("/mobile/send-otp")
async def mobile_send_otp(body: MobileSendOTPIn, request: Request):
    """
    Send a login OTP to the given mobile number via MSG91.
    - Validates 10-digit Indian mobile (6–9 series).
    - Generates a 6-digit OTP and persists it with a 5-minute TTL.
    - In production (OTP_DEV_MODE=false): sends via MSG91, no dev_otp returned.
    - In dev mode (OTP_DEV_MODE=true): skips MSG91, returns dev_otp in response.
    """
    mobile = _validate_indian_mobile(body.mobile)

    otp = f"{random.randint(100000, 999999)}"
    now = datetime.now(timezone.utc)
    await db.otp_codes.update_one(
        {"mobile": mobile, "purpose": "mobile_login"},
        {"$set": {
            "otp": otp,
            "mobile": mobile,
            "purpose": "mobile_login",
            "expires_at": now + timedelta(seconds=OTP_TTL),
            "created_at": now,
            "attempts": 0,
        }},
        upsert=True,
    )

    if MSG91_ENABLED and not OTP_DEV_MODE:
        # Production path — send via MSG91
        await _send_otp_msg91(mobile, otp)
        logger.info("OTP dispatched via MSG91 to 91%s", mobile)
    else:
        # Dev/fallback path — log OTP locally
        logger.warning(
            "OTP_DEV_MODE active or MSG91 not configured — OTP for 91%s: %s",
            mobile, otp,
        )

    resp: dict = {"ok": True, "expires_in": OTP_TTL}
    if OTP_DEV_MODE:
        resp["dev_otp"] = otp  # Only in dev mode
    return resp


@router.post("/mobile/verify-otp", response_model=TokenOut)
async def mobile_verify_otp(body: MobileVerifyOTPIn, request: Request):
    """Verify OTP and return a JWT. Creates account automatically if user not found."""
    mobile = body.mobile.strip()
    rec = await db.otp_codes.find_one({"mobile": mobile, "purpose": "mobile_login"})
    if not rec:
        raise HTTPException(400, "No OTP was requested for this number")
    if rec.get("attempts", 0) >= 5:
        raise HTTPException(429, "Too many failed attempts. Request a new OTP.")
    expires_at = rec.get("expires_at")
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if not expires_at or expires_at < datetime.now(timezone.utc):
        raise HTTPException(400, "OTP has expired. Please request a new one.")
    if rec["otp"] != body.otp.strip():
        await db.otp_codes.update_one({"_id": rec["_id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(400, "Invalid OTP")

    # OTP valid — delete it
    await db.otp_codes.delete_one({"_id": rec["_id"]})

    # Find or create user
    user = await db.users.find_one({"mobile": mobile, "mobile_verified": True}, {"_id": 0})
    if not user:
        # Also check by mobile (unverified) or auto-create
        user = await db.users.find_one({"mobile": mobile}, {"_id": 0})

    if not user:
        # Auto-register: create new customer account
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        synthetic_email = f"m_{mobile}@flynkit.app"
        user = {
            "user_id": user_id,
            "email": synthetic_email,
            "name": f"User {mobile[-4:]}",
            "password_hash": None,
            "role": "customer",
            "auth_provider": "mobile",
            "picture": None,
            "mobile": mobile,
            "mobile_verified": True,
            "created_at": datetime.now(timezone.utc),
        }
        await db.users.insert_one(user)
        await log_event(action="auth.signup.mobile", user_id=user_id, role="customer",
                        details={"mobile": mobile}, request=request)
    else:
        # Mark mobile as verified if not already
        if not user.get("mobile_verified"):
            await db.users.update_one(
                {"user_id": user["user_id"]},
                {"$set": {"mobile": mobile, "mobile_verified": True}},
            )
            user["mobile"] = mobile
            user["mobile_verified"] = True

    await log_login(email=user.get("email", mobile), success=True,
                    user_id=user["user_id"], provider="mobile_otp", request=request)
    await log_event(action="auth.login.mobile", user_id=user["user_id"],
                    role=user.get("role"), request=request)
    return TokenOut(token=issue_jwt(user["user_id"]), user=public_user(user))


@router.post("/logout")
async def logout(
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    user_id: Optional[str] = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
        if sess:
            user_id = sess.get("user_id")
        await db.user_sessions.delete_many({"session_token": token})
    await log_event(action="auth.logout", user_id=user_id, request=request)
    return {"ok": True}
