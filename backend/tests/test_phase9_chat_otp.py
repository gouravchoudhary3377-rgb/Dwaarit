"""
Phase 9 Backend Tests: Order Chat & Delivery OTP
Tests:
- POST /api/orders/{id}/chat - send message
- GET /api/orders/{id}/chat - get messages
- Chat auth: order owner, admin, other user (403)
- Chat blocked for delivered/cancelled orders
- OTP auto-generated when status → out_for_delivery
- Delivered WITHOUT OTP → 400
- Delivered WITH wrong OTP → 400
- Delivered WITH correct OTP → 200
"""
import os
import pytest
import requests
import time

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")


@pytest.fixture(scope="module")
def admin_token():
    """Login as admin and return token"""
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@dwaarit.com",
        "password": "Admin@123"
    })
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def customer_token():
    """Login as demo customer and return token"""
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "demo@dwaarit.com",
        "password": "Demo@123"
    })
    assert r.status_code == 200, f"Customer login failed: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def other_token():
    """Register a 2nd customer for auth tests"""
    import uuid
    email = f"testother_{uuid.uuid4().hex[:6]}@dwaarit.com"
    r = requests.post(f"{BASE_URL}/api/auth/signup", json={
        "email": email,
        "password": "Test@12345",
        "name": "TEST_Other User"
    })
    if r.status_code == 200:
        return r.json()["token"]
    # Already exists fallback — just use a random new one
    pytest.skip("Could not create other user")


@pytest.fixture(scope="module")
def test_order(customer_token, admin_token):
    """
    Create a test COD order as customer.
    Returns order_id.
    Cleanup happens at module teardown.
    """
    # Get products
    r = requests.get(f"{BASE_URL}/api/products", headers={"Authorization": f"Bearer {customer_token}"})
    assert r.status_code == 200, f"Get products failed: {r.text}"
    products = r.json()
    assert len(products) > 0, "No products available"

    # Pick first product
    prod = products[0]

    r = requests.post(f"{BASE_URL}/api/orders", json={
        "items": [{"product_id": prod["product_id"], "quantity": 1}],
        "address": {
            "label": "home",
            "full_name": "TEST_Chat OTP User",
            "phone": "9000000001",
            "line1": "123 Test Street",
            "city": "Pathankot",
            "pincode": "145001",
            "state": "Punjab"
        },
        "payment_method": "cod",
        "notes": "TEST_phase9_chat_otp"
    }, headers={"Authorization": f"Bearer {customer_token}"})
    assert r.status_code == 200, f"Order creation failed: {r.text}"
    order = r.json()
    order_id = order["order_id"]
    yield order_id

    # Cleanup: cancel the order if not delivered
    try:
        o = requests.get(f"{BASE_URL}/api/orders/{order_id}", headers={"Authorization": f"Bearer {customer_token}"})
        if o.status_code == 200 and o.json().get("status") not in ("cancelled", "delivered"):
            requests.patch(f"{BASE_URL}/api/admin/orders/{order_id}/status",
                           json={"status": "cancelled"},
                           headers={"Authorization": f"Bearer {admin_token}"})
    except Exception:
        pass


class TestChatEndpoints:
    """Tests for GET and POST /api/orders/{id}/chat"""

    def test_customer_get_empty_chat(self, customer_token, test_order):
        """GET /orders/{id}/chat returns empty list for new order"""
        r = requests.get(
            f"{BASE_URL}/api/orders/{test_order}/chat",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert isinstance(data, list), "Expected list response"
        print(f"✅ GET chat returns list (len={len(data)})")

    def test_admin_send_message(self, admin_token, test_order):
        """Admin can POST a message to order chat"""
        r = requests.post(
            f"{BASE_URL}/api/orders/{test_order}/chat",
            json={"content": "Hello from admin - TEST message"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        msg = r.json()
        assert "message_id" in msg, "Response must have message_id"
        assert msg["order_id"] == test_order
        assert msg["content"] == "Hello from admin - TEST message"
        assert msg["sender_role"] in ("admin", "super_admin", "store_manager")
        print(f"✅ Admin POST chat message: {msg['message_id']}")

    def test_customer_send_message(self, customer_token, test_order):
        """Customer can POST a message to their order chat"""
        r = requests.post(
            f"{BASE_URL}/api/orders/{test_order}/chat",
            json={"content": "Hi rider - TEST from customer"},
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        msg = r.json()
        assert "message_id" in msg
        assert msg["order_id"] == test_order
        assert msg["content"] == "Hi rider - TEST from customer"
        assert msg["sender_role"] == "customer"
        print(f"✅ Customer POST chat message: {msg['message_id']}")

    def test_get_chat_returns_messages(self, customer_token, test_order):
        """GET /orders/{id}/chat returns list with sent messages"""
        r = requests.get(
            f"{BASE_URL}/api/orders/{test_order}/chat",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert r.status_code == 200
        msgs = r.json()
        assert isinstance(msgs, list)
        assert len(msgs) >= 2, f"Expected at least 2 messages, got {len(msgs)}"
        # Check structure of first message
        m = msgs[0]
        for field in ("message_id", "order_id", "sender_id", "sender_name", "sender_role", "content", "created_at"):
            assert field in m, f"Missing field '{field}' in chat message"
        print(f"✅ GET chat returns {len(msgs)} messages with correct structure")

    def test_admin_can_get_any_order_chat(self, admin_token, test_order):
        """Admin can GET chat for any order"""
        r = requests.get(
            f"{BASE_URL}/api/orders/{test_order}/chat",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert r.status_code == 200
        print(f"✅ Admin can GET chat for any order")

    def test_other_user_cannot_get_chat(self, other_token, test_order):
        """Unrelated user gets 403 on GET chat"""
        r = requests.get(
            f"{BASE_URL}/api/orders/{test_order}/chat",
            headers={"Authorization": f"Bearer {other_token}"}
        )
        assert r.status_code == 403, f"Expected 403 for other user, got {r.status_code}: {r.text}"
        print(f"✅ Other user gets 403 on GET chat")

    def test_other_user_cannot_post_chat(self, other_token, test_order):
        """Unrelated user gets 403 on POST chat"""
        r = requests.post(
            f"{BASE_URL}/api/orders/{test_order}/chat",
            json={"content": "Unauthorized message attempt"},
            headers={"Authorization": f"Bearer {other_token}"}
        )
        assert r.status_code == 403, f"Expected 403 for other user, got {r.status_code}: {r.text}"
        print(f"✅ Other user gets 403 on POST chat")

    def test_empty_content_rejected(self, customer_token, test_order):
        """POST with empty content should fail validation"""
        r = requests.post(
            f"{BASE_URL}/api/orders/{test_order}/chat",
            json={"content": ""},
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert r.status_code in (400, 422), f"Expected 400/422 for empty content, got {r.status_code}"
        print(f"✅ Empty content rejected with {r.status_code}")


class TestDeliveryOTP:
    """Tests for delivery OTP flow"""

    @pytest.fixture(scope="class")
    def otp_order(self, customer_token, admin_token):
        """Create a fresh order and advance to out_for_delivery to get OTP"""
        # Get products
        r = requests.get(f"{BASE_URL}/api/products", headers={"Authorization": f"Bearer {customer_token}"})
        prods = r.json()
        prod = prods[0]

        # Create order
        r = requests.post(f"{BASE_URL}/api/orders", json={
            "items": [{"product_id": prod["product_id"], "quantity": 1}],
            "address": {
                "label": "home",
                "full_name": "TEST_OTP User",
                "phone": "9000000002",
                "line1": "456 OTP Lane",
                "city": "Pathankot",
                "pincode": "145001",
                "state": "Punjab"
            },
            "payment_method": "cod",
            "notes": "TEST_phase9_otp"
        }, headers={"Authorization": f"Bearer {customer_token}"})
        assert r.status_code == 200
        order_id = r.json()["order_id"]

        yield order_id

        # Cleanup
        try:
            o = requests.get(f"{BASE_URL}/api/orders/{order_id}", headers={"Authorization": f"Bearer {customer_token}"})
            if o.status_code == 200 and o.json().get("status") not in ("cancelled", "delivered"):
                requests.patch(f"{BASE_URL}/api/admin/orders/{order_id}/status",
                               json={"status": "cancelled"},
                               headers={"Authorization": f"Bearer {admin_token}"})
        except Exception:
            pass

    def test_advance_to_accepted(self, admin_token, otp_order):
        """Admin can advance order to accepted"""
        r = requests.patch(
            f"{BASE_URL}/api/admin/orders/{otp_order}/status",
            json={"status": "accepted"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["status"] == "accepted"
        assert data.get("delivery_otp") is None, "OTP should NOT be set at accepted stage"
        print(f"✅ Order advanced to accepted, no OTP yet")

    def test_advance_to_out_for_delivery_generates_otp(self, admin_token, otp_order):
        """Advancing to out_for_delivery auto-generates a 4-digit OTP"""
        r = requests.patch(
            f"{BASE_URL}/api/admin/orders/{otp_order}/status",
            json={"status": "out_for_delivery"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["status"] == "out_for_delivery"
        otp = data.get("delivery_otp")
        assert otp is not None, "OTP should be generated when status = out_for_delivery"
        assert len(str(otp)) == 4, f"OTP must be 4 digits, got: {otp}"
        assert str(otp).isdigit(), f"OTP must be numeric, got: {otp}"
        print(f"✅ OTP generated: {otp}")

    def test_customer_can_see_otp(self, customer_token, admin_token, otp_order):
        """Customer can see the delivery_otp in their order detail"""
        r = requests.get(
            f"{BASE_URL}/api/orders/{otp_order}",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert r.status_code == 200
        order = r.json()
        assert order["status"] == "out_for_delivery"
        otp = order.get("delivery_otp")
        assert otp is not None, "Customer must see delivery_otp on their order"
        assert len(str(otp)) == 4
        print(f"✅ Customer sees OTP: {otp}")

    def test_deliver_without_otp_returns_400(self, admin_token, otp_order):
        """Attempting to deliver without OTP returns 400"""
        r = requests.patch(
            f"{BASE_URL}/api/admin/orders/{otp_order}/status",
            json={"status": "delivered"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert r.status_code == 400, f"Expected 400 (no OTP), got {r.status_code}: {r.text}"
        detail = r.json().get("detail", "")
        assert "otp" in detail.lower() or "required" in detail.lower(), f"Error should mention OTP: {detail}"
        print(f"✅ No-OTP delivery rejected: {detail}")

    def test_deliver_with_wrong_otp_returns_400(self, admin_token, customer_token, otp_order):
        """Attempting to deliver with wrong OTP returns 400"""
        # Get correct OTP first
        r = requests.get(
            f"{BASE_URL}/api/orders/{otp_order}",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        correct_otp = r.json().get("delivery_otp")
        # Use a definitely wrong OTP
        wrong_otp = "0000" if correct_otp != "0000" else "1111"

        r = requests.patch(
            f"{BASE_URL}/api/admin/orders/{otp_order}/status",
            json={"status": "delivered", "otp": wrong_otp},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert r.status_code == 400, f"Expected 400 (wrong OTP), got {r.status_code}: {r.text}"
        detail = r.json().get("detail", "")
        assert "invalid" in detail.lower() or "otp" in detail.lower(), f"Error should mention OTP: {detail}"
        print(f"✅ Wrong OTP rejected: {detail}")

    def test_deliver_with_correct_otp_succeeds(self, admin_token, customer_token, otp_order):
        """Delivering with correct OTP returns 200 and status = delivered"""
        # Get the OTP
        r = requests.get(
            f"{BASE_URL}/api/orders/{otp_order}",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert r.status_code == 200
        correct_otp = r.json().get("delivery_otp")
        assert correct_otp, "OTP must be present"

        # Now deliver with correct OTP
        r = requests.patch(
            f"{BASE_URL}/api/admin/orders/{otp_order}/status",
            json={"status": "delivered", "otp": correct_otp},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert r.status_code == 200, f"Expected 200 with correct OTP, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["status"] == "delivered", f"Status should be delivered, got: {data['status']}"
        print(f"✅ Correct OTP delivery succeeded!")


class TestChatBlockedForClosedOrders:
    """Chat should be blocked for delivered/cancelled orders"""

    def test_chat_blocked_for_delivered_order(self, admin_token, customer_token):
        """POST chat on delivered order returns 400"""
        # We need to find/create a delivered order
        r = requests.get(
            f"{BASE_URL}/api/admin/orders",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert r.status_code == 200
        orders = r.json()
        delivered_orders = [o for o in orders if o["status"] == "delivered"]

        if not delivered_orders:
            pytest.skip("No delivered orders available to test chat blocking")

        order_id = delivered_orders[0]["order_id"]
        r = requests.post(
            f"{BASE_URL}/api/orders/{order_id}/chat",
            json={"content": "TEST message on delivered order"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert r.status_code == 400, f"Expected 400 for chat on delivered order, got {r.status_code}: {r.text}"
        detail = r.json().get("detail", "")
        assert "active" in detail.lower() or "delivered" in detail.lower() or "blocked" in detail.lower() or "only" in detail.lower()
        print(f"✅ Chat blocked for delivered order: {detail}")

    def test_chat_blocked_for_cancelled_order(self, admin_token, customer_token):
        """POST chat on cancelled order returns 400"""
        # Get a cancelled order or create one
        r = requests.get(
            f"{BASE_URL}/api/admin/orders",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        orders = r.json()
        cancelled_orders = [o for o in orders if o["status"] == "cancelled"]

        if not cancelled_orders:
            pytest.skip("No cancelled orders available to test chat blocking")

        order_id = cancelled_orders[0]["order_id"]
        # Try as admin since admin is allowed auth-wise but blocked by status
        r = requests.post(
            f"{BASE_URL}/api/orders/{order_id}/chat",
            json={"content": "TEST message on cancelled order"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert r.status_code == 400, f"Expected 400 for chat on cancelled order, got {r.status_code}: {r.text}"
        print(f"✅ Chat blocked for cancelled order")
