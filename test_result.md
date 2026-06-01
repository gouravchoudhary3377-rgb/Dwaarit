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

metadata:
  created_by: "main_agent"
  version: "1.2"
  test_sequence: 2
  run_ui: true

test_plan:
  current_focus:
    - "Address Book + Location screen (GPS + Nominatim search + Save)"
    - "Home header active-address chip (Blinkit-style 'Home — 5-min delivery')"
    - "Checkout selectable saved-address list (replaces auto-fill form)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "Restarted Expo. Polished Product Detail screen. Please run full backend + frontend E2E (customer + admin). Credentials in /app/memory/test_credentials.md (admin@dwaarit.com / Admin@123). Customer can register a fresh account."
  - agent: "main"
    message: "P0 frontend validation: please test the new Address Book wiring end-to-end. Login as demo@dwaarit.com / Demo@123. (1) On Home (tabs), confirm a header chip showing the active delivery address (or a 'Set delivery address' prompt if none) and that tapping it routes to /location. (2) On /location, verify search via OpenStreetMap Nominatim returns results, that selecting a result + label (Home/Work/Other) and saving stores the address and updates the active address on Home. expo-location GPS may not work in headless web — selecting via search is the primary path. (3) Add an item to cart → go to Checkout, confirm the selectable saved-address list renders, selecting an address enables 'Place Order', and placing a COD order succeeds and routes to order-success. Also verify profile.tsx still renders with DiceBear avatar correctly. SKIP backend retesting — focus on frontend only."
