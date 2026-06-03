"""Admin panel endpoints: analytics dashboard, user/role management, wallet adjustments."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from database import db
from security import require_admin, require_super_admin
from fastapi import Request
from audit import log_event

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

    # -------- Profit analytics (Delivered orders only) --------
    # margin_per_item = selling_price - self_price
    # order_profit  = margin_per_item * quantity
    # IMPORTANT: skip items missing selling_price or self_price (historical data).
    today_profit = 0.0
    week_profit = 0.0
    month_profit = 0.0
    lifetime_profit = 0.0
    last_month = now - timedelta(days=30)
    profit_by_product: dict[str, dict] = {}
    profit_by_category: dict[str, float] = {}

    # Pull product->category map once for fast lookup
    cat_map: dict[str, str] = {}
    async for p in db.products.find({}, {"_id": 0, "product_id": 1, "category": 1}):
        cat_map[p["product_id"]] = p.get("category", "Uncategorized")

    # NOTE: DB stores status lowercase ("delivered"). Spec says exactly "Delivered".
    # Match either casing so this works regardless of seed/data formatting.
    async for order in db.orders.find(
        {"status": {"$in": ["Delivered", "delivered"]}},
        {"_id": 0, "items": 1, "created_at": 1},
    ):
        order_total_profit = 0.0
        created = order.get("created_at")
        for it in order.get("items", []):
            sp = it.get("selling_price")
            cp = it.get("self_price")
            qty = it.get("quantity", 0) or 0
            if sp is None or cp is None or qty <= 0:
                continue  # skip historical items missing snapshot
            try:
                margin = float(sp) - float(cp)
            except (TypeError, ValueError):
                continue
            order_profit = margin * qty
            order_total_profit += order_profit

            pid = it.get("product_id") or "unknown"
            name = it.get("name") or "—"
            agg = profit_by_product.setdefault(pid, {"name": name, "qty": 0, "profit": 0.0})
            agg["qty"] += qty
            agg["profit"] += order_profit

            cat = cat_map.get(pid, "Uncategorized")
            profit_by_category[cat] = profit_by_category.get(cat, 0.0) + order_profit

        lifetime_profit += order_total_profit
        if created:
            # MongoDB may return naive datetimes; normalise to UTC-aware for comparison.
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            if created >= today_start:
                today_profit += order_total_profit
            if created >= last7:
                week_profit += order_total_profit
            if created >= last_month:
                month_profit += order_total_profit

    top_profitable = sorted(
        [
            {"product_id": pid, "name": v["name"], "qty": v["qty"], "profit": round(v["profit"], 2)}
            for pid, v in profit_by_product.items()
        ],
        key=lambda x: x["profit"],
        reverse=True,
    )[:5]

    profit_categories = sorted(
        [{"category": k, "profit": round(v, 2)} for k, v in profit_by_category.items()],
        key=lambda x: x["profit"],
        reverse=True,
    )

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
        "profit": {
            "today": round(today_profit, 2),
            "week": round(week_profit, 2),
            "month": round(month_profit, 2),
            "lifetime": round(lifetime_profit, 2),
        },
        "top_profitable": top_profitable,
        "profit_categories": profit_categories,
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
    user_id: str,
    body: RoleUpdateIn,
    request: Request,
    current: dict = Depends(require_super_admin),
):
    if user_id == current["user_id"] and body.role not in ("admin", "super_admin"):
        raise HTTPException(400, "You cannot demote yourself")
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(404, "User not found")
    previous_role = target.get("role")
    await db.users.update_one({"user_id": user_id}, {"$set": {"role": body.role}})
    await log_event(
        action="role.change",
        status="success",
        user_id=current["user_id"],
        role=current.get("role"),
        details={
            "target_user_id": user_id,
            "previous_role": previous_role,
            "new_role": body.role,
        },
        request=request,
    )
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


# -------- Phase 8.6: Security audit (super_admin only) --------
def _strip_mongo(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


@router.get("/audit-logs")
async def admin_audit_logs(
    _: dict = Depends(require_super_admin),
    action: Optional[str] = Query(default=None),
    user_id: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    skip: int = Query(default=0, ge=0),
):
    """Paginated audit-log feed. Filterable by action, user_id, and status."""
    q: dict = {}
    if action:
        q["action"] = action
    if user_id:
        q["user_id"] = user_id
    if status:
        q["status"] = status

    total = await db.audit_logs.count_documents(q)
    cursor = (
        db.audit_logs.find(q, {"_id": 0})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    items = [_strip_mongo(d) async for d in cursor]
    return {"total": total, "items": items, "limit": limit, "skip": skip}


@router.get("/login-history")
async def admin_login_history(
    _: dict = Depends(require_super_admin),
    email: Optional[str] = Query(default=None),
    user_id: Optional[str] = Query(default=None),
    success: Optional[bool] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    skip: int = Query(default=0, ge=0),
):
    """Login attempt audit trail (success + failure)."""
    q: dict = {}
    if email:
        q["email"] = email.lower()
    if user_id:
        q["user_id"] = user_id
    if success is not None:
        q["success"] = bool(success)

    total = await db.login_history.count_documents(q)
    cursor = (
        db.login_history.find(q, {"_id": 0})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    items = [_strip_mongo(d) async for d in cursor]
    return {"total": total, "items": items, "limit": limit, "skip": skip}


@router.get("/security/summary")
async def admin_security_summary(_: dict = Depends(require_super_admin)):
    """High-level security KPIs for the super-admin security dashboard."""
    now = datetime.now(timezone.utc)
    last24 = now - timedelta(hours=24)
    last7 = now - timedelta(days=7)

    total_audit = await db.audit_logs.count_documents({})
    audit_last24 = await db.audit_logs.count_documents({"created_at": {"$gte": last24}})
    failed_logins_24 = await db.login_history.count_documents(
        {"success": False, "created_at": {"$gte": last24}}
    )
    successful_logins_24 = await db.login_history.count_documents(
        {"success": True, "created_at": {"$gte": last24}}
    )
    failed_logins_7 = await db.login_history.count_documents(
        {"success": False, "created_at": {"$gte": last7}}
    )

    # Top 5 emails with most failed logins in last 24h
    top_fail_pipeline = [
        {"$match": {"success": False, "created_at": {"$gte": last24}}},
        {"$group": {"_id": "$email", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5},
    ]
    top_failed_emails = [
        {"email": d["_id"], "count": d["count"]}
        async for d in db.login_history.aggregate(top_fail_pipeline)
    ]

    return {
        "total_audit_logs": total_audit,
        "audit_logs_last_24h": audit_last24,
        "failed_logins_last_24h": failed_logins_24,
        "successful_logins_last_24h": successful_logins_24,
        "failed_logins_last_7d": failed_logins_7,
        "top_failed_login_emails_24h": top_failed_emails,
    }
