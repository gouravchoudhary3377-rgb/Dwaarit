"""Auth helpers: password hashing, JWT, FastAPI dependencies."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, Header, HTTPException, status

from config import JWT_ALGORITHM, JWT_EXPIRY_DAYS, JWT_SECRET
from database import db


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def issue_jwt(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def normalize_dt(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


async def get_current_user(authorization: Optional[str] = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()

    # JWT path
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id:
            user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
            if user:
                return user
    except jwt.PyJWTError:
        pass

    # Emergent Google session path
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if sess:
        exp = normalize_dt(sess.get("expires_at"))
        if exp and exp > datetime.now(timezone.utc):
            user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
            if user:
                return user

    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Legacy alias — allows both 'admin' (deprecated) and 'super_admin'."""
    role = user.get("role")
    if role not in ("admin", "super_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin only")
    return user


def _effective_role(user: dict) -> str:
    """Normalise legacy 'admin' to 'super_admin'."""
    role = user.get("role", "customer")
    return "super_admin" if role == "admin" else role


async def require_super_admin(user: dict = Depends(get_current_user)) -> dict:
    # Strict equality — do NOT honour the legacy 'admin' -> 'super_admin' alias here.
    # Regular admins must NOT see audit logs / login history / security KPIs.
    if user.get("role") != "super_admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Super Admin only")
    return user


async def require_staff(user: dict = Depends(get_current_user)) -> dict:
    """Any back-office role: super_admin or store_manager."""
    if _effective_role(user) not in ("super_admin", "store_manager"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Staff only")
    return user


async def require_store_manager(user: dict = Depends(get_current_user)) -> dict:
    """Store manager only — super_admin also allowed for oversight."""
    if _effective_role(user) not in ("super_admin", "store_manager"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Store Manager only")
    return user


async def require_rider(user: dict = Depends(get_current_user)) -> dict:
    if _effective_role(user) != "rider":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Rider only")
    return user
