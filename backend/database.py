"""MongoDB client + collection helpers."""
from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from config import DB_NAME, MONGO_URL

client: AsyncIOMotorClient = AsyncIOMotorClient(MONGO_URL)
db: AsyncIOMotorDatabase = client[DB_NAME]


async def ensure_indexes() -> None:
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.products.create_index("product_id", unique=True)
    await db.products.create_index("category")
    await db.categories.create_index("slug", unique=True)
    await db.orders.create_index("order_id", unique=True)
    await db.orders.create_index("user_id")

    # New collections
    await db.addresses.create_index("address_id", unique=True)
    await db.addresses.create_index("user_id")
    await db.wishlist.create_index([("user_id", 1), ("product_id", 1)], unique=True)
    await db.wallet_txns.create_index("txn_id", unique=True)
    await db.wallet_txns.create_index([("user_id", 1), ("created_at", -1)])
    await db.payment_methods.create_index("method_id", unique=True)
    await db.payment_methods.create_index("user_id")
    await db.otp_codes.create_index("expires_at", expireAfterSeconds=0)
    await db.support_tickets.create_index("ticket_id", unique=True)
    await db.support_tickets.create_index("user_id")
    await db.support_messages.create_index([("ticket_id", 1), ("created_at", 1)])

    # ---- Phase 8: Drivers / Stores / RBAC ----
    await db.drivers.create_index("driver_id", unique=True)
    await db.drivers.create_index("user_id", unique=True)
    await db.drivers.create_index("status")
    await db.drivers.create_index("store_id")
    await db.stores.create_index("store_id", unique=True)
    await db.stores.create_index("code", unique=True, sparse=True)
    await db.rider_applications.create_index("application_id", unique=True)
    await db.rider_applications.create_index("email")
    await db.audit_logs.create_index([("user_id", 1), ("created_at", -1)])
    await db.audit_logs.create_index("created_at")
    await db.login_history.create_index([("user_id", 1), ("created_at", -1)])
    await db.driver_locations.create_index("driver_id", unique=True)
    await db.driver_earnings.create_index([("driver_id", 1), ("created_at", -1)])

    # ---- Phase 9: Coupons ----
    await db.coupons.create_index("code", unique=True)
    await db.coupons.create_index("active")
    await db.coupons.create_index("expires_at")

    # ---- Phase 10: Multi-Store Inventory ----
    await db.store_inventory.create_index(
        [("store_id", 1), ("product_id", 1)], unique=True, name="store_product_idx"
    )
    await db.store_inventory.create_index("store_id")
    await db.store_inventory.create_index("product_id")
    await db.store_inventory.create_index([("store_id", 1), ("is_available", 1)])
    # Geo index for nearest-store lookup
    try:
        await db.stores.create_index([("location", "2dsphere")], sparse=True)
    except Exception:
        pass
