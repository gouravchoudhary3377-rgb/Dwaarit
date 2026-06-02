"""Audit logging & login history helpers (Phase 8.6 Security Hardening).

Centralised, fire-and-forget writers so route handlers can record security
events without polluting their main logic.

Collections
-----------
- audit_logs:    every meaningful state-changing or security event
- login_history: dedicated per-user login attempt log (success + failure)
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import Request

from database import db


def _client_meta(request: Optional[Request]) -> dict:
    if request is None:
        return {"ip": None, "user_agent": None}
    ip = (
        (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
        or (request.client.host if request.client else None)
    )
    return {
        "ip": ip,
        "user_agent": request.headers.get("user-agent"),
    }


async def log_event(
    *,
    action: str,
    user_id: Optional[str] = None,
    role: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    status: str = "success",
    details: Optional[dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> None:
    """Insert a structured audit log entry. Never raises."""
    try:
        meta = _client_meta(request)
        await db.audit_logs.insert_one(
            {
                "audit_id": f"audit_{uuid.uuid4().hex[:12]}",
                "action": action,
                "user_id": user_id,
                "role": role,
                "target_type": target_type,
                "target_id": target_id,
                "status": status,
                "details": details or {},
                "ip": meta["ip"],
                "user_agent": meta["user_agent"],
                "created_at": datetime.now(timezone.utc),
            }
        )
    except Exception:
        # Audit logging must never break the main request flow
        pass


async def log_login(
    *,
    email: str,
    success: bool,
    user_id: Optional[str] = None,
    provider: str = "password",
    reason: Optional[str] = None,
    request: Optional[Request] = None,
) -> None:
    """Record a login attempt for compliance / brute-force review."""
    try:
        meta = _client_meta(request)
        await db.login_history.insert_one(
            {
                "login_id": f"login_{uuid.uuid4().hex[:12]}",
                "user_id": user_id,
                "email": email.lower() if email else None,
                "provider": provider,
                "success": bool(success),
                "reason": reason,
                "ip": meta["ip"],
                "user_agent": meta["user_agent"],
                "created_at": datetime.now(timezone.utc),
            }
        )
    except Exception:
        pass


async def recent_failed_login_count(
    *, email: Optional[str] = None, ip: Optional[str] = None, minutes: int = 15
) -> int:
    """Return number of failed logins for an email / IP in the last N minutes."""
    try:
        from datetime import timedelta

        since = datetime.now(timezone.utc) - timedelta(minutes=minutes)
        q: dict[str, Any] = {"success": False, "created_at": {"$gte": since}}
        if email:
            q["email"] = email.lower()
        if ip:
            q["ip"] = ip
        return await db.login_history.count_documents(q)
    except Exception:
        return 0
