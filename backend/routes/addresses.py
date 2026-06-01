from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from database import db
from models import AddressIn, AddressOut
from security import get_current_user

router = APIRouter(prefix="/addresses", tags=["addresses"])


async def _set_default(user_id: str, address_id: str) -> None:
    await db.addresses.update_many(
        {"user_id": user_id}, {"$set": {"is_default": False}}
    )
    await db.addresses.update_one(
        {"user_id": user_id, "address_id": address_id}, {"$set": {"is_default": True}}
    )


@router.get("", response_model=List[AddressOut])
async def list_addresses(user: dict = Depends(get_current_user)):
    docs = await db.addresses.find({"user_id": user["user_id"]}, {"_id": 0}).sort(
        "created_at", -1
    ).to_list(50)
    return [AddressOut(**d) for d in docs]


@router.post("", response_model=AddressOut)
async def create_address(body: AddressIn, user: dict = Depends(get_current_user)):
    address_id = f"addr_{uuid.uuid4().hex[:12]}"
    has_any = await db.addresses.count_documents({"user_id": user["user_id"]})
    is_default = bool(body.is_default) or has_any == 0
    doc = {
        **body.dict(),
        "address_id": address_id,
        "user_id": user["user_id"],
        "is_default": is_default,
        "created_at": datetime.now(timezone.utc),
    }
    await db.addresses.insert_one(doc)
    if is_default:
        await _set_default(user["user_id"], address_id)
    out = await db.addresses.find_one({"address_id": address_id}, {"_id": 0})
    return AddressOut(**out)


@router.put("/{address_id}", response_model=AddressOut)
async def update_address(
    address_id: str, body: AddressIn, user: dict = Depends(get_current_user)
):
    existing = await db.addresses.find_one(
        {"address_id": address_id, "user_id": user["user_id"]}
    )
    if not existing:
        raise HTTPException(404, "Address not found")
    upd = body.dict()
    await db.addresses.update_one({"address_id": address_id}, {"$set": upd})
    if body.is_default:
        await _set_default(user["user_id"], address_id)
    out = await db.addresses.find_one({"address_id": address_id}, {"_id": 0})
    return AddressOut(**out)


@router.post("/{address_id}/default", response_model=AddressOut)
async def make_default(address_id: str, user: dict = Depends(get_current_user)):
    existing = await db.addresses.find_one(
        {"address_id": address_id, "user_id": user["user_id"]}
    )
    if not existing:
        raise HTTPException(404, "Address not found")
    await _set_default(user["user_id"], address_id)
    out = await db.addresses.find_one({"address_id": address_id}, {"_id": 0})
    return AddressOut(**out)


@router.delete("/{address_id}")
async def delete_address(address_id: str, user: dict = Depends(get_current_user)):
    res = await db.addresses.delete_one(
        {"address_id": address_id, "user_id": user["user_id"]}
    )
    if res.deleted_count == 0:
        raise HTTPException(404, "Address not found")
    return {"ok": True}
