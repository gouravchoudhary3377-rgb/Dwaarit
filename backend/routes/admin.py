"""Admin panel endpoints: analytics dashboard, user/role management, wallet adjustments."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from database import db
from security import require_admin

router = APIRouter(prefix="/admin", tags=["admin"])


# -------- Schemas --------
class RoleUpdateIn(BaseModel):
    role: Literal["customer", "admin", "super_admin", "store_manager", "rider"]


class WalletAdjustIn(BaseModel):
    user_id: str
    type: Literal["credit", "debit", "refund"] = "credit"
    amount: float = Field(gt=0)
    note: str = ""


# -------- Dashboard analytics --------
@router.get("/dashboard")
async def admin_dashboard(_: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc)
    today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    last7 = now - timedelta(days=7)

    # Order analytics
    pipeline_today = [
        {"$match": {"created_at": {"$gte": today_start}, "status": {"$ne": "cancelled"}}},
        {"$group": {"_id": None, "count": {"$sum": 1}, "revenue": {"$sum": "$total"}}},
    ]
    pipeline_7d = [
        {"$match": {"created_at": {"$gte": last7}, "status": {"$ne": "cancelled"}}},
        {"$group": {"_id": None, "count": {"$sum": 1}, "revenue": {"$sum": "$total"}}},
    ]
    pipeline_lifetime = [
        {"$match": {"status": {"$ne": "cancelled"}}},
        {"$group": {"_id": None, "count": {"$sum": 1}, "revenue": {"$sum": "$total"}}},
    ]

    async def first(pipeline):
        async for d in db.orders.aggregate(pipeline):
            return d
        return {"count": 0, "revenue": 0.0}

    today_agg = await first(pipeline_today)
    week_agg = await first(pipeline_7d)
    life_agg = await first(pipeline_lifetime)

    # Status breakdown
    status_counts = {}
    async for d in db.orders.aggregate([{"$group": {"_id": "$status", "n": {"$sum": 1}}}]):
        status_counts[d["_id"]] = d["n"]

    # Daily revenue series (last 7 days)
    series_pipeline = [
        {"$match": {"created_at": {"$gte": last7}, "status": {"$ne": "cancelled"}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "revenue": {"$sum": "$total"},
            "orders": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]
    series = [d async for d in db.orders.aggregate(series_pipeline)]

    # Top selling products (last 30 days)
    last30 = now - timedelta(days=30)
    top_products_pipeline = [
        {"$match": {"created_at": {"$gte": last30}, "status": {"$ne": "cancelled"}}},
        {"$unwind": "$items"},
        {"$group": {
            "_id": "$items.product_id",
            "name": {"$first": "$items.name"},
            "qty": {"$sum": "$items.quantity"},
            "revenue": {"$sum": "$items.subtotal"},
        }},
        {"$sort": {"qty": -1}},
        {"$limit": 5},
    ]
    top_products = [d async for d in db.orders.aggregate(top_products_pipeline)]

    # User and ticket counts
    users_total = await db.users.count_documents({})
    users_new_7d = await db.users.count_documents({"created_at": {"$gte": last7}})
    tickets_open = await db.support_tickets.count_documents({"status": "open"})
    tickets_total = await db.support_tickets.count_documents({})
    products_total = await db.products.count_documents({})
    products_low_stock = await db.products.count_documents({"stock": {"$lte": 5}})

    return {
        "today": {"orders": today_agg.get("count", 0), "revenue": round(today_agg.get("revenue", 0.0), 2)},
        "week": {"orders": week_agg.get("count", 0), "revenue": round(week_agg.get("revenue", 0.0), 2)},
        "lifetime": {"orders": life_agg.get("count", 0), "revenue": round(life_agg.get("revenue", 0.0), 2)},
        "status_counts": status_counts,
        "series_7d": [
            {"date": s["_id"], "revenue": round(float(s.get("revenue", 0)), 2), "orders": s.get("orders", 0)}
            for s in series
        ],
        "top_products": [
            {"product_id": p["_id"], "name": p.get("name") or "—", "qty": p.get("qty", 0),
             "revenue": round(float(p.get("revenue", 0)), 2)}
            for p in top_products
        ],
        "users": {"total": users_total, "new_7d": users_new_7d},
        "tickets": {"open": tickets_open, "total": tickets_total},
        "products": {"total": products_total, "low_stock": products_low_stock},
    }


# -------- Users --------
@router.get("/users")
async def admin_list_users(
    q: Optional[str] = Query(default=None),
    role: Optional[str] = Query(default=None),
    _: dict = Depends(require_admin),
):
    filt: dict = {}
    if role in ("customer", "admin"):
        filt["role"] = role
    if q:
        filt["$or"] = [
            {"email": {"$regex": q, "$options": "i"}},
            {"name": {"$regex": q, "$options": "i"}},
            {"mobile": {"$regex": q, "$options": "i"}},
        ]
    docs = await db.users.find(filt, {"_id": 0, "password_hash": 0}).sort(
        "created_at", -1
    ).to_list(300)
    # Attach order count & spend for each
    user_ids = [d["user_id"] for d in docs]
    spend_map: dict = {}
    if user_ids:
        async for s in db.orders.aggregate([
            {"$match": {"user_id": {"$in": user_ids}, "status": {"$ne": "cancelled"}}},
            {"$group": {"_id": "$user_id", "orders": {"$sum": 1}, "spent": {"$sum": "$total"}}},
        ]):
            spend_map[s["_id"]] = {"orders": s.get("orders", 0), "spent": round(s.get("spent", 0.0), 2)}
    for d in docs:
        stat = spend_map.get(d["user_id"], {"orders": 0, "spent": 0.0})
        d["orders_count"] = stat["orders"]
        d["total_spent"] = stat["spent"]
        d.pop("created_at", None) and None
    return docs


@router.patch("/users/{user_id}/role")
async def admin_update_role(
    user_id: str, body: RoleUpdateIn, current: dict = Depends(require_admin)
):
    if user_id == current["user_id"] and body.role != "admin":
        raise HTTPException(400, "You cannot demote yourself")
    res = await db.users.update_one({"user_id": user_id}, {"$set": {"role": body.role}})
    if res.matched_count == 0:
        raise HTTPException(404, "User not found")
    return {"ok": True, "user_id": user_id, "role": body.role}


# -------- Wallet adjustments --------
@router.get("/wallet/transactions")
async def admin_wallet_txns(
    user_id: Optional[str] = Query(default=None),
    _: dict = Depends(require_admin),
):
    filt = {"user_id": user_id} if user_id else {}
    docs = await db.wallet_txns.find(filt, {"_id": 0}).sort("created_at", -1).to_list(200)
    # Enrich with user email
    uids = list({d["user_id"] for d in docs})
    email_map = {}
    if uids:
        async for u in db.users.find({"user_id": {"$in": uids}}, {"_id": 0, "user_id": 1, "email": 1, "name": 1}):
            email_map[u["user_id"]] = {"email": u.get("email", ""), "name": u.get("name", "")}
    for d in docs:
        info = email_map.get(d["user_id"], {})
        d["user_email"] = info.get("email", "")
        d["user_name"] = info.get("name", "")
    return docs


@router.post("/wallet/adjust")
async def admin_wallet_adjust(body: WalletAdjustIn, admin: dict = Depends(require_admin)):
    user = await db.users.find_one({"user_id": body.user_id})
    if not user:
        raise HTTPException(404, "User not found")
    await db.wallet_txns.insert_one({
        "txn_id": f"wtxn_{uuid.uuid4().hex[:12]}",
        "user_id": body.user_id,
        "type": body.type,
        "amount": round(float(body.amount), 2),
        "note": body.note or f"Admin {body.type} by {admin['email']}",
        "admin_id": admin["user_id"],
        "created_at": datetime.now(timezone.utc),
    })
    # Recompute
    from routes.wallet import compute_balance
    bal = await compute_balance(body.user_id)
    return {"ok": True, "balance": bal}


# -------- Admin: ticket detail / reply --------
class TicketReplyIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class TicketStatusIn(BaseModel):
    status: Literal["open", "pending", "resolved", "closed"]


@router.get("/tickets/{ticket_id}")
async def admin_get_ticket(ticket_id: str, _: dict = Depends(require_admin)):
    ticket = await db.support_tickets.find_one({"ticket_id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    messages = await db.support_messages.find(
        {"ticket_id": ticket_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    return {"ticket": ticket, "messages": messages}


@router.post("/tickets/{ticket_id}/reply")
async def admin_reply_ticket(
    ticket_id: str, body: TicketReplyIn, admin: dict = Depends(require_admin)
):
    ticket = await db.support_tickets.find_one({"ticket_id": ticket_id})
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    now = datetime.now(timezone.utc)
    await db.support_messages.insert_one({
        "ticket_id": ticket_id,
        "role": "agent",
        "agent_email": admin["email"],
        "content": body.message,
        "created_at": now,
    })
    await db.support_tickets.update_one(
        {"ticket_id": ticket_id},
        {"$set": {"updated_at": now, "status": "pending"}},
    )
    return {"ok": True}


@router.patch("/tickets/{ticket_id}/status")
async def admin_update_ticket_status(
    ticket_id: str, body: TicketStatusIn, _: dict = Depends(require_admin)
):
    res = await db.support_tickets.update_one(
        {"ticket_id": ticket_id},
        {"$set": {"status": body.status, "updated_at": datetime.now(timezone.utc)}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Ticket not found")
    return {"ok": True, "status": body.status}
