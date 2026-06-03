# Dwaarit Grocery Delivery App — PRD

## Problem Statement
Dwaarit is a cross-platform (Expo/React Native) grocery delivery app with:
- Customer flow: Auth (email/Google), Home/Browse/Cart/Checkout, Order tracking, Wallet, Profile
- Admin flow: Dashboard KPIs, Live Orders management, Products CRUD, Users, Tickets, Wallet ops, Security audit

## Architecture
- **Frontend**: Expo Router (React Native), Zustand state, expo-image
- **Backend**: FastAPI, Motor (async MongoDB)
- **DB**: MongoDB
- **Auth**: JWT + Google OAuth (Emergent Managed)
- **Payments**: Razorpay (MOCK mode)

## Key DB Schema
- `products`: {category, name, price, stock, mrp, selling_price, self_price}
- `orders`: {user_id, items[{..., selling_price, self_price, mrp}], status, total, payable, coupon_code, discount_amount}

## What's Implemented

### Phase 1-3 (Core)
- Auth: email/password + Google sign-in, JWT tokens, role-based routing
- Home: categories, product grid, search, product detail
- Cart: zustand store, qty stepper, subtotal uses selling_price??price
- Checkout: COD + Wallet + Razorpay (mock), address selection
- Orders: list, detail, status timeline, invoice PDF download
- Wallet: balance, top-up (mock Razorpay), transactions
- Profile: edit name/mobile (OTP), wallet, saved addresses

### Phase 4-8 (Advanced)
- Admin Dashboard: KPIs (revenue today/week/lifetime), 7-day chart, top products, order status breakdown
  - **NEW (2026-06)**: Profit Analytics section — Today/Weekly/Monthly/Lifetime profit, Top Profitable Products, Profit by Category
- Admin Orders: live order management, status advance/cancel, pulse animation for pending
  - **NEW (2026-06)**: Per-order pricing breakdown (Selling Price, MRP, Self Price) + Order Profit highlight for delivered orders
- Admin Products: full CRUD
- Admin Users: role management
- Admin Tickets: customer support
- Admin Security: audit logs, login history (super_admin only)
- Rider tracking: driver assignment, live location polling
- Coupon/promo codes
- Push notifications (via Emergent)
- Brute-force lockout (5 fails/15min → HTTP 429)

### Pricing Audit (2026-06)
- All price display uses `selling_price ?? price` formula globally
- cart.tsx, cartStore.ts, ProductCard.tsx all updated

### Profile (2026-06)
- Wishlist removed completely from profile screen
- Edit profile has explicit back button (headerShown: true)

## Test Credentials
- Admin (Super): admin@dwaarit.com / Admin@123
- Customer: demo@dwaarit.com / Demo@123
- Rider: rider@dwaarit.com / Rider@123

## Mocked Integrations
- Razorpay (mock test mode — no real money)

### Phase 9 (2026-06)
- **In-app Chat (Customer ↔ Rider/Admin)**: `GET/POST /api/orders/{id}/chat` with full auth guard (owner + admin + assigned driver). Polling every 5s, bubble UI with timestamps at `/order/[id]/chat`.
- **Delivery OTP**: Auto-generated 4-digit OTP when order moves to `out_for_delivery`. Customer sees it prominently. Admin must enter OTP in a modal to mark as delivered. Backend validates before status change.
- Phase 9: Scheduled Deliveries (P1)
- Phase 9: In-app chat customer ↔ rider (P1)
- Phase 9: Multi-language support (P2)
- Live Razorpay keys (P2)
