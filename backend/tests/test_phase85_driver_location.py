"""Phase 8.5 — Customer-facing rider card / GET /orders/{id}/driver-location tests.

Covers:
  1. assigned=False when fresh COD order has no driver_id.
  2. assigned=True with driver{name,phone,vehicle} after rider is assigned.
  3. location field shape — always present in the assigned=True payload (lat/lng may be null until rider pings).
  4. AuthZ matrix: 401 (no token), 403 (different customer), 200 (owner / admin / store_manager).
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://dwaarit-grocery.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

CUSTOMER_EMAIL = "demo@dwaarit.com"
CUSTOMER_PASS = "Demo@123"
RIDER_EMAIL = "rider@dwaarit.com"
RIDER_PASS = "Rider@123"
ADMIN_EMAIL = "admin@dwaarit.com"
ADMIN_PASS = "Admin@123"
MANAGER_EMAIL = "manager@dwaarit.com"
MANAGER_PASS = "Manager@123"

RIDER_DRIVER_ID = "drv_2a5c03fa24"


# -------------- helpers --------------
def _login(email: str, password: str) -> dict:
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login {email} -> {r.status_code} {r.text}"
    return r.json()


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# -------------- shared fixtures --------------
@pytest.fixture(scope="module")
def customer():
    data = _login(CUSTOMER_EMAIL, CUSTOMER_PASS)
    return data["token"], data["user"]["user_id"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASS)["token"]


@pytest.fixture(scope="module")
def manager_token():
    return _login(MANAGER_EMAIL, MANAGER_PASS)["token"]


@pytest.fixture(scope="module")
def second_customer_token():
    """Sign up a fresh customer so we can test 403 from a non-owner customer."""
    suffix = uuid.uuid4().hex[:8]
    email = f"test_p85_{suffix}@example.com"
    pw = "TestPass@123"
    r = requests.post(
        f"{API}/auth/signup",
        json={"name": f"TEST P85 {suffix}", "email": email, "password": pw},
        timeout=20,
    )
    assert r.status_code in (200, 201), f"signup -> {r.status_code} {r.text}"
    data = r.json()
    return data["token"]


@pytest.fixture(scope="module")
def fresh_cod_order(customer):
    """Place a fresh COD order owned by the demo customer."""
    token, _ = customer
    # Pick a real product to keep the cart valid.
    pr = requests.get(f"{API}/products", timeout=20)
    assert pr.status_code == 200, pr.text
    products = pr.json()
    assert len(products) > 0, "no products seeded"
    pid = products[0]["product_id"]

    body = {
        "items": [{"product_id": pid, "quantity": 1}],
        "address": {
            "full_name": "TEST P85 Customer",
            "phone": "+919999999999",
            "line1": "TEST P85 line1",
            "line2": "",
            "city": "Pathankot",
            "pincode": "145001",
            "type": "home",
        },
        "payment_method": "cod",
        "use_wallet": False,
        "notes": "TEST_P85",
    }
    r = requests.post(f"{API}/orders", json=body, headers=_h(token), timeout=30)
    assert r.status_code == 200, f"create order -> {r.status_code} {r.text}"
    order = r.json()
    assert order.get("status") == "pending"
    assert order.get("payment_method") == "cod"
    assert "driver_id" not in order or not order.get("driver_id")
    return order["order_id"]


# ============================================================
# 1. UNASSIGNED ORDER
# ============================================================
class TestUnassignedOrder:
    def test_owner_gets_assigned_false(self, customer, fresh_cod_order):
        token, _ = customer
        r = requests.get(
            f"{API}/orders/{fresh_cod_order}/driver-location",
            headers=_h(token),
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("assigned") is False
        # When unassigned the payload should be minimal — no driver object.
        assert "driver" not in body or body.get("driver") is None


# ============================================================
# 2. AUTHZ MATRIX (still works while order is unassigned)
# ============================================================
class TestAuthZMatrix:
    def test_unauthenticated_401(self, fresh_cod_order):
        r = requests.get(f"{API}/orders/{fresh_cod_order}/driver-location", timeout=20)
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"
        # FastAPI HTTPBearer returns 403 if no header is present; the contract
        # we care about is "rejected".  We accept either 401 or 403 here.

    def test_other_customer_forbidden(self, second_customer_token, fresh_cod_order):
        r = requests.get(
            f"{API}/orders/{fresh_cod_order}/driver-location",
            headers=_h(second_customer_token),
            timeout=20,
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_admin_can_view(self, admin_token, fresh_cod_order):
        r = requests.get(
            f"{API}/orders/{fresh_cod_order}/driver-location",
            headers=_h(admin_token),
            timeout=20,
        )
        assert r.status_code == 200, r.text
        assert "assigned" in r.json()

    def test_store_manager_can_view(self, manager_token, fresh_cod_order):
        r = requests.get(
            f"{API}/orders/{fresh_cod_order}/driver-location",
            headers=_h(manager_token),
            timeout=20,
        )
        assert r.status_code == 200, r.text
        assert "assigned" in r.json()

    def test_404_for_unknown_order(self, customer):
        token, _ = customer
        r = requests.get(
            f"{API}/orders/ord_doesnotexist_p85/driver-location",
            headers=_h(token),
            timeout=20,
        )
        assert r.status_code == 404


# ============================================================
# 3. ASSIGNED ORDER (admin assigns the demo rider)
# ============================================================
class TestAssignedOrder:
    @pytest.fixture(scope="class")
    def assigned_order(self, admin_token, customer, fresh_cod_order):
        # Use admin assign endpoint — the canonical staff assignment path.
        r = requests.post(
            f"{API}/admin/orders/{fresh_cod_order}/assign",
            json={"driver_id": RIDER_DRIVER_ID},
            headers=_h(admin_token),
            timeout=20,
        )
        assert r.status_code == 200, f"assign -> {r.status_code} {r.text}"
        assert r.json().get("ok") is True
        return fresh_cod_order

    def test_owner_gets_assigned_true_with_driver_info(self, customer, assigned_order):
        token, _ = customer
        r = requests.get(
            f"{API}/orders/{assigned_order}/driver-location",
            headers=_h(token),
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("assigned") is True
        drv = body.get("driver") or {}
        assert drv.get("driver_id") == RIDER_DRIVER_ID
        assert isinstance(drv.get("name"), str) and len(drv["name"]) > 0
        assert isinstance(drv.get("phone"), str) and len(drv["phone"]) > 0
        # 'vehicle' is the contract field returned by the API (vehicle_number or vehicle_type)
        assert "vehicle" in drv

    def test_location_field_shape(self, customer, assigned_order):
        """When assigned, the location key must be present.  lat/lng may be None
        if the rider has not pinged yet — that is acceptable per spec."""
        token, _ = customer
        r = requests.get(
            f"{API}/orders/{assigned_order}/driver-location",
            headers=_h(token),
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "location" in body, "location key must always exist on assigned=True"
        loc = body["location"]
        # If lat/lng present, they must be numbers
        if loc.get("lat") is not None:
            assert isinstance(loc["lat"], (int, float))
        if loc.get("lng") is not None:
            assert isinstance(loc["lng"], (int, float))

    def test_location_updates_when_rider_pings(self, customer, assigned_order):
        """Rider posts a location → customer endpoint should reflect it."""
        rider_token = _login(RIDER_EMAIL, RIDER_PASS)["token"]
        lat, lng = 32.34, 75.55
        rr = requests.post(
            f"{API}/rider/location",
            json={"lat": lat, "lng": lng},
            headers=_h(rider_token),
            timeout=20,
        )
        assert rr.status_code == 200, rr.text

        token, _ = customer
        r = requests.get(
            f"{API}/orders/{assigned_order}/driver-location",
            headers=_h(token),
            timeout=20,
        )
        assert r.status_code == 200, r.text
        loc = (r.json().get("location") or {})
        assert loc.get("lat") == pytest.approx(lat, abs=1e-6)
        assert loc.get("lng") == pytest.approx(lng, abs=1e-6)
        assert loc.get("updated_at") is not None
