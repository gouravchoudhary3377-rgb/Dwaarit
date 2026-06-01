from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException

from config import EMERGENT_SESSION_URL
from database import db
from models import GoogleSessionIn, LoginIn, SignupIn, TokenOut, UserPublic
from security import (
    get_current_user,
    hash_password,
    issue_jwt,
    verify_password,
)

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
async def signup(body: SignupIn):
    if await db.users.find_one({"email": body.email.lower()}):
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
    return TokenOut(token=issue_jwt(user_id), user=public_user(doc))


@router.post("/login", response_model=TokenOut)
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower()}, {"_id": 0})
    if not user or not user.get("password_hash"):
        raise HTTPException(401, "Invalid credentials")
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    return TokenOut(token=issue_jwt(user["user_id"]), user=public_user(user))


@router.post("/session", response_model=TokenOut)
async def google_session(body: GoogleSessionIn):
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
    return TokenOut(token=session_token, user=public_user(user))


@router.get("/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@router.post("/logout")
async def logout(authorization: Optional[str] = Header(default=None)):
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_many({"session_token": token})
    return {"ok": True}
