from __future__ import annotations

import random
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from config import OTP_DEV_MODE, OTP_TTL_SECONDS
from database import db
from models import (
    ChangePasswordIn,
    MobileSendOTPIn,
    MobileVerifyOTPIn,
    ProfileUpdateIn,
    UserPublic,
)
from routes.auth import public_user
from security import get_current_user, hash_password, verify_password

router = APIRouter(prefix="/profile", tags=["profile"])


@router.put("/me", response_model=UserPublic)
async def update_profile(body: ProfileUpdateIn, user: dict = Depends(get_current_user)):
    upd = {k: v for k, v in body.dict(exclude_unset=True).items() if v is not None}
    if not upd:
        raise HTTPException(400, "No fields to update")
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": upd})
    doc = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return public_user(doc)


@router.post("/mobile/send-otp")
async def send_mobile_otp(body: MobileSendOTPIn, user: dict = Depends(get_current_user)):
    otp = f"{random.randint(100000, 999999)}"
    await db.otp_codes.update_one(
        {"user_id": user["user_id"], "mobile": body.mobile},
        {
            "$set": {
                "otp": otp,
                "user_id": user["user_id"],
                "mobile": body.mobile,
                "expires_at": datetime.now(timezone.utc) + timedelta(seconds=OTP_TTL_SECONDS),
                "created_at": datetime.now(timezone.utc),
                "attempts": 0,
            }
        },
        upsert=True,
    )
    # In production we'd call SMS provider here
    resp = {"ok": True, "expires_in": OTP_TTL_SECONDS}
    if OTP_DEV_MODE:
        resp["dev_otp"] = otp
    return resp


@router.post("/mobile/verify-otp", response_model=UserPublic)
async def verify_mobile_otp(body: MobileVerifyOTPIn, user: dict = Depends(get_current_user)):
    rec = await db.otp_codes.find_one({"user_id": user["user_id"], "mobile": body.mobile})
    if not rec:
        raise HTTPException(400, "No OTP requested for this number")
    if rec.get("attempts", 0) >= 5:
        raise HTTPException(429, "Too many attempts. Request a new OTP.")
    expires_at = rec.get("expires_at")
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if not expires_at or expires_at < datetime.now(timezone.utc):
        raise HTTPException(400, "OTP expired. Please request a new one.")
    if rec["otp"] != body.otp.strip():
        await db.otp_codes.update_one({"_id": rec["_id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(400, "Invalid OTP")

    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"mobile": body.mobile, "mobile_verified": True}},
    )
    await db.otp_codes.delete_one({"_id": rec["_id"]})
    doc = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return public_user(doc)


_ = uuid  # silence unused if needed


@router.post("/change-password")
async def change_password(body: ChangePasswordIn, user: dict = Depends(get_current_user)):
    """Allow any authenticated user to change their password."""
    doc = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 1, "auth_provider": 1})
    if not doc:
        raise HTTPException(404, "User not found")
    if doc.get("auth_provider") == "google":
        raise HTTPException(400, "Google sign-in accounts cannot change password here")
    if not verify_password(body.current_password, doc.get("password_hash", "")):
        raise HTTPException(400, "Current password is incorrect")
    new_hash = hash_password(body.new_password)
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"password_hash": new_hash}})
    return {"ok": True, "message": "Password updated successfully"}
