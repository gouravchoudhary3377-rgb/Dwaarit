"""Admin-editable branding / page config stored in MongoDB."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from database import db
from security import require_admin

router = APIRouter()

_DEFAULTS = {
    "welcome": {
        "poster_url": "https://customer-assets.emergentagent.com/job_bdde9f90-cad7-4873-bec0-5782f2227a6f/artifacts/ncaapl5x_new%20flynk.png",
        "bg_color": "#F5E2D0",
        "accent_color": "#E8735A",
        "btn1_text": "Get Started",
        "btn2_text": "Have an account? Log In",
        "btn3_text": "Browse as Guest",
    },
    "login": {
        "hero_url": "https://customer-assets.emergentagent.com/job_bdde9f90-cad7-4873-bec0-5782f2227a6f/artifacts/htqs25bj_E581B53F-0AA5-4BD5-B599-09652EE9A8D6.PNG",
        "accent_color": "#E8735A",
    },
}


async def _get() -> dict:
    doc = await db.branding.find_one({"_id": "config"}, {"_id": 0})
    if not doc:
        return _DEFAULTS
    # Merge with defaults so new keys always exist
    result = {}
    for section, defaults in _DEFAULTS.items():
        result[section] = {**defaults, **doc.get(section, {})}
    return result


@router.get("/branding")
async def get_branding():
    """Public — called by welcome + login screens on load."""
    return await _get()


@router.put("/admin/branding")
async def update_branding(body: dict, _: dict = Depends(require_admin)):
    """Admin — save branding config."""
    # Only allow known sections/keys
    update: dict = {}
    for section in ("welcome", "login"):
        if section in body and isinstance(body[section], dict):
            update[section] = {
                k: v for k, v in body[section].items()
                if k in _DEFAULTS[section]
            }
    await db.branding.update_one(
        {"_id": "config"},
        {"$set": update},
        upsert=True,
    )
    return await _get()
