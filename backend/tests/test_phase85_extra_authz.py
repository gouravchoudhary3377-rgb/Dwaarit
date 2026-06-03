"""Phase 8.5 supplementary AuthZ matrix tests.

Covers the gaps requested in iteration_18 review:
  - Customer cannot POST /api/rider/location (require_rider gate).
  - Rider cannot GET /api/orders/{id}/driver-location for an order they don't own.
  - Unauthenticated POST /api/rider/location is rejected.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://order-analytics-26.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

CUSTOMER_EMAIL = "demo@dwaarit.com"
CUSTOMER_PASS = "Demo@123"
RIDER_EMAIL = "rider@dwaarit.com"
RIDER_PASS = "Rider@123"
ADMIN_EMAIL = "admin@dwaarit.com"
ADMIN_PASS = "Admin@123"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login {email} -> {r.status_code} {r.text}"
    return r.json()


def _h(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def customer_token():
    return _login(CUSTOMER_EMAIL, CUSTOMER_PASS)["token"]


@pytest.fixture(scope="module")
def rider_token():
    return _login(RIDER_EMAIL, RIDER_PASS)["token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASS)["token"]


@pytest.fixture(scope="module")
def customer_owned_order_id(customer_token):
    """Place a fresh COD order owned by the demo customer."""
    pr = requests.get(f"{API}/products", timeout=20)
    assert pr.status_code == 200
    products = pr.json()
    pid = products[0]["product_id"]
    body = {
        "items": [{"product_id": pid, "quantity": 1}],
        "address": {
            "full_name": "TEST P85x Customer",
            "phone": "+919999999999",
            "line1": "TEST P85x line1",
            "line2": "",
            "city": "Pathankot",
            "pincode": "145001",
            "type": "home",
        },
        "payment_method": "cod",
        "use_wallet": False,
        "notes": "TEST_P85x",
    }
    r = requests.post(f"{API}/orders", json=body, headers=_h(customer_token), timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["order_id"]


class TestRiderLocationPostAuthZ:
    """POST /api/rider/location – only role=='rider' allowed."""

    def test_unauthenticated_rejected(self):
        r = requests.post(f"{API}/rider/location", json={"lat": 32.0, "lng": 75.0}, timeout=20)
        assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"

    def test_customer_cannot_post(self, customer_token):
        r = requests.post(
            f"{API}/rider/location",
            json={"lat": 32.0, "lng": 75.0},
            headers=_h(customer_token),
            timeout=20,
        )
        assert r.status_code == 403, f"customer expected 403 got {r.status_code}: {r.text}"

    def test_admin_cannot_post_as_rider(self, admin_token):
        r = requests.post(
            f"{API}/rider/location",
            json={"lat": 32.0, "lng": 75.0},
            headers=_h(admin_token),
            timeout=20,
        )
        assert r.status_code == 403, f"admin expected 403 got {r.status_code}"

    def test_rider_can_post(self, rider_token):
        r = requests.post(
            f"{API}/rider/location",
            json={"lat": 32.378, "lng": 75.527},
            headers=_h(rider_token),
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True


class TestRiderCannotReadOthersOrderLocation:
    """GET /api/orders/{id}/driver-location – owner-only for customers; rider role is NOT staff."""

    def test_rider_role_cannot_read_customer_order(self, rider_token, customer_owned_order_id):
        # The rider user is not the order's user_id and rider role is not in (admin, super_admin, store_manager)
        r = requests.get(
            f"{API}/orders/{customer_owned_order_id}/driver-location",
            headers=_h(rider_token),
            timeout=20,
        )
        assert r.status_code == 403, f"rider expected 403 got {r.status_code}: {r.text}"
