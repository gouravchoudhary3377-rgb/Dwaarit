"""Admin-managed home screen banner carousel.

Public endpoint:
  GET /banners              -> active banners ordered for storefront

Admin endpoints (require admin/super_admin):
  GET    /admin/banners
  POST   /admin/banners
  PATCH  /admin/banners/{banner_id}
  DELETE /admin/banners/{banner_id}
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from database import db
from models import BannerIn, BannerUpdate
from security import require_admin

router = APIRouter(tags=["banners"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _strip(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


# ----- Public storefront -----
@router.get("/banners")
async def list_active_banners():
    cur = db.banners.find({"active": True}, {"_id": 0}).sort([("order", 1), ("created_at", -1)])
    return await cur.to_list(50)


# ----- Admin -----
@router.get("/admin/banners")
async def admin_list_banners(_: dict = Depends(require_admin)):
    cur = db.banners.find({}, {"_id": 0}).sort([("order", 1), ("created_at", -1)])
    return await cur.to_list(200)


@router.post("/admin/banners")
async def admin_create_banner(body: BannerIn, _: dict = Depends(require_admin)):
    doc = body.dict()
    doc["banner_id"] = f"bnr_{uuid.uuid4().hex[:12]}"
    doc["created_at"] = _now()
    doc["updated_at"] = _now()
    await db.banners.insert_one(doc)
    return _strip(doc)


@router.patch("/admin/banners/{banner_id}")
async def admin_update_banner(
    banner_id: str, body: BannerUpdate, _: dict = Depends(require_admin)
):
    upd = {k: v for k, v in body.dict(exclude_unset=True).items() if v is not None}
    if not upd:
        raise HTTPException(400, "No fields to update")
    upd["updated_at"] = _now()
    res = await db.banners.update_one({"banner_id": banner_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Banner not found")
    doc = await db.banners.find_one({"banner_id": banner_id}, {"_id": 0})
    return doc


@router.delete("/admin/banners/{banner_id}")
async def admin_delete_banner(banner_id: str, _: dict = Depends(require_admin)):
    res = await db.banners.delete_one({"banner_id": banner_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Banner not found")
    return {"ok": True}
