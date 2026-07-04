"""Seed initial admin, demo user, products, categories."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from database import db
from models import Category, Product
from routes.categories import slugify
from security import hash_password

log = logging.getLogger("dwaarit.seed")


async def seed_users_and_products() -> None:
    admin_email = "admin@dwaarit.com"
    existing_admin = await db.users.find_one({"email": admin_email})
    if not existing_admin:
        await db.users.insert_one({
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": admin_email,
            "name": "Dwaarit Admin",
            "password_hash": hash_password("Admin@123"),
            "role": "super_admin",
            "auth_provider": "password",
            "picture": None,
            "mobile": None,
            "mobile_verified": False,
            "created_at": datetime.now(timezone.utc),
        })
        log.info("Seeded super admin user: %s", admin_email)
    elif existing_admin.get("role") == "admin":
        # Migrate legacy 'admin' → 'super_admin'
        await db.users.update_one(
            {"user_id": existing_admin["user_id"]},
            {"$set": {"role": "super_admin"}},
        )
        log.info("Migrated admin → super_admin: %s", admin_email)

    demo_email = "demo@dwaarit.com"
    if not await db.users.find_one({"email": demo_email}):
        await db.users.insert_one({
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": demo_email,
            "name": "Demo Customer",
            "password_hash": hash_password("Demo@123"),
            "role": "customer",
            "auth_provider": "password",
            "picture": None,
            "mobile": None,
            "mobile_verified": False,
            "created_at": datetime.now(timezone.utc),
        })
        log.info("Seeded demo customer: %s", demo_email)

    if await db.products.count_documents({}) == 0:
        seed_products = [
            {"name": "Fresh Strawberries", "category": "Fruits", "price": 4.99, "unit": "box",
             "description": "Sweet, ripe strawberries handpicked daily.",
             "image_url": "https://images.unsplash.com/photo-1614630536429-74e43f302c31?w=800&q=80"},
            {"name": "Juicy Oranges", "category": "Fruits", "price": 3.49, "unit": "kg",
             "description": "Bright, tangy oranges packed with vitamin C.",
             "image_url": "https://images.pexels.com/photos/18452311/pexels-photo-18452311.jpeg?w=800"},
            {"name": "Mixed Citrus Pack", "category": "Fruits", "price": 5.99, "unit": "pack",
             "description": "Assorted citrus & tropical fruits.",
             "image_url": "https://images.pexels.com/photos/4113810/pexels-photo-4113810.jpeg?w=800"},
            {"name": "Fresh Garlic", "category": "Vegetables", "price": 1.49, "unit": "200g",
             "description": "Aromatic farm-fresh garlic.",
             "image_url": "https://images.unsplash.com/photo-1587049633312-d628ae50a8ae?w=800&q=80"},
            {"name": "Seasonal Veggie Mix", "category": "Vegetables", "price": 6.49, "unit": "pack",
             "description": "Hand-cut mix of seasonal vegetables.",
             "image_url": "https://images.pexels.com/photos/7223295/pexels-photo-7223295.jpeg?w=800"},
            {"name": "Whole Milk 1L", "category": "Dairy", "price": 2.20, "unit": "L",
             "description": "Creamy, full-fat milk from local farms.",
             "image_url": "https://images.unsplash.com/photo-1567011345445-fd175f248019?w=800&q=80"},
            {"name": "Fresh Mozzarella", "category": "Dairy", "price": 4.50, "unit": "250g",
             "description": "Soft, milky mozzarella balls.",
             "image_url": "https://images.unsplash.com/photo-1477921510058-85812315a3c4?w=800&q=80"},
            {"name": "Artisan Bread Loaf", "category": "Bakery", "price": 3.20, "unit": "ea",
             "description": "Hand-shaped sourdough, baked daily.",
             "image_url": "https://images.pexels.com/photos/30273276/pexels-photo-30273276.jpeg?w=800"},
            {"name": "Butter Cookies", "category": "Bakery", "price": 2.99, "unit": "pack",
             "description": "Crisp, melt-in-your-mouth cookies.",
             "image_url": "https://images.unsplash.com/photo-1637770781010-dfd6f3b8a05c?w=800&q=80"},
            {"name": "Bakery Sampler", "category": "Bakery", "price": 5.50, "unit": "pack",
             "description": "Assorted pastries fresh from the oven.",
             "image_url": "https://images.unsplash.com/photo-1655489167632-2aac1a502bcf?w=800&q=80"},
            {"name": "Spring Water 1L", "category": "Beverages", "price": 1.00, "unit": "L",
             "description": "Pure, refreshing spring water.",
             "image_url": "https://images.unsplash.com/photo-1523362628745-0c100150b504?w=800&q=80"},
            {"name": "Cold Brew Coffee", "category": "Beverages", "price": 3.80, "unit": "bottle",
             "description": "Smooth, slow-steeped cold brew.",
             "image_url": "https://images.unsplash.com/photo-1593375548392-d3f977b8a2f0?w=800&q=80"},
            {"name": "Golden Potato Chips", "category": "Snacks", "price": 2.49, "unit": "pack",
             "description": "Crunchy, lightly salted chips.",
             "image_url": "https://images.pexels.com/photos/34466116/pexels-photo-34466116.jpeg?w=800"},
        ]
        docs = [Product(**p).dict() for p in seed_products]
        await db.products.insert_many(docs)
        log.info("Seeded %d products.", len(docs))

    # Blinkit-style merchandising backfill: ensure every product has an MRP,
    # discount %, and delivery ETA so badges render in the UI. We only fill
    # missing fields — never overwrite admin-curated values.
    await _backfill_merchandising_fields()


async def _backfill_merchandising_fields() -> None:
    """One-time-ish backfill of mrp/discount_percent/delivery_eta_min.

    Strategy: for each product missing these fields, derive a believable
    MRP that is 8–20% above the selling price (deterministic on product_id
    so values are stable across restarts).
    """
    import hashlib

    cursor = db.products.find({}, {"_id": 0, "product_id": 1, "price": 1,
                                    "mrp": 1, "discount_percent": 1,
                                    "delivery_eta_min": 1})
    async for doc in cursor:
        updates: dict = {}
        price = float(doc.get("price") or 0)
        has_mrp = doc.get("mrp") is not None
        has_pct = doc.get("discount_percent") is not None
        has_eta = doc.get("delivery_eta_min") is not None

        if price > 0 and (not has_mrp or not has_pct):
            # 8 .. 20 % off, deterministic per product
            seed = int(hashlib.md5(doc["product_id"].encode()).hexdigest()[:4], 16)
            pct = 8 + (seed % 13)  # 8..20
            mrp = round(price / (1 - pct / 100), 2)
            if not has_mrp:
                updates["mrp"] = mrp
            if not has_pct:
                updates["discount_percent"] = pct

        if not has_eta:
            updates["delivery_eta_min"] = 18

        if updates:
            await db.products.update_one(
                {"product_id": doc["product_id"]}, {"$set": updates}
            )
    log.info("Merchandising backfill complete.")



async def seed_store_manager() -> None:
    """Seed the default store-manager user, a default store and a small pool
    of riders so the Store Manager Panel has something to work with on first
    boot.
    """
    manager_email = "manager@dwaarit.com"
    manager = await db.users.find_one({"email": manager_email})
    if not manager:
        manager = {
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": manager_email,
            "name": "Dwaarit Store Manager",
            "password_hash": hash_password("Manager@123"),
            "role": "store_manager",
            "auth_provider": "password",
            "picture": None,
            "mobile": None,
            "mobile_verified": False,
            "created_at": datetime.now(timezone.utc),
        }
        await db.users.insert_one(manager)
        log.info("Seeded store manager user: %s", manager_email)
    else:
        # Force-correct role if a legacy record has a different role
        if manager.get("role") != "store_manager":
            await db.users.update_one(
                {"user_id": manager["user_id"]},
                {"$set": {"role": "store_manager"}},
            )
            log.info("Migrated user → store_manager: %s", manager_email)

    # Default store doc linked to this manager
    store = await db.stores.find_one({"manager_id": manager["user_id"]})
    if not store:
        store_doc = {
            "store_id": f"store_{uuid.uuid4().hex[:10]}",
            "name": "Dwaarit Central",
            "manager_id": manager["user_id"],
            "address": {
                "line1": "Plot 12, Industrial Area Phase 1",
                "city": "Pathankot",
                "state": "Punjab",
                "pincode": "145001",
                "lat": 32.2746,
                "lng": 75.6521,
            },
            "phone": "+91 90000 00000",
            "is_active": True,
            "service_radius_km": 8,
            "created_at": datetime.now(timezone.utc),
        }
        await db.stores.insert_one(store_doc)
        log.info("Seeded default store: %s", store_doc["store_id"])
        store = store_doc

    # Make sure the pre-seeded rider (rider@dwaarit.com) is attached to this
    # store and approved, so manager can assign immediately.
    rider_user = await db.users.find_one({"email": "rider@dwaarit.com"})
    if rider_user:
        await db.drivers.update_one(
            {"user_id": rider_user["user_id"]},
            {"$set": {"store_id": store["store_id"], "status": "approved"}},
        )


async def seed_categories() -> None:
    if await db.categories.count_documents({}) > 0:
        return
    defaults = [
        {"name": "Fruits", "icon": "\U0001f34e", "gallery": [
            "https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?w=600&q=80",
            "https://images.unsplash.com/photo-1587132137056-bfbf0166836e?w=600&q=80",
            "https://images.unsplash.com/photo-1557800636-894a64c1696f?w=600&q=80",
            "https://images.unsplash.com/photo-1547514701-42782101795e?w=600&q=80",
            "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600&q=80",
        ]},
        {"name": "Vegetables", "icon": "\U0001f966", "gallery": [
            "https://images.unsplash.com/photo-1615486171815-2611a6e3cd02?w=600&q=80",
            "https://images.unsplash.com/photo-1617130094141-532436117aa1?w=600&q=80",
            "https://images.unsplash.com/photo-1589927986089-35812388d1f4?w=600&q=80",
            "https://images.unsplash.com/photo-1587049633312-d628ae50a8ae?w=600&q=80",
            "https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=600&q=80",
        ]},
        {"name": "Dairy & Eggs", "icon": "\U0001f95b", "gallery": [
            "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=600&q=80",
            "https://images.unsplash.com/photo-1585083969600-495ee7e3604b?w=600&q=80",
            "https://images.unsplash.com/photo-1536816579748-4ecb3f03d72a?w=600&q=80",
            "https://images.unsplash.com/photo-1683314573422-649a3c6ad784?w=600&q=80",
            "https://images.pexels.com/photos/5946755/pexels-photo-5946755.jpeg?w=600",
        ]},
        {"name": "Bakery", "icon": "\U0001f35e", "gallery": [
            "https://images.unsplash.com/photo-1534620808146-d33bb39128b2?w=600&q=80",
            "https://images.unsplash.com/photo-1598373182133-52452f7691ef?w=600&q=80",
            "https://images.unsplash.com/photo-1597733153203-a54d0fbc47de?w=600&q=80",
            "https://images.unsplash.com/photo-1598839950984-034f6dc7b495?w=600&q=80",
            "https://images.pexels.com/photos/9120377/pexels-photo-9120377.jpeg?w=600",
        ]},
        {"name": "Snacks", "icon": "\U0001f37f", "gallery": [
            "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=600&q=80",
            "https://images.unsplash.com/photo-1699666397768-0126340e880a?w=600&q=80",
            "https://images.unsplash.com/photo-1623660053975-cf75a8be0908?w=600&q=80",
            "https://images.unsplash.com/photo-1610450949065-1f2841536c88?w=600&q=80",
            "https://images.pexels.com/photos/34466116/pexels-photo-34466116.jpeg?w=600",
        ]},
        {"name": "Beverages", "icon": "\U0001f964", "gallery": [
            "https://images.unsplash.com/photo-1616118132534-381148898bb4?w=600&q=80",
            "https://images.unsplash.com/photo-1625865019845-7b2c89b8a8a9?w=600&q=80",
            "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=600&q=80",
            "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=600&q=80",
            "https://images.unsplash.com/photo-1620160428336-bd4dd3e90415?w=600&q=80",
        ]},
        {"name": "Staples", "icon": "\U0001f33e", "gallery": [
            "https://images.unsplash.com/photo-1686820740687-426a7b9b2043?w=600&q=80",
            "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&q=80",
            "https://images.pexels.com/photos/36346840/pexels-photo-36346840.jpeg?w=600",
            "https://images.pexels.com/photos/18328392/pexels-photo-18328392.jpeg?w=600",
            "https://images.unsplash.com/photo-1643622357625-c013987d90e7?w=600&q=80",
        ]},
        {"name": "Personal Care", "icon": "\U0001f9f4", "gallery": [
            "https://images.unsplash.com/photo-1701992678972-d5a053ad0fb0?w=600&q=80",
            "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&q=80",
            "https://images.unsplash.com/photo-1747858989102-cca0f4dc4a11?w=600&q=80",
            "https://images.unsplash.com/photo-1619451427882-6aaaded0cc61?w=600&q=80",
            "https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=600&q=80",
        ]},
        {"name": "Household", "icon": "\U0001f9f9", "gallery": [
            "https://images.pexels.com/photos/5217898/pexels-photo-5217898.jpeg?w=600",
            "https://images.unsplash.com/photo-1617182700621-c1eb90a7e866?w=600&q=80",
            "https://images.pexels.com/photos/10566513/pexels-photo-10566513.jpeg?w=600",
            "https://images.unsplash.com/photo-1563453392212-326f5e854473?w=600&q=80",
            "https://images.pexels.com/photos/10566507/pexels-photo-10566507.jpeg?w=600",
        ]},
    ]
    docs = []
    for d in defaults:
        slug = slugify(d["name"])
        docs.append(Category(slug=slug, name=d["name"], icon=d["icon"], gallery=d["gallery"], is_default=True).dict())
    await db.categories.insert_many(docs)
    log.info("Seeded %d default categories.", len(docs))



async def seed_coupons() -> None:
    """Seed default Blinkit-style promo codes."""
    from datetime import datetime, timedelta, timezone

    if await db.coupons.count_documents({}) > 0:
        return
    now = datetime.now(timezone.utc)
    defaults = [
        {
            "code": "WELCOME50",
            "title": "Flat ₹50 OFF on your first order",
            "description": "Use code WELCOME50 to save ₹50 on orders above ₹199.",
            "discount_type": "flat",
            "value": 50.0,
            "min_order_value": 199.0,
            "max_discount": None,
            "usage_limit": None,
            "per_user_limit": 1,
            "active": True,
            "expires_at": now + timedelta(days=180),
            "created_at": now,
            "updated_at": now,
            "used_count": 0,
        },
        {
            "code": "SAVE10",
            "title": "10% OFF up to ₹100",
            "description": "Get 10% off on orders above ₹299. Max discount ₹100.",
            "discount_type": "percent",
            "value": 10.0,
            "min_order_value": 299.0,
            "max_discount": 100.0,
            "usage_limit": None,
            "per_user_limit": None,
            "active": True,
            "expires_at": now + timedelta(days=90),
            "created_at": now,
            "updated_at": now,
            "used_count": 0,
        },
        {
            "code": "FRESH75",
            "title": "₹75 OFF on orders above ₹499",
            "description": "Fresh groceries, fresher savings. ₹75 off on orders above ₹499.",
            "discount_type": "flat",
            "value": 75.0,
            "min_order_value": 499.0,
            "max_discount": None,
            "usage_limit": None,
            "per_user_limit": None,
            "active": True,
            "expires_at": now + timedelta(days=60),
            "created_at": now,
            "updated_at": now,
            "used_count": 0,
        },
    ]
    await db.coupons.insert_many(defaults)
    log.info("Seeded %d default coupons.", len(defaults))



async def seed_demo_store() -> None:
    """Seed one demo store and populate inventory for all existing products."""
    import uuid as _uuid
    from datetime import datetime, timezone

    # ── 1. Create demo store if it doesn't exist ────────────────────────────
    DEMO_CODE = "FLYNKIT_CENTRAL"
    existing = await db.stores.find_one({"code": DEMO_CODE})
    if not existing:
        store_id = f"store_{_uuid.uuid4().hex[:10]}"
        await db.stores.insert_one({
            "store_id": store_id,
            "code": DEMO_CODE,
            "name": "Flynkit Central",
            "address": "MG Road, Central Business District",
            "city": "Bengaluru",
            "pincode": "560001",
            "lat": 12.9716,   # Bengaluru city centre
            "lng": 77.5946,
            "phone": "+91-80-12345678",
            "delivery_radius_km": 15.0,
            "open_time": "07:00",
            "close_time": "23:00",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
        })
        log.info("Seeded demo store: %s (%s)", "Flynkit Central", store_id)
    else:
        store_id = existing["store_id"]
        # Ensure new fields exist on the existing store record
        upd = {}
        if "delivery_radius_km" not in existing:
            upd["delivery_radius_km"] = 15.0
        if "open_time" not in existing:
            upd["open_time"] = "07:00"
        if "close_time" not in existing:
            upd["close_time"] = "23:00"
        if upd:
            await db.stores.update_one({"store_id": store_id}, {"$set": upd})
        log.info("Demo store already exists: %s", store_id)

    # ── 2. Seed inventory for every product that lacks a record ─────────────
    products = await db.products.find({}, {"_id": 0}).to_list(2000)
    now = datetime.now(timezone.utc)
    seeded = 0
    for p in products:
        pid = p["product_id"]
        exists = await db.store_inventory.find_one(
            {"store_id": store_id, "product_id": pid}
        )
        if not exists:
            sp = p.get("selling_price") or p.get("price", 0)
            await db.store_inventory.update_one(
                {"store_id": store_id, "product_id": pid},
                {
                    "$setOnInsert": {
                        "inv_id": f"inv_{_uuid.uuid4().hex[:12]}",
                        "store_id": store_id,
                        "product_id": pid,
                        "qty": 50,
                        "selling_price": sp,
                        "mrp": p.get("mrp") or sp,
                        "is_available": True,
                        "low_stock_threshold": 5,
                        "created_at": now,
                        "updated_at": now,
                    }
                },
                upsert=True,
            )
            seeded += 1

    if seeded:
        log.info("Seeded %d inventory records for store %s", seeded, store_id)
