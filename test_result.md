#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Dwaarit cross-platform grocery delivery app. Customer + admin flows.
  Auth (email/password + Google), Home/Categories/Search, Cart, Checkout (COD),
  Order detail tracking, Admin product CRUD + order status updates.

backend:
  - task: "Auth (login/register/me) + role redirection support"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Re-verify endpoints still healthy."
  - task: "Products list with category filter + categories endpoint"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Product Detail screen now consumes /products?category=... for related items."
  - task: "Orders create + list + by-id + admin orders + status update"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Order detail screen consumes GET /api/orders/{order_id}. Verify."

frontend:
  - task: "Route guards: customers->tabs, admins->admin, unauth->login"
    implemented: true
    working: "NA"
    file: "frontend/app/(tabs)/_layout.tsx, frontend/app/admin/_layout.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Guards present using useAuth(); ensure no redirect loops."
  - task: "Product Detail screen polish (in-cart awareness, stock badge, toast, related)"
    implemented: true
    working: "NA"
    file: "frontend/app/product/[id].tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Rewrote with stock badge, in-cart chip, animated toast, horizontal related products, qty clamped to stock."
  - task: "Customer order detail screen with status timeline"
    implemented: true
    working: "NA"
    file: "frontend/app/order/[id].tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Pressable rows from orders list and Track from order-success route to this screen."
  - task: "Cart + Checkout (COD) flow"
    implemented: true
    working: "NA"
    file: "frontend/app/(tabs)/cart.tsx, frontend/app/checkout.tsx, frontend/app/order-success.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Verify subtotal, address entry, COD place order, success screen, track CTA."
  - task: "Admin: product CRUD + order status update"
    implemented: true
    working: "NA"
    file: "frontend/app/admin/products.tsx, frontend/app/admin/orders.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Verify add/edit/delete product and changing order status reflects on customer side."
  - task: "Address Book + Location screen (GPS + Nominatim search + Save)"
    implemented: true
    working: "NA"
    file: "frontend/app/location.tsx, frontend/src/store/addressStore.ts, frontend/src/utils/geocoding.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "New address book using expo-location + OpenStreetMap Nominatim. Stores addresses via Zustand+AsyncStorage. Verify GPS auto-detect, search results, label selection (Home/Work/Other), save and that the active address propagates."
  - task: "Home header active-address chip (Blinkit-style 'Home — 5-min delivery')"
    implemented: true
    working: "NA"
    file: "frontend/app/(tabs)/home.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Header chip reads activeAddress from store. Tapping should route to /location. If no address saved, chip should prompt to set delivery address."
  - task: "Checkout selectable saved-address list (replaces auto-fill form)"
    implemented: true
    working: "NA"
    file: "frontend/app/checkout.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Customer can pick from saved addresses; selected address is submitted to backend AddressIn schema {full_name, phone, line1, line2, city, state, pincode}. Also verify 'Add new address' CTA navigates to /location."

  - task: "Profile tab routing (Edit / Wallet / Wishlist)"
    implemented: true
    working: "NA"
    file: "frontend/app/(tabs)/profile.tsx, frontend/app/profile/edit.tsx, frontend/app/profile/wallet.tsx, frontend/app/profile/wishlist.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Profile screen has new MenuRow CTAs that route to /profile/edit, /profile/wallet, /profile/wishlist. Verify routing works without crashing and balance + wishlist counts render."
  - task: "Orders tab Reorder + Track CTAs"
    implemented: true
    working: "NA"
    file: "frontend/app/(tabs)/orders.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Each order card now exposes Reorder (hydrates cart) + Track order CTA when status is pending/accepted/out_for_delivery. Verify CTA renders and Reorder navigates to /cart with items prefilled."

metadata:
  created_by: "main_agent"
  version: "1.3"
  test_sequence: 3
  run_ui: true

test_plan:
  current_focus:
    - "Phase 8.6 backend: Audit log write-side (auth.login/logout/register, password.change, role.change)"
    - "Phase 8.6 backend: Login history records (success + failure) + brute-force lockout (429 after 5 fails/15min)"
    - "Phase 8.6 backend: GET /api/admin/audit-logs, /api/admin/login-history, /api/admin/security/summary — super_admin only (admin = 403)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

phase_8_6_backend:
  - task: "Audit log write-side — auth.login/logout/register + password.change + role.change events"
    implemented: true
    working: true
    file: "backend/audit.py, backend/routes/auth.py, backend/routes/admin.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Initial: write-side wired up across signup/login/logout/role-change."
      - working: false
        agent: "testing"
        comment: "iteration_16: failed login did NOT write audit_logs (only login_history). Role-change did NOT write audit_logs."
      - working: true
        agent: "testing"
        comment: "iteration_17 retest 11/11 PASS: failed login (bad_password + not_found) writes audit_logs status='failure'. PATCH /api/admin/users/{id}/role writes audit_logs action='role.change' with previous_role/new_role in details."

  - task: "Login history + brute-force lockout (5 fails/15min => HTTP 429)"
    implemented: true
    working: true
    file: "backend/routes/auth.py, backend/audit.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "iteration_16: login_history success+failure docs, lockout fires HTTP 429 after 5 failures in 15min. PASSED."

  - task: "Super-admin audit + login-history viewer endpoints"
    implemented: true
    working: true
    file: "backend/routes/admin.py, backend/security.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: false
        agent: "testing"
        comment: "iteration_16: require_super_admin was honouring legacy 'admin' alias, so a role='admin' user incorrectly got 200 on viewer endpoints."
      - working: true
        agent: "testing"
        comment: "iteration_17 retest: require_super_admin now strict — role='admin' gets 403 on /api/admin/audit-logs, /api/admin/login-history, /api/admin/security/summary. super_admin gets 200. PATCH /api/admin/users/{id}/role also now require_super_admin (admin→403)."

phase_8_5_backend:
  - task: "GET /api/orders/{order_id}/driver-location — assigned flag + authZ matrix"
    implemented: true
    working: "NA"
    file: "backend/routes/orders.py, backend/routes/drivers.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Endpoint should return assigned=false when no driver_id on the order. Once a rider accepts (driver_id set), should return assigned=true with driver{name,phone,vehicle_type} + location{lat,lng,updated_at} when driver location available. AuthZ matrix: owner=200, unauth=401, other-customer=403, admin/super_admin/store_manager=200."

phase_8_5_frontend:
  - task: "Customer Track screen — 'Finding a rider…' fallback + live driver polling"
    implemented: true
    working: "NA"
    file: "frontend/app/order/[id]/track.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "track.tsx now polls /api/orders/{id}/driver-location every 5s while order is in non-terminal status. When assigned=false → shows 'Finding a rider for you…' card, Call button disabled. When assigned=true → renders real driver name/phone/vehicle and Call button calls Linking.openURL('tel:'+phone). When location lat/lng arrive → injectJavaScript triggers window.setLiveDriver(lat,lng) in Leaflet WebView. Polling stops for delivered/cancelled."

backend:
  - task: "Invoice endpoint /api/orders/{order_id}/invoice"
    implemented: true
    working: true
    file: "backend/routes/orders.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Returns invoice_no, items, subtotal/delivery_fee/wallet_applied/payable, payment_method/status. Verify auth-gated (user can only fetch own, admin can fetch any)."
      - working: true
        agent: "testing"
        comment: "PASS (Phase 4). All required fields present (invoice_no, items, subtotal, delivery_fee, wallet_applied, payable, payment_method, payment_status, address, customer). invoice_no prefixed 'INV-'. AuthZ verified: owner=200, unauth=401, OTHER customer=403, admin=200. Covered by tests/test_phase34_wallet_payments_invoice.py::TestOrderDetailAndInvoice (6/6 pass)."
  - task: "Wallet top-up + Razorpay mock verification"
    implemented: true
    working: true
    file: "backend/routes/wallet.py, backend/routes/payments.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Razorpay keys are empty so endpoints should run in mock-mode. Verify /api/payments/order returns a (mock) order, /api/wallet/razorpay/verify credits wallet, /api/wallet returns updated balance + txns."
      - working: true
        agent: "testing"
        comment: "PASS (Phase 3). Note: actual route is POST /api/payments/razorpay/create-order (not /api/payments/order). GET /api/payments/config correctly reports razorpay_enabled=false + empty key_id. create-order returns mode='mock', order_id prefixed 'order_mock_', amount in paise. POST /api/wallet/razorpay/verify with fake payment_id/signature credits the wallet (balance goes up by amount, type='topup' txn added). Idempotency verified: re-posting same payment_id returns duplicate=true and does NOT double-credit. 4/4 tests pass."
  - task: "Checkout — wallet apply + payment method handling"
    implemented: true
    working: true
    file: "backend/routes/orders.py, backend/routes/payments.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "POST /api/orders supports payment_method=cod|wallet|razorpay and wallet_applied amount. Razorpay flow in mock-mode should mark payment_status=paid."
      - working: true
        agent: "testing"
        comment: "PASS (Phase 3). All three payment paths exercised end-to-end: (a) payment_method='wallet' with use_wallet=true -> wallet_applied>0, debit txn appears, balance reduced; payment_status='paid' when fully covered. (b) payment_method='razorpay' -> creates order pending, /payments/razorpay/create-order + /payments/razorpay/verify (mock signature) flips payment_status to 'paid' and persists razorpay_payment_id. (c) payment_method='cod' -> payment_status='cod', wallet_applied=0, payable==total. Admin PATCH /api/admin/orders/{id}/status to 'cancelled' on a fully-wallet-paid order generates a 'refund' wallet_txn and restores balance. Customer cannot call admin endpoint (403). GAP noted (non-blocking): if a wallet order ends with payment_status='pending' (partial wallet only), cancellation does NOT refund the wallet_applied portion because backend gate is payment_status in ('paid','cod'). Flag for E1 product review. Covered by TestOrdersWithPayments + TestAdminCancelRefund (5/5 pass)."

frontend:
  - task: "Phase 4: Order Detail — payment breakdown + Download Invoice PDF"
    implemented: true
    working: "partial"
    file: "frontend/app/order/[id].tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added expo-print + expo-sharing. CTA 'Download invoice' fetches /orders/{id}/invoice and renders HTML to PDF. On web it triggers print dialog. Payment summary shows subtotal/delivery/wallet/payable + payment method pill."
      - working: "partial"
        agent: "testing"
        comment: "Verified on web preview against three real orders (razorpay PAID, wallet-only PAID, COD). PASS: Subtotal/Delivery/Wallet applied/Payable/Total all render with correct math; Payment method pill renders 'Razorpay' / 'Wallet' / 'Cash on Delivery'; Payment status pill renders 'PAID' / 'PAID' / 'COD'; Download invoice CTA and Track live on map CTA both present (Track live correctly hidden on cancelled orders). FAIL #1 (HIGH): Status timeline highlights ALL FOUR steps (Order placed, Accepted, Out for delivery, Delivered) with filled orange check icons even when order.status='pending'. Should only highlight steps at/before the current status. Reproduced on ord_c5ecdd32f7e8 (status=pending). FAIL #2 (LOW): For orders with wallet_applied=0 the summary label is 'Total ₹X', for orders with wallet_applied>0 it switches to 'Payable ₹X'. Spec asks for 'Payable' on every order. Download invoice CTA functionality itself was not exercised because both Razorpay paths are blocked upstream by the WebView issue (see Wallet/Checkout tasks), but the CTA renders and is tappable."
  - task: "Phase 3: Wallet screen — top-up + transactions"
    implemented: true
    working: false
    file: "frontend/app/profile/wallet.tsx"
    stuck_count: 1
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Top-up should trigger Razorpay mock flow and update balance + show new credit txn. Empty-state acceptable for fresh users."
      - working: false
        agent: "testing"
        comment: "CRITICAL BLOCKER on web preview. Modal opens correctly, chips ₹200/₹500/₹1000/₹2000 render, 'Pay ₹X' CTA fires POST /api/payments/razorpay/create-order successfully (200, mode=mock). BUT the embedded RazorpayCheckout WebView renders the literal red error string 'React Native WebView does not support this platform.' so there is NO Simulate success / Simulate failure button to click on web. Result: /api/wallet/razorpay/verify is never called from the UI, wallet balance is never credited via this path on web preview. Backend is fine — the failure is purely the missing web fallback in /app/frontend/src/components/RazorpayCheckout.tsx (react-native-webview ships an empty web shim). Fix is platform-split: on Platform.OS==='web', replace WebView with a plain RN View that exposes the same Simulate success/failure CTAs and posts to the same callbacks. NOTE: balance + transactions list itself renders correctly (saw ₹2,500 balance and full txn history including prior 'Wallet top-up via Razorpay' rows that must have been created on native earlier)."
  - task: "Phase 3: Checkout — Razorpay/Wallet/COD selection"
    implemented: true
    working: false
    file: "frontend/app/checkout.tsx"
    stuck_count: 1
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Verify wallet-apply toggle reduces payable, Razorpay mock places order with payment_status=paid, COD still works as fallback."
      - working: false
        agent: "testing"
        comment: "MIXED on web preview. PASS: Checkout screen renders the new Phase 3 layout (Items total / Delivery / To pay), all 3 payment options visible (Cash on Delivery, UPI/Cards/Netbanking, Dwaarit Wallet with balance pill), 'Use wallet balance' switch with 'Apply ₹X from wallet' helper text. COD path WORKS end-to-end (order placed, lands on order detail). CRITICAL BLOCKER (same root cause as Wallet task): selecting 'UPI / Cards / Netbanking' and tapping 'Pay & place order' opens the Razorpay mock WebView which on web only prints 'React Native WebView does not support this platform.' → no way to Simulate success → order stays pending forever / never gets payment_status=paid on web preview. ADDITIONAL FRONTEND BUG (CRITICAL, separate root cause): app/_layout.tsx never mounts the AddressAuthSync component (src/components/AddressAuthSync.tsx exists but is dead code), so useAddressStore.setAuthToken is never called → /api/addresses GET never runs on login → user always sees 'No saved addresses yet' on /checkout even when the backend has saved addresses. I worked around it by using the /location → 'Enter manually' flow which writes to the local store, but a real user opening a fresh device will be unable to check out without re-adding their address. Also saw one suspicious incident where tapping the 'Use wallet balance' switch appeared to also fire 'Place order' on the same gesture (placed a COD order without explicit tap) — couldn't reproduce 100%, flagged as MEDIUM."

agent_communication:
  - agent: "main"
    message: "Rider Assignment feature implemented. (1) Backend (drivers.py): Updated POST /api/admin/orders/{id}/assign to return full order doc and generate delivery_otp when assigning. (2) Frontend (admin/orders.tsx): Added 'Assign Rider' button on accepted order cards. Opens a bottom-sheet modal fetching approved drivers from /api/admin/drivers?status=approved. Shows rider name/phone/vehicle/online status. On tap assigns the rider, advances order to out_for_delivery, and generates OTP. Please test: accept an order, see 'Assign Rider' button appear, tap it, select a driver, verify order moves to out_for_delivery with driver info attached. Credentials: admin@dwaarit.com/Admin@123, demo@dwaarit.com/Demo@123. Rider: rider@dwaarit.com/Rider@123."
  - agent: "testing"
    message: "Phase 3 + Phase 4 FRONTEND validation on web preview (http://localhost:3000) — MIXED results. PASS: Login (demo@dwaarit.com), Home + add-to-cart, /checkout new Phase 3 layout, COD path end-to-end (places order), /order/{id} renders Subtotal/Delivery/Wallet applied/Payable/Total with correct math + 'Razorpay'/'Wallet'/'Cash on Delivery' method pills + 'PAID'/'PAID'/'COD' status pills + Download invoice CTA + Track live on map CTA on live orders. FAIL — 3 frontend bugs, none of them backend: (1) CRITICAL — src/components/RazorpayCheckout.tsx uses react-native-webview which has no web shim, so BOTH the wallet top-up Razorpay flow and the checkout Razorpay flow dead-end on a screen that literally says 'React Native WebView does not support this platform.' — there is no Simulate success button reachable on web preview, so neither /api/wallet/razorpay/verify nor /api/orders/{id}/payment/verify is ever called from the UI. Fix is a Platform.OS==='web' branch in RazorpayCheckout.tsx that renders Simulate success/failure as plain Pressables (or an iframe wrapping the same HTML). (2) CRITICAL — app/_layout.tsx never mounts <AddressAuthSync /> (the component exists at src/components/AddressAuthSync.tsx but is dead code), so useAddressStore.setAuthToken is never called on login → /api/addresses GET never fires → /checkout shows 'No saved addresses yet' even for users who already have backend-stored addresses. Verified via network panel: 0 hits on /api/addresses across the entire session. Fix: import + mount AddressAuthSync inside the RootLayout tree. (3) HIGH — app/order/[id].tsx status timeline renders all 4 steps (placed/accepted/out-for-delivery/delivered) with filled orange check icons even when status='pending'. Should gate by current step index. Minor #1: order screen shows 'Total' instead of 'Payable' when wallet_applied=0 (spec asks Payable on every order). Minor #2: tapping the 'Use wallet balance' Switch on /checkout once also fired the underlying 'Place order' button on the same gesture (placed an unintended COD order). Full report: /app/test_reports/iteration_10.json. NO frontend code was modified per instructions — diagnose-only run."


  - agent: "main"
    message: "Restarted Expo. Polished Product Detail screen. Please run full backend + frontend E2E (customer + admin). Credentials in /app/memory/test_credentials.md (admin@dwaarit.com / Admin@123). Customer can register a fresh account."
  - agent: "main"
    message: "P0 frontend validation: please test the new Address Book wiring end-to-end. Login as demo@dwaarit.com / Demo@123."
  - agent: "main"
    message: "Phase 2 UI validation needed. Login as demo@dwaarit.com / Demo@123. (1) Profile tab → tap the pencil icon → verify /profile/edit opens without crash and lets user update name/mobile. (2) Profile tab → tap 'Wallet' row → verify /profile/wallet opens and lists balance + recent transactions (empty state acceptable). (3) Profile tab → tap 'Wishlist' row → verify /profile/wishlist opens (empty state acceptable). (4) Orders tab → for any visible order verify 'Reorder' and 'Track order' buttons render and Reorder navigates to cart. SKIP backend retesting."
  - agent: "main"
    message: "Phase 8.5 IMPLEMENTED (Customer-facing Rider Card + Live Assignment). /app/frontend/app/order/[id]/track.tsx now polls GET /api/orders/{id}/driver-location every 5s while order is in non-terminal status (pending/accepted/out_for_delivery). UI: when assigned=false shows 'Finding a rider for you…' card + greys out the call button + Alert on press. When assigned=true shows real driver name/vehicle/phone and the Call button dials the real number (Linking.openURL tel:). When location lat/lng arrive, injectJavaScript invokes window.setLiveDriver(lat,lng) in the Leaflet WebView which switches the marker to liveMode and follows real coords (simulation paused). Polling stops for delivered/cancelled. Please test: (a) login demo@dwaarit.com/Demo@123 → place a COD order → open /order/{id}/track → assert 'Finding a rider...' card renders + call button disabled state. (b) login rider@dwaarit.com/Rider@123 → accept the order via rider app → switch back to customer track screen and assert driver name/phone appear within 5-10s and Call button is enabled. (c) Backend: GET /api/orders/{id}/driver-location returns assigned=false when no driver, and assigned=true with driver{name,phone,vehicle}+location after assignment. AuthZ: only the order owner OR staff (admin/super_admin/store_manager) can hit this endpoint. Other customers must get 403."
  - agent: "testing"
    message: "Phase 3 + Phase 4 BACKEND validation COMPLETE — 19/19 new tests pass, full suite 50/50. New file: backend/tests/test_phase34_wallet_payments_invoke.py (Wallet baseline, Razorpay-mock create-order + verify + idempotency, wallet/razorpay/cod order placement, order list/detail, invoice schema + authZ matrix [owner/unauth/other-user/admin], admin cancel -> wallet refund). KEY FINDINGS: (1) Actual top-up route is POST /api/payments/razorpay/create-order (NOT /api/payments/order as in the request) — request body is {amount, order_id?}. (2) Mock-mode confirmed: GET /api/payments/config returns razorpay_enabled=false, create-order returns mode='mock' + order_id prefixed 'order_mock_'. (3) Wallet verify is correctly idempotent (re-posting same payment_id returns duplicate=true, no double-credit). (4) Razorpay mock flow flips order.payment_status to 'paid' and persists razorpay_payment_id. (5) Invoice authZ matrix is fully correct: owner=200, unauth=401, other-customer=403, admin=200. (6) Admin cancel on a fully-wallet-paid order generates a 'refund' wallet_txn. NON-BLOCKING BUSINESS-LOGIC GAP TO REVIEW WITH PRODUCT: cancelling a partial-wallet order (payment_status='pending', wallet_applied>0) does NOT refund the wallet_applied portion because the refund gate in routes/orders.py is payment_status in ('paid','cod'). Consider refunding wallet_applied regardless of remaining payable. ALSO FIXED: stale assertion in tests/test_dwaarit_api.py::test_customer_create_order (was asserting order.total == subtotal but Phase 3 added a ₹25 flat delivery fee for orders <₹499); updated assertion to include expected_delivery. No backend code changes were required."
