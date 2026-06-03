"""Phase: Rider Assignment — backend API tests.

Tests:
  • GET /api/admin/drivers?status=approved — returns only approved riders (modal feed)
  • POST /api/admin/orders/{id}/assign with valid driver_id:
    - Advances order to out_for_delivery
    - Sets driver_name / driver_phone / driver_vehicle
    - Generates delivery_otp (4-digit numeric string)
    - Returns full order document
  • POST /api/admin/orders/{id}/assign with unapproved driver → 400
  • POST /api/admin/orders/{id}/assign with non-existent driver → 404
  • POST /api/admin/orders/{id}/assign without auth → 401/403
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://order-analytics-26.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "admin@dwaarit.com"
ADMIN_PASSWORD = "Admin@123"
CUSTOMER_EMAIL = "demo@dwaarit.com"
CUSTOMER_PASSWORD = "Demo@123"


# ─────────────── Fixtures ───────────────────────────────────────────────────

@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(api_client):
    r = api_client.post(f"{BASE_URL}/api/auth/login",
                        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token") or data.get("access_token")
    assert token, f"No token: {data}"
    return token


@pytest.fixture(scope="module")
def customer_token(api_client):
    r = api_client.post(f"{BASE_URL}/api/auth/login",
                        json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"Customer login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token") or data.get("access_token")
    assert token, f"No token: {data}"
    return token


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Content-Type": "application/json", "Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def customer_headers(customer_token):
    return {"Content-Type": "application/json", "Authorization": f"Bearer {customer_token}"}


@pytest.fixture(scope="module")
def approved_driver_id(api_client, admin_headers):
    """Dynamically resolve the first approved driver from the API."""
    r = api_client.get(f"{BASE_URL}/api/admin/drivers?status=approved",
                       headers=admin_headers, timeout=20)
    assert r.status_code == 200, f"Drivers list failed: {r.status_code}"
    drivers = r.json()
    assert len(drivers) > 0, "No approved drivers found — seed data issue"
    return drivers[0]["driver_id"]


def _get_product_id(api_client, admin_headers):
    """Return any active product_id from the catalog."""
    r = api_client.get(f"{BASE_URL}/api/products?page=1&limit=5", headers=admin_headers, timeout=20)
    assert r.status_code == 200, f"Products fetch failed: {r.status_code}"
    data = r.json()
    items = data if isinstance(data, list) else data.get("items", data.get("products", []))
    assert items, "No products found in catalog"
    return items[0]["product_id"]


@pytest.fixture(scope="module")
def accepted_order_id(api_client, admin_headers, customer_headers):
    """
    Place a COD order as the demo customer and advance it to 'accepted' as admin.
    Returns the order_id for use in assign tests.
    """
    product_id = _get_product_id(api_client, admin_headers)

    order_payload = {
        "items": [{"product_id": product_id, "quantity": 1}],
        "address": {
            "full_name": "TEST Assign Rider",
            "phone": "+919876543210",
            "line1": "123 Test Lane",
            "line2": "",
            "city": "Mumbai",
            "state": "Maharashtra",
            "pincode": "400001",
        },
        "payment_method": "cod",
    }
    r = api_client.post(f"{BASE_URL}/api/orders", json=order_payload, headers=customer_headers, timeout=30)
    assert r.status_code in (200, 201), f"Order create failed: {r.status_code} {r.text}"
    order_id = r.json().get("order_id")
    assert order_id, f"No order_id in response: {r.json()}"

    # Accept the order as admin
    r2 = api_client.patch(f"{BASE_URL}/api/admin/orders/{order_id}/status",
                          json={"status": "accepted"}, headers=admin_headers, timeout=20)
    assert r2.status_code == 200, f"Accept order failed: {r2.status_code} {r2.text}"
    assert r2.json().get("status") == "accepted"

    return order_id


# ─────────────── Tests: approved driver list (modal feed) ────────────────────

class TestApprovedDriverList:
    """GET /api/admin/drivers?status=approved — used by the Assign Rider modal."""

    def test_approved_drivers_returns_200(self, api_client, admin_headers):
        r = api_client.get(f"{BASE_URL}/api/admin/drivers?status=approved",
                           headers=admin_headers, timeout=20)
        assert r.status_code == 200, f"Expected 200, got {r.status_code} {r.text}"

    def test_approved_drivers_is_list(self, api_client, admin_headers):
        r = api_client.get(f"{BASE_URL}/api/admin/drivers?status=approved",
                           headers=admin_headers, timeout=20)
        assert isinstance(r.json(), list)

    def test_at_least_one_approved_driver_exists(self, api_client, admin_headers):
        r = api_client.get(f"{BASE_URL}/api/admin/drivers?status=approved",
                           headers=admin_headers, timeout=20)
        assert len(r.json()) > 0, "No approved drivers — modal will show empty state"

    def test_all_returned_drivers_are_approved(self, api_client, admin_headers):
        r = api_client.get(f"{BASE_URL}/api/admin/drivers?status=approved",
                           headers=admin_headers, timeout=20)
        drivers = r.json()
        for d in drivers:
            assert d.get("status") == "approved", f"Non-approved driver returned: {d}"

    def test_driver_modal_fields_present(self, api_client, admin_headers):
        """name, phone, vehicle_type are displayed in the modal rider row."""
        r = api_client.get(f"{BASE_URL}/api/admin/drivers?status=approved",
                           headers=admin_headers, timeout=20)
        for d in r.json():
            assert "name" in d, f"Missing 'name' in driver: {d}"
            assert "phone" in d, f"Missing 'phone' in driver: {d}"
            assert "vehicle_type" in d, f"Missing 'vehicle_type' in driver: {d}"

    def test_no_sensitive_fields_leaked(self, api_client, admin_headers):
        r = api_client.get(f"{BASE_URL}/api/admin/drivers?status=approved",
                           headers=admin_headers, timeout=20)
        for d in r.json():
            assert "_id" not in d
            assert "password_hash" not in d

    def test_approved_list_requires_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/admin/drivers?status=approved", timeout=15)
        assert r.status_code in (401, 403), f"Expected 401/403 without auth, got {r.status_code}"


# ─────────────── Tests: assign endpoint ──────────────────────────────────────

class TestAssignRider:
    """POST /api/admin/orders/{id}/assign — core assignment logic."""

    def test_assign_nonexistent_driver_returns_404(self, api_client, admin_headers, accepted_order_id):
        r = api_client.post(
            f"{BASE_URL}/api/admin/orders/{accepted_order_id}/assign",
            json={"driver_id": "drv_nonexistent_xxxxx"},
            headers=admin_headers, timeout=20,
        )
        assert r.status_code == 404, f"Expected 404 for bad driver_id, got {r.status_code} {r.text}"

    def test_assign_unapproved_driver_returns_400(self, api_client, admin_headers, accepted_order_id):
        """Create a temp driver, reject it, then try to assign it — must return 400."""
        uniq = uuid.uuid4().hex[:6]
        drv_payload = {
            "name": f"TEST_Unapp_{uniq}",
            "email": f"TEST_unapp_{uniq}@dwaarit.com",
            "phone": "+919111111111",
            "vehicle_type": "bike",
            "password": "Rider@123",
        }
        cr = api_client.post(f"{BASE_URL}/api/admin/drivers", json=drv_payload,
                             headers=admin_headers, timeout=20)
        assert cr.status_code in (200, 201), f"Could not create test driver: {cr.status_code} {cr.text}"
        drv_id = cr.json().get("driver_id")

        # Reject so status != 'approved'
        rej = api_client.post(f"{BASE_URL}/api/admin/drivers/{drv_id}/reject",
                              headers=admin_headers, timeout=15)
        assert rej.status_code == 200

        r = api_client.post(
            f"{BASE_URL}/api/admin/orders/{accepted_order_id}/assign",
            json={"driver_id": drv_id},
            headers=admin_headers, timeout=20,
        )
        # Cleanup first
        api_client.delete(f"{BASE_URL}/api/admin/drivers/{drv_id}", headers=admin_headers, timeout=15)
        assert r.status_code == 400, f"Expected 400 for unapproved driver, got {r.status_code} {r.text}"

    def test_assign_valid_driver_returns_200(self, api_client, admin_headers, accepted_order_id, approved_driver_id):
        r = api_client.post(
            f"{BASE_URL}/api/admin/orders/{accepted_order_id}/assign",
            json={"driver_id": approved_driver_id},
            headers=admin_headers, timeout=20,
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code} {r.text}"

    def test_assign_advances_to_out_for_delivery(self, api_client, admin_headers, accepted_order_id, approved_driver_id):
        r = api_client.post(
            f"{BASE_URL}/api/admin/orders/{accepted_order_id}/assign",
            json={"driver_id": approved_driver_id},
            headers=admin_headers, timeout=20,
        )
        assert r.status_code == 200
        doc = r.json()
        assert doc.get("status") == "out_for_delivery", \
            f"Expected out_for_delivery, got {doc.get('status')}"

    def test_assign_sets_driver_name(self, api_client, admin_headers, accepted_order_id, approved_driver_id):
        r = api_client.post(
            f"{BASE_URL}/api/admin/orders/{accepted_order_id}/assign",
            json={"driver_id": approved_driver_id},
            headers=admin_headers, timeout=20,
        )
        assert r.status_code == 200
        doc = r.json()
        assert doc.get("driver_name"), f"driver_name not set in response"

    def test_assign_sets_driver_phone(self, api_client, admin_headers, accepted_order_id, approved_driver_id):
        r = api_client.post(
            f"{BASE_URL}/api/admin/orders/{accepted_order_id}/assign",
            json={"driver_id": approved_driver_id},
            headers=admin_headers, timeout=20,
        )
        assert r.status_code == 200
        doc = r.json()
        assert doc.get("driver_phone"), f"driver_phone not set in response"

    def test_assign_sets_driver_vehicle(self, api_client, admin_headers, accepted_order_id, approved_driver_id):
        r = api_client.post(
            f"{BASE_URL}/api/admin/orders/{accepted_order_id}/assign",
            json={"driver_id": approved_driver_id},
            headers=admin_headers, timeout=20,
        )
        assert r.status_code == 200
        doc = r.json()
        assert doc.get("driver_vehicle"), f"driver_vehicle not set in response"

    def test_assign_generates_delivery_otp(self, api_client, admin_headers, accepted_order_id, approved_driver_id):
        r = api_client.post(
            f"{BASE_URL}/api/admin/orders/{accepted_order_id}/assign",
            json={"driver_id": approved_driver_id},
            headers=admin_headers, timeout=20,
        )
        assert r.status_code == 200
        doc = r.json()
        otp = doc.get("delivery_otp")
        assert otp, f"delivery_otp not in response"
        assert len(str(otp)) == 4, f"OTP should be 4 digits, got: {otp}"
        assert str(otp).isdigit(), f"OTP should be numeric, got: {otp}"

    def test_assign_returns_full_order_doc(self, api_client, admin_headers, accepted_order_id, approved_driver_id):
        r = api_client.post(
            f"{BASE_URL}/api/admin/orders/{accepted_order_id}/assign",
            json={"driver_id": approved_driver_id},
            headers=admin_headers, timeout=20,
        )
        assert r.status_code == 200
        doc = r.json()
        # Standard order fields must be present
        assert doc.get("order_id") == accepted_order_id
        assert "items" in doc
        assert "total" in doc
        assert "address" in doc
        assert "_id" not in doc, "_id leaked in response"
        assert doc.get("driver_id") == approved_driver_id

    def test_assign_nonexistent_order_returns_404(self, api_client, admin_headers, approved_driver_id):
        r = api_client.post(
            f"{BASE_URL}/api/admin/orders/ord_nonexistent_xxxx/assign",
            json={"driver_id": approved_driver_id},
            headers=admin_headers, timeout=20,
        )
        assert r.status_code == 404, f"Expected 404 for bad order_id, got {r.status_code} {r.text}"

    def test_assign_requires_auth(self, api_client, accepted_order_id, approved_driver_id):
        r = api_client.post(
            f"{BASE_URL}/api/admin/orders/{accepted_order_id}/assign",
            json={"driver_id": approved_driver_id},
            timeout=20,
        )
        assert r.status_code in (401, 403), f"Expected 401/403 without auth, got {r.status_code}"
