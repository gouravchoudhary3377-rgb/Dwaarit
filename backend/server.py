"""Dwaarit Grocery Delivery API.

Implements:
- JWT-based email/password auth (signup, login, /me)
- Emergent-managed Google OAuth (/auth/session)
- Product catalog (public read, admin write)
- Cart / order placement (auth user)
- Admin order management

All routes are prefixed with /api per Kubernetes ingress rules.
"""

from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Literal, Optional

import bcrypt
import httpx
import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Request, status
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------- Config ----------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ.get("JWT_SECRET", "dwaarit-dev-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_DAYS = 7

EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

# ---------- DB ----------
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ---------- App ----------
app = FastAPI(title="Dwaarit API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s :: %(message)s")
log = logging.getLogger("dwaarit")


# ---------- Models ----------
class UserPublic(BaseModel):
    user_id: str
    email: EmailStr
    name: str
    role: Literal["customer", "admin"] = "customer"
    auth_provider: Literal["password", "google"] = "password"
    picture: Optional[str] = None


class SignupIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    token: str
    user: UserPublic


class GoogleSessionIn(BaseModel):
    session_id: str


class Product(BaseModel):
    product_id: str = Field(default_factory=lambda: f"prod_{uuid.uuid4().hex[:12]}")
    name: str
    description: str = ""
    price: float
    unit: str = "ea"  # e.g. "ea", "kg", "L"
    category: str
    image_url: str = ""
    stock: int = 100
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProductIn(BaseModel):
    name: str
    description: str = ""
    price: float
    unit: str = "ea"
    category: str
    image_url: str = ""
    stock: int = 100


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    unit: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    stock: Optional[int] = None


class CartItemIn(BaseModel):
    product_id: str
    quantity: int = Field(ge=1)


class AddressIn(BaseModel):
    full_name: str
    phone: str
    line1: str
    line2: str = ""
    city: str
    pincode: str


class OrderIn(BaseModel):
    items: List[CartItemIn]
    address: AddressIn
    payment_method: Literal["cod", "card"] = "cod"
    notes: str = ""


OrderStatus = Literal["pending", "accepted", "out_for_delivery", "delivered", "cancelled"]


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class Category(BaseModel):
    slug: str
    name: str
    icon: str = ""  # emoji or icon hint
    gallery: List[str] = Field(default_factory=list)  # curated image URLs
    is_default: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    icon: str = ""
    gallery: List[str] = Field(default_factory=list)


# ---------- Helpers ----------
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


def public_user(doc: dict) -> UserPublic:
    return UserPublic(
        user_id=doc["user_id"],
        email=doc["email"],
        name=doc.get("name", ""),
        role=doc.get("role", "customer"),
        auth_provider=doc.get("auth_provider", "password"),
        picture=doc.get("picture"),
    )


async def get_current_user(authorization: Optional[str] = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()

    # Path A: JWT (password auth)
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id:
            user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
            if user:
                return user
    except jwt.PyJWTError:
        pass

    # Path B: Emergent session_token (Google auth)
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if sess:
        exp = normalize_dt(sess.get("expires_at"))
        if exp and exp > datetime.now(timezone.utc):
            user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
            if user:
                return user

    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin only")
    return user


# ---------- Auth Routes ----------
@api.post("/auth/signup", response_model=TokenOut)
async def signup(body: SignupIn):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
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
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(doc)
    return TokenOut(token=issue_jwt(user_id), user=public_user(doc))


@api.post("/auth/login", response_model=TokenOut)
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower()}, {"_id": 0})
    if not user or not user.get("password_hash"):
        raise HTTPException(401, "Invalid credentials")
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    return TokenOut(token=issue_jwt(user["user_id"]), user=public_user(user))


@api.post("/auth/session", response_model=TokenOut)
async def google_session(body: GoogleSessionIn):
    """Exchange Emergent session_id for our session_token; upsert user."""
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


@api.get("/auth/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@api.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(default=None)):
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_many({"session_token": token})
    return {"ok": True}


# ---------- Product Routes ----------
@api.get("/products", response_model=List[Product])
async def list_products(category: Optional[str] = None, q: Optional[str] = None):
    query: dict = {}
    if category and category.lower() != "all":
        query["category"] = category
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    docs = await db.products.find(query, {"_id": 0}).to_list(500)
    return [Product(**d) for d in docs]


@api.get("/products/categories")
async def list_categories():
    cats = await db.products.distinct("category")
    return {"categories": sorted(cats)}


@api.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str):
    doc = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Product not found")
    return Product(**doc)


@api.post("/admin/products", response_model=Product)
async def admin_create_product(body: ProductIn, _: dict = Depends(require_admin)):
    p = Product(**body.dict())
    await db.products.insert_one(p.dict())
    return p


@api.patch("/admin/products/{product_id}", response_model=Product)
async def admin_update_product(product_id: str, body: ProductUpdate, _: dict = Depends(require_admin)):
    upd = {k: v for k, v in body.dict().items() if v is not None}
    if not upd:
        raise HTTPException(400, "No fields to update")
    res = await db.products.update_one({"product_id": product_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Product not found")
    doc = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    return Product(**doc)


@api.delete("/admin/products/{product_id}")
async def admin_delete_product(product_id: str, _: dict = Depends(require_admin)):
    res = await db.products.delete_one({"product_id": product_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Product not found")
    return {"ok": True}


# ---------- Category Routes ----------
def _slugify(name: str) -> str:
    return "-".join(name.lower().split())


@api.get("/categories", response_model=List[Category])
async def list_categories_full():
    docs = await db.categories.find({}, {"_id": 0}).sort("name", 1).to_list(200)
    return [Category(**d) for d in docs]


@api.post("/admin/categories", response_model=Category)
async def admin_create_category(body: CategoryIn, _: dict = Depends(require_admin)):
    slug = _slugify(body.name)
    if await db.categories.find_one({"slug": slug}):
        raise HTTPException(409, "Category already exists")
    cat = Category(slug=slug, name=body.name.strip(), icon=body.icon, gallery=body.gallery, is_default=False)
    await db.categories.insert_one(cat.dict())
    return cat


@api.delete("/admin/categories/{slug}")
async def admin_delete_category(slug: str, _: dict = Depends(require_admin)):
    cat = await db.categories.find_one({"slug": slug})
    if not cat:
        raise HTTPException(404, "Category not found")
    if cat.get("is_default"):
        raise HTTPException(400, "Cannot delete a default category")
    in_use = await db.products.count_documents({"category": cat["name"]})
    if in_use > 0:
        raise HTTPException(400, f"Category in use by {in_use} products")
    await db.categories.delete_one({"slug": slug})
    return {"ok": True}


# ---------- Order Routes ----------
@api.post("/orders")
async def create_order(body: OrderIn, user: dict = Depends(get_current_user)):
    if not body.items:
        raise HTTPException(400, "Order must contain items")
    # Snapshot products & compute total server-side
    product_ids = [it.product_id for it in body.items]
    products = await db.products.find({"product_id": {"$in": product_ids}}, {"_id": 0}).to_list(500)
    pmap = {p["product_id"]: p for p in products}
    items = []
    total = 0.0
    for it in body.items:
        p = pmap.get(it.product_id)
        if not p:
            raise HTTPException(400, f"Product {it.product_id} not found")
        subtotal = round(p["price"] * it.quantity, 2)
        total += subtotal
        items.append({
            "product_id": p["product_id"],
            "name": p["name"],
            "image_url": p.get("image_url", ""),
            "unit": p.get("unit", "ea"),
            "price": p["price"],
            "quantity": it.quantity,
            "subtotal": subtotal,
        })

    order_id = f"ord_{uuid.uuid4().hex[:12]}"
    doc = {
        "order_id": order_id,
        "user_id": user["user_id"],
        "user_email": user["email"],
        "items": items,
        "total": round(total, 2),
        "address": body.address.dict(),
        "payment_method": body.payment_method,
        "notes": body.notes,
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.orders.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/orders")
async def list_my_orders(user: dict = Depends(get_current_user)):
    docs = await db.orders.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs


@api.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    doc = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Order not found")
    if doc["user_id"] != user["user_id"] and user.get("role") != "admin":
        raise HTTPException(403, "Forbidden")
    return doc


@api.get("/admin/orders")
async def admin_list_orders(_: dict = Depends(require_admin)):
    docs = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@api.patch("/admin/orders/{order_id}/status")
async def admin_update_order_status(order_id: str, body: OrderStatusUpdate, _: dict = Depends(require_admin)):
    res = await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {"status": body.status, "updated_at": datetime.now(timezone.utc)}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Order not found")
    doc = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    return doc


# ---------- Misc ----------
@api.get("/")
async def root():
    return {"app": "Dwaarit API", "status": "ok"}


@api.get("/health")
async def health():
    return {"ok": True, "time": datetime.now(timezone.utc).isoformat()}


# ---------- Startup ----------
@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.products.create_index("product_id", unique=True)
    await db.products.create_index("category")
    await db.categories.create_index("slug", unique=True)
    await db.orders.create_index("order_id", unique=True)
    await db.orders.create_index("user_id")

    # Seed admin + sample products if empty.
    await _seed_if_empty()
    await _seed_categories_if_empty()
    log.info("Dwaarit API ready.")


async def _seed_if_empty():
    admin_email = "admin@dwaarit.com"
    if not await db.users.find_one({"email": admin_email}):
        await db.users.insert_one({
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": admin_email,
            "name": "Dwaarit Admin",
            "password_hash": hash_password("Admin@123"),
            "role": "admin",
            "auth_provider": "password",
            "picture": None,
            "created_at": datetime.now(timezone.utc),
        })
        log.info("Seeded admin user: %s", admin_email)

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
            "created_at": datetime.now(timezone.utc),
        })
        log.info("Seeded demo customer: %s", demo_email)

    if await db.products.count_documents({}) == 0:
        seed_products = [
            # Fruits
            {"name": "Fresh Strawberries", "category": "Fruits", "price": 4.99, "unit": "box",
             "description": "Sweet, ripe strawberries handpicked daily.",
             "image_url": "https://images.unsplash.com/photo-1614630536429-74e43f302c31?w=800&q=80"},
            {"name": "Juicy Oranges", "category": "Fruits", "price": 3.49, "unit": "kg",
             "description": "Bright, tangy oranges packed with vitamin C.",
             "image_url": "https://images.pexels.com/photos/18452311/pexels-photo-18452311.jpeg?w=800"},
            {"name": "Mixed Citrus Pack", "category": "Fruits", "price": 5.99, "unit": "pack",
             "description": "Assorted citrus & tropical fruits.",
             "image_url": "https://images.pexels.com/photos/4113810/pexels-photo-4113810.jpeg?w=800"},
            # Vegetables
            {"name": "Fresh Garlic", "category": "Vegetables", "price": 1.49, "unit": "200g",
             "description": "Aromatic farm-fresh garlic.",
             "image_url": "https://images.unsplash.com/photo-1587049633312-d628ae50a8ae?w=800&q=80"},
            {"name": "Seasonal Veggie Mix", "category": "Vegetables", "price": 6.49, "unit": "pack",
             "description": "Hand-cut mix of seasonal vegetables.",
             "image_url": "https://images.pexels.com/photos/7223295/pexels-photo-7223295.jpeg?w=800"},
            # Dairy
            {"name": "Whole Milk 1L", "category": "Dairy", "price": 2.20, "unit": "L",
             "description": "Creamy, full-fat milk from local farms.",
             "image_url": "https://images.unsplash.com/photo-1567011345445-fd175f248019?w=800&q=80"},
            {"name": "Fresh Mozzarella", "category": "Dairy", "price": 4.50, "unit": "250g",
             "description": "Soft, milky mozzarella balls.",
             "image_url": "https://images.unsplash.com/photo-1477921510058-85812315a3c4?w=800&q=80"},
            # Bakery
            {"name": "Artisan Bread Loaf", "category": "Bakery", "price": 3.20, "unit": "ea",
             "description": "Hand-shaped sourdough, baked daily.",
             "image_url": "https://images.pexels.com/photos/30273276/pexels-photo-30273276.jpeg?w=800"},
            {"name": "Butter Cookies", "category": "Bakery", "price": 2.99, "unit": "pack",
             "description": "Crisp, melt-in-your-mouth cookies.",
             "image_url": "https://images.unsplash.com/photo-1637770781010-dfd6f3b8a05c?w=800&q=80"},
            {"name": "Bakery Sampler", "category": "Bakery", "price": 5.50, "unit": "pack",
             "description": "Assorted pastries fresh from the oven.",
             "image_url": "https://images.unsplash.com/photo-1655489167632-2aac1a502bcf?w=800&q=80"},
            # Beverages
            {"name": "Spring Water 1L", "category": "Beverages", "price": 1.00, "unit": "L",
             "description": "Pure, refreshing spring water.",
             "image_url": "https://images.unsplash.com/photo-1523362628745-0c100150b504?w=800&q=80"},
            {"name": "Cold Brew Coffee", "category": "Beverages", "price": 3.80, "unit": "bottle",
             "description": "Smooth, slow-steeped cold brew.",
             "image_url": "https://images.unsplash.com/photo-1593375548392-d3f977b8a2f0?w=800&q=80"},
            # Snacks
            {"name": "Golden Potato Chips", "category": "Snacks", "price": 2.49, "unit": "pack",
             "description": "Crunchy, lightly salted chips.",
             "image_url": "https://images.pexels.com/photos/34466116/pexels-photo-34466116.jpeg?w=800"},
        ]
        docs = [Product(**p).dict() for p in seed_products]
        await db.products.insert_many(docs)
        log.info("Seeded %d products.", len(docs))


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


async def _seed_categories_if_empty():
    if await db.categories.count_documents({}) > 0:
        return
    defaults = [
        {
            "name": "Fruits", "icon": "🍎",
            "gallery": [
                "https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?w=600&q=80",
                "https://images.unsplash.com/photo-1587132137056-bfbf0166836e?w=600&q=80",
                "https://images.unsplash.com/photo-1557800636-894a64c1696f?w=600&q=80",
                "https://images.unsplash.com/photo-1547514701-42782101795e?w=600&q=80",
                "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600&q=80",
            ],
        },
        {
            "name": "Vegetables", "icon": "🥦",
            "gallery": [
                "https://images.unsplash.com/photo-1615486171815-2611a6e3cd02?w=600&q=80",
                "https://images.unsplash.com/photo-1617130094141-532436117aa1?w=600&q=80",
                "https://images.unsplash.com/photo-1589927986089-35812388d1f4?w=600&q=80",
                "https://images.unsplash.com/photo-1587049633312-d628ae50a8ae?w=600&q=80",
                "https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=600&q=80",
            ],
        },
        {
            "name": "Dairy & Eggs", "icon": "🥛",
            "gallery": [
                "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=600&q=80",
                "https://images.unsplash.com/photo-1585083969600-495ee7e3604b?w=600&q=80",
                "https://images.unsplash.com/photo-1536816579748-4ecb3f03d72a?w=600&q=80",
                "https://images.unsplash.com/photo-1683314573422-649a3c6ad784?w=600&q=80",
                "https://images.pexels.com/photos/5946755/pexels-photo-5946755.jpeg?w=600",
            ],
        },
        {
            "name": "Bakery", "icon": "🍞",
            "gallery": [
                "https://images.unsplash.com/photo-1534620808146-d33bb39128b2?w=600&q=80",
                "https://images.unsplash.com/photo-1598373182133-52452f7691ef?w=600&q=80",
                "https://images.unsplash.com/photo-1597733153203-a54d0fbc47de?w=600&q=80",
                "https://images.unsplash.com/photo-1598839950984-034f6dc7b495?w=600&q=80",
                "https://images.pexels.com/photos/9120377/pexels-photo-9120377.jpeg?w=600",
            ],
        },
        {
            "name": "Snacks", "icon": "🍿",
            "gallery": [
                "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=600&q=80",
                "https://images.unsplash.com/photo-1699666397768-0126340e880a?w=600&q=80",
                "https://images.unsplash.com/photo-1623660053975-cf75a8be0908?w=600&q=80",
                "https://images.unsplash.com/photo-1610450949065-1f2841536c88?w=600&q=80",
                "https://images.pexels.com/photos/34466116/pexels-photo-34466116.jpeg?w=600",
            ],
        },
        {
            "name": "Beverages", "icon": "🥤",
            "gallery": [
                "https://images.unsplash.com/photo-1616118132534-381148898bb4?w=600&q=80",
                "https://images.unsplash.com/photo-1625865019845-7b2c89b8a8a9?w=600&q=80",
                "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=600&q=80",
                "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=600&q=80",
                "https://images.unsplash.com/photo-1620160428336-bd4dd3e90415?w=600&q=80",
            ],
        },
        {
            "name": "Staples", "icon": "🌾",
            "gallery": [
                "https://images.unsplash.com/photo-1686820740687-426a7b9b2043?w=600&q=80",
                "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&q=80",
                "https://images.pexels.com/photos/36346840/pexels-photo-36346840.jpeg?w=600",
                "https://images.pexels.com/photos/18328392/pexels-photo-18328392.jpeg?w=600",
                "https://images.unsplash.com/photo-1643622357625-c013987d90e7?w=600&q=80",
            ],
        },
        {
            "name": "Personal Care", "icon": "🧴",
            "gallery": [
                "https://images.unsplash.com/photo-1701992678972-d5a053ad0fb0?w=600&q=80",
                "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&q=80",
                "https://images.unsplash.com/photo-1747858989102-cca0f4dc4a11?w=600&q=80",
                "https://images.unsplash.com/photo-1619451427882-6aaaded0cc61?w=600&q=80",
                "https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=600&q=80",
            ],
        },
        {
            "name": "Household", "icon": "🧹",
            "gallery": [
                "https://images.pexels.com/photos/5217898/pexels-photo-5217898.jpeg?w=600",
                "https://images.unsplash.com/photo-1617182700621-c1eb90a7e866?w=600&q=80",
                "https://images.pexels.com/photos/10566513/pexels-photo-10566513.jpeg?w=600",
                "https://images.unsplash.com/photo-1563453392212-326f5e854473?w=600&q=80",
                "https://images.pexels.com/photos/10566507/pexels-photo-10566507.jpeg?w=600",
            ],
        },
    ]
    docs = []
    for d in defaults:
        slug = _slugify(d["name"])
        docs.append(Category(slug=slug, name=d["name"], icon=d["icon"], gallery=d["gallery"], is_default=True).dict())
    await db.categories.insert_many(docs)
    log.info("Seeded %d default categories.", len(docs))


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
