"""Phase 1 Admin Add Product feature tests.

Covers:
- GET /api/categories returns >=9 seeded defaults
- POST /api/admin/categories creates with auto slug; admin only
- POST /api/admin/products full payload via custom category
- PATCH /api/admin/products/{id}
- DELETE /api/admin/products/{id}
- Negative auth/role for /admin/products
"""
from __future__ import annotations

import os
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@dwaarit.com"
ADMIN_PASS = "Admin@123"
CUSTOMER_EMAIL = "demo@dwaarit.com"
CUSTOMER_PASS = "Demo@123"


def _hdr(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Accept": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(session) -> str:
    r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user"]["role"] == "admin"
    return body["token"]


@pytest.fixture(scope="module")
def customer_token(session) -> str:
    r = session.post(f"{API}/auth/login", json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASS})
    assert r.status_code == 200, r.text
    return r.json()["token"]


# ------------------------------------------------------------- categories
class TestCategories:
    def test_default_categories_seeded(self, session):
        r = session.get(f"{API}/categories")
        assert r.status_code == 200
        cats = r.json()
        assert isinstance(cats, list)
        # spec asks for >=9 defaults
        assert len(cats) >= 9, f"expected >=9 default cats, got {len(cats)}"
        # spot-check shape
        first = cats[0]
        for k in ("slug", "name", "icon", "gallery"):
            assert k in first
        # known defaults exist
        names = {c["name"] for c in cats}
        assert {"Fruits", "Vegetables", "Bakery"}.issubset(names)

    def test_admin_create_category_auto_slug(self, session, admin_token):
        rand = uuid.uuid4().hex[:6]
        name = f"TEST Cat {rand}"
        r = session.post(
            f"{API}/admin/categories",
            headers=_hdr(admin_token),
            json={"name": name, "icon": "🧪", "gallery": ["https://example.com/x.jpg"]},
        )
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["name"] == name
        # slug = lowercase, hyphenated
        assert created["slug"] == f"test-cat-{rand}"
        assert created["icon"] == "🧪"
        assert created["gallery"] == ["https://example.com/x.jpg"]
        assert created.get("is_default") is False

        # Verify present in listing
        listing = session.get(f"{API}/categories").json()
        assert any(c["slug"] == created["slug"] for c in listing)

    def test_customer_cannot_create_category(self, session, customer_token):
        r = session.post(
            f"{API}/admin/categories",
            headers=_hdr(customer_token),
            json={"name": "TEST Forbid"},
        )
        assert r.status_code == 403

    def test_unauth_cannot_create_category(self, session):
        r = session.post(f"{API}/admin/categories", json={"name": "TEST No-Auth"})
        assert r.status_code == 401


# ------------------------------------------------------------- products via custom category
class TestAdminProductFlow:
    def test_full_flow_with_new_category(self, session, admin_token, customer_token):
        rand = uuid.uuid4().hex[:6]
        cat_name = f"TEST PhaseOne {rand}"
        cat_r = session.post(
            f"{API}/admin/categories",
            headers=_hdr(admin_token),
            json={"name": cat_name, "icon": "🆕", "gallery": []},
        )
        assert cat_r.status_code == 200, cat_r.text

        # Create product under the new category
        payload = {
            "name": f"TEST Product {rand}",
            "description": "automated test product",
            "price": 199.50,
            "unit": "1 kg",
            "category": cat_name,
            "image_url": "https://picsum.photos/300",
            "stock": 42,
        }
        cr = session.post(f"{API}/admin/products", headers=_hdr(admin_token), json=payload)
        assert cr.status_code == 200, cr.text
        prod = cr.json()
        assert "product_id" in prod and prod["product_id"].startswith("prod_")
        assert prod["name"] == payload["name"]
        assert prod["price"] == payload["price"]
        assert prod["category"] == cat_name
        assert prod["unit"] == "1 kg"
        assert prod["stock"] == 42
        pid = prod["product_id"]

        # GET /api/products contains it
        listing = session.get(f"{API}/products").json()
        assert any(p["product_id"] == pid for p in listing)

        # PATCH
        u = session.patch(
            f"{API}/admin/products/{pid}",
            headers=_hdr(admin_token),
            json={"price": 249.00, "stock": 10},
        )
        assert u.status_code == 200, u.text
        assert u.json()["price"] == 249.00
        assert u.json()["stock"] == 10

        # Verify persistence via GET
        g = session.get(f"{API}/products/{pid}")
        assert g.status_code == 200
        assert g.json()["price"] == 249.00
        assert g.json()["stock"] == 10

        # Negative: unauth & customer cannot create product
        no = session.post(f"{API}/admin/products", json=payload)
        assert no.status_code == 401
        cust = session.post(f"{API}/admin/products", headers=_hdr(customer_token), json=payload)
        assert cust.status_code == 403

        # DELETE
        d = session.delete(f"{API}/admin/products/{pid}", headers=_hdr(admin_token))
        assert d.status_code == 200

        # GET /api/products no longer contains it
        listing2 = session.get(f"{API}/products").json()
        assert not any(p["product_id"] == pid for p in listing2)
        # 404 via get-by-id
        gone = session.get(f"{API}/products/{pid}")
        assert gone.status_code == 404
