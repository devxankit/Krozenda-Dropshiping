# KROZENDA — Project Context

> **Read this file completely before writing any code.**
> This is the single source of truth for scope, architecture, and phasing.
> Anything not in this file is **out of scope** until it is added here.

---

## 0. Project Identity

| Field | Value |
|---|---|
| **Project Name** | Krozenda |
| **Type** | Multi-Vendor B2B + B2C Marketplace Platform |
| **Models Supported** | Direct Dropshipping · Amazon-style Marketplace · Own Stock Selling |
| **Vendor** | Appzeto (appzeto.com) |
| **Quote Ref** | #0001710, issued 27 July 2026 |
| **Committed Timeline** | 90 working days (Phase 1 only — see §9) |
| **Payment Terms** | 30% advance / 40% milestone / 30% on delivery |
| **Market** | India (INR, GST, DLT-regulated SMS, RBI payment rules) |

---

## 1. Business Overview

Krozenda is a single integrated platform that must run **three business models simultaneously**, sharing one catalog, one cart, one checkout, and one settlement engine.

### 1.1 Model A — Direct Dropshipping
- Admin onboards external suppliers (companies, manufacturers, wholesalers, traders, dealers, retail shops).
- Supplier products appear in the platform catalog.
- Customer pays **into the platform**; order is auto-forwarded to the supplier.
- Supplier packs and ships from **their own** address, uploads tracking.
- Platform deducts commission, settles the remainder to the supplier.

### 1.2 Model B — Marketplace (Amazon-style)
- Any seller self-registers, uploads KYC docs, waits for Admin approval.
- On approval the seller gets a storefront + Seller Panel (web + mobile).
- Seller manages own products, stock, pricing, orders, settlements.
- Fulfilment from seller's registered warehouse; pickup arranged via Shiprocket.

### 1.3 Model C — Own Stock
- Platform Owner/Admin lists and sells platform-owned inventory.
- Fulfilled from the platform's own warehouse.
- Inventory, orders, shipping, and sales reports must be **trackable separately** from vendor stock.

### 1.4 Buyer Types
- **B2C Retail Customer** — standard retail pricing, single/low quantity.
- **B2B Buyer** (dealer, distributor, trader, wholesaler, company) — tiered pricing, MOQ, bulk quantity, tax invoice.

A single product may be sold under different price tiers to different buyer types.

---

## 2. User Roles (RBAC)

Thirteen roles, each with **configurable** permissions. Permissions are data, not hardcoded.

| # | Role | Surface | Notes |
|---|---|---|---|
| 1 | Super Admin | Admin Panel | Full access, can create Admins, immutable audit trail |
| 2 | Admin | Admin Panel | Scoped by permission set |
| 3 | Staff | Admin Panel | Narrow operational permissions |
| 4 | Company | Seller Panel | Registered business entity |
| 5 | Manufacturer | Seller Panel | |
| 6 | Vendor/Seller | Seller Panel | Marketplace seller (Model B) |
| 7 | Dropshipping Partner | Seller Panel | Supplier (Model A) |
| 8 | Trader | Seller Panel / Buyer | Can be both seller and B2B buyer |
| 9 | Dealer | Seller Panel / Buyer | Can be both |
| 10 | Distributor | Seller Panel / Buyer | Can be both |
| 11 | Wholesaler | Seller Panel / Buyer | Can be both |
| 12 | Retail Customer | Buyer App/Web | B2C |
| 13 | B2B Buyer | Buyer App/Web | Tiered pricing access |

**Architecture requirement:** roles 8–11 can hold *both* a seller and a buyer capability on one account. Model this as `user.roles[]` + `user.capabilities[]`, **not** a single `role` string field.

---

## 3. Technology Stack

### 3.1 Confirmed — MERN ONLY
| Layer | Technology |
|---|---|
| Backend | Node.js (Express) |
| Database | MongoDB |
| Web Frontend | React |
| Mobile Apps | React Native |
| Push Notifications | Firebase (FCM only) |
| Payments | Razorpay |
| Logistics | Shiprocket |
| SMS + OTP | SMS India Hub |
| Email | SMTP |

**This is a MERN-stack project. No native code.** No Kotlin/Java for Android, no Swift/Objective-C for iOS. The four app binaries (Buyer Android, Buyer iOS, Seller Android, Seller iOS) are produced from React Native, sharing logic and components with the React web frontend wherever possible.

Do not introduce a second language or a non-JS runtime anywhere in the stack.

### 3.2 Decisions Required Before Coding
These are **blocking**. Do not guess — ask.

1. **Razorpay Route enabled?** Split settlement is mandatory (see §4.1). Confirm the client's Razorpay account has Route provisioned.
2. **Seller of record per model.** Determines invoicing, GST TCS (Sec 52), and TDS (Sec 194-O) treatment. Must be answered before schema design.
3. **Search.** MongoDB regex will not scale for a marketplace catalog. Atlas Search vs. Elasticsearch — decide before catalog work begins.

---

## 4. Integrations — EXACTLY FIVE

No other third-party service is in scope.

### 4.1 Razorpay (payments + settlement) — CRITICAL
- Methods: UPI, Credit Card, Debit Card, Net Banking, Wallet.
- **Online payments only. No COD.**
- **Must use Razorpay Route.** Collecting vendor funds into the platform account and manually disbursing them is not permissible under the RBI Payment Aggregator framework without a PA licence.
- Every vendor/supplier must be onboarded as a **Route linked account** with their own KYC before they can receive settlement.
- Settlement flow: `Customer → Razorpay → Platform (commission) + Linked Account (vendor share)`.
- Build settlement as Route transfers/holds, **not** a home-grown payout ledger.
- Handle: payment capture, webhook verification (signature check), refunds, partial refunds, transfer reversal.

### 4.2 Shiprocket (logistics)
- AWB generation, courier allocation, shipping label, pickup scheduling, real-time tracking, delivery status webhooks.
- Vendor pickup **and** warehouse pickup addresses.
- Client is responsible for Shiprocket account, sub-accounts, and per-vendor pickup location setup.
- **RTO (Return to Origin) handling must be built** — see §6.3.

### 4.3 Firebase — PUSH NOTIFICATIONS ONLY
- FCM push notifications for Buyer and Seller apps. **Nothing else.**
- **Do NOT use Firebase Phone Auth.** All OTP goes through SMS India Hub.
- **Do NOT use Firebase Auth, Firestore, Firebase Storage, or Remote Config.**
- MongoDB is the system of record. Auth is our own JWT/refresh implementation.

### 4.4 SMS India Hub
- Transactional SMS **and all OTP delivery** (login OTP, registration OTP, order alerts).
- Since Firebase Phone Auth is excluded, OTP generation, hashing, expiry, retry limits, and rate limiting are all **our responsibility** — build them in the auth service.
- **DLT dependency (client-owned):** TRAI DLT entity registration, Sender ID (header) approval, and pre-registration of *every* SMS template. Takes 3–10 working days. Templates cannot be changed freely post-approval.
- Build templates as configurable records so DLT-approved text can be swapped without a code deploy.

### 4.5 SMTP (email)
- Order confirmations, invoices, email verification links, seller notifications.
- **Client-owned infrastructure dependency:** SPF, DKIM, DMARC records on the sending domain. Without these, deliverability will fail at volume.
- Implement a queued sender with retry — do not send synchronously in the request cycle.

---

## 5. EXPLICIT EXCLUSIONS

The original Scope of Work mentions these. **They are NOT being built.** Do not scaffold, stub, or reference them.

| Excluded | Was in SOW § |
|---|---|
| Tally Integration (ledgers, voucher exports, GST ledger mapping, inventory sync) | §15, §20 |
| Zoho Books Integration | §15, §20 |
| WhatsApp Notifications / WhatsApp Business API | §14, §20 |
| AI Chatbot | §14 |
| Automated KYC verification APIs (PAN / Aadhaar / GST / FSSAI) | §6 |
| Bank account penny-drop verification | §6 |
| COD (Cash on Delivery) | §11 |
| Multi-language / Multi-currency | §18 |
| ERP / CRM / POS / Franchise / Membership / Subscription modules | §18 |
| Firebase Phone Auth / Firebase Auth / Firestore / Firebase Storage | — |
| Native Android (Kotlin/Java) or native iOS (Swift/ObjC) code | — |
| Post-delivery support, warranty period, AMC | Timeline page |
| Data migration from any existing system | — |

### 5.1 KYC — What IS Built
Document **collection** + Admin **manual review** workflow:
- Seller uploads: PAN, Aadhaar, GST cert, FSSAI (food category), cancelled cheque, address proof, business/company documents.
- Mobile OTP + Email verification are automated.
- Admin reviews uploaded documents and approves/rejects with a reason.
- No third-party API validates these documents. A human does.
- Digital acceptance of: Vendor Agreement, Government Rules, Privacy Policy, T&C, Shipping Policy, Return Policy — store acceptance timestamp, IP, and policy version.

**Legal policy text is supplied by the Client.** We build the acceptance flow, not the documents.

---

## 6. Critical Business Logic

These are the hardest parts of the system and the most commonly under-specified. Read carefully.

### 6.1 Multi-Vendor Cart Splitting
A single cart may contain items from multiple vendors across all three business models.

On checkout, one payment must produce:
- **1 Parent Order** (customer-facing order ID, single payment reference)
- **N Sub-Orders** — one per vendor/supplier/own-stock bucket

Each Sub-Order carries independently:
- Its own status lifecycle
- Its own shipment + AWB
- Its own GST invoice
- Its own commission calculation
- Its own settlement record
- Its own cancellation and refund path

**Partial cancellation and partial refund must work.** Cancelling one sub-order must not affect the others, and must trigger a proportional Razorpay refund plus reversal of that sub-order's Route transfer only.

### 6.2 Order Lifecycle
```
Placed → Payment Verified → Auto-assigned to Vendor → Vendor Accepted
      → Packed (packing slip) → AWB Generated (Shiprocket) → Shipped
      → In Transit → Delivered → Settlement Eligible → Settled
```
Exception branches: `Vendor Rejected`, `Cancelled (buyer)`, `Cancelled (admin)`, `RTO Initiated`, `RTO Delivered`, `Return Requested`, `Replacement Issued`.

Every transition must be logged with actor, timestamp, and reason.

### 6.3 RTO Handling
"No Return" policy does **not** cover Return to Origin. Build for:
- Undelivered / address failure / customer unreachable
- Who bears return shipping cost (configurable: platform / vendor)
- Settlement reversal when RTO completes
- Inventory restoration for Own Stock and Marketplace models

### 6.4 Returns & Replacement
- **Default policy: No Return.**
- Allowed exceptions only: Damaged Product, Wrong Product, Missing Product.
- Buyer raises request with mandatory photo evidence.
- Admin-controlled approval → replacement or refund.
- Return shipping policy is configurable per case.
- Must reconcile with Consumer Protection (E-Commerce) Rules — flag any conflict to the Client rather than silently overriding.

### 6.5 Pricing & Commission Engine
Centralised, fully Admin-configurable. Resolution order (most specific wins):

```
Product-wise → Vendor-wise → Category-wise → Company-wise → Minimum Default
```

- Commission type: **Fixed** or **Percentage**
- Automatic margin calculation with **Manual Override** capability
- Discount rules and pricing rules layered on top
- Multiple price levels: Retail (B2C), Wholesale, Dealer, Distributor — resolved by buyer role
- MOQ enforcement on B2B tiers

**Commission must be snapshotted onto the sub-order at time of order.** Never recompute historical commission from current config.

### 6.6 Settlement
- Options: Automatic, Manual, Weekly, Monthly (Admin-configurable per vendor).
- Eligibility gate: order Delivered + return window elapsed.
- Executed via Razorpay Route transfers.
- Full audit trail: gross, commission, deductions, net, transfer ID, status.

### 6.7 Product Model
Types: **Simple**, **Variable** (variants/options), **Bulk**, **Wholesale**, **Pack Size**.

Every product carries: SKU, Barcode, MOQ, GST rate, HSN code.

Approval chain: **Category Approval → Brand Approval → Product Approval** before a product goes live.

Ingestion methods: Manual creation, CSV import, Excel import, API import.

**Supplier sync (stock / price / image / description) is capped at TWO supplier integrations in Phase 1.** Each additional supplier integration is bespoke work and is priced separately. Build a pluggable adapter interface so new suppliers are a new adapter, not a new codebase.

---

## 7. Data Model — Core Collections

Not exhaustive. Establish these before feature work.

```
users              — roles[], capabilities[], profile, auth
sellers            — links to user, KYC docs, approval state, store config,
                     razorpay_linked_account_id, pickup addresses
kyc_documents      — type, file ref, status, reviewer, review notes, version
categories         — tree, approval state
brands             — approval state
products           — owner (seller | admin), type, variants[], sku, hsn,
                     gst_rate, moq, approval state, source (manual|csv|api),
                     supplier_ref
price_tiers        — product ref, buyer_role, price, min_qty
inventory          — product/variant, owner bucket (vendor|own_stock), qty,
                     reserved qty
commission_rules   — scope (product|vendor|category|company|default), type, value
carts              — line items with resolved price + tier snapshot
orders             — parent order, buyer, payment ref, totals
sub_orders         — parent ref, vendor ref, model (drop|marketplace|own),
                     status, commission snapshot, invoice ref
shipments          — sub_order ref, awb, courier, tracking events[]
invoices           — sub_order ref, gst breakup, seller of record
settlements        — sub_order ref, gross, commission, net, route transfer id
returns            — sub_order ref, reason, evidence[], resolution
notifications      — channel, template ref, recipient, status
audit_logs         — actor, entity, before/after, timestamp, ip
policy_acceptances — user, policy type, version, timestamp, ip
```

---

## 8. Non-Functional Requirements

These were absent from the SOW and **must be confirmed with the Client**. Interim working targets:

| Metric | Working Target |
|---|---|
| Concurrent users | 1,000 |
| Catalog size | 100,000 SKUs |
| Orders/day | 5,000 |
| API p95 response | < 500 ms |
| Uptime | 99.5% |

Also required:
- SSL/TLS everywhere
- OTP authentication + Two-Factor Authentication for Admin/Seller
- Encryption at rest for KYC documents and PII
- Rate limiting, anti-spam, anti-fraud checks on order placement
- Daily automated backup + cloud backup
- Login alerts
- Audit logs on all privileged actions

---

## 9. Phase Breakdown

### PHASE 0 — Foundation (Days 1–10)
Blocking for everything else.

- Repo structure, monorepo decision, branching strategy, CI
- Environment setup (dev / staging / prod), secrets management
- MongoDB schema for core collections (§7)
- Auth service: registration, login, JWT/refresh, email verification, and **own OTP implementation** (generation, hashing, expiry, retry limits, rate limiting) delivered via SMS India Hub
- **RBAC engine** — permissions as data, 13 roles seeded
- Design system + shared component library (React + React Native)
- Razorpay sandbox + Route linked-account test flow
- Shiprocket sandbox connection
- Firebase project + FCM wiring
- SMS India Hub + SMTP sandbox harness
- API contract definition (OpenAPI spec) — frontend teams work against this

**Exit criteria:** a user can register, verify, log in, and hit a permission-gated endpoint on staging.

---

### PHASE 1 — Core Platform (Days 11–90) — CONTRACTED SCOPE

#### 1A. Catalog & Seller Onboarding (Days 11–30)
- Seller/Company registration + KYC document upload
- Admin manual verification workflow (approve/reject with reason)
- Digital policy acceptance capture
- Category tree + brand management with approval chains
- Product CRUD: Simple, Variable, Bulk, Wholesale, Pack Size
- SKU, barcode, HSN, GST, MOQ fields
- CSV + Excel import with validation and error reporting
- Product approval workflow
- Search infrastructure (per §3.2.5 decision)

#### 1B. Pricing, Cart & Checkout (Days 25–45)
- Commission engine with full resolution hierarchy (§6.5)
- Multiple price levels by buyer role
- Discount and pricing rules
- Cart with per-line tier resolution
- **Multi-vendor cart splitting** (§6.1) — parent order + sub-orders
- Address book, multiple addresses
- Coupons and offers
- Razorpay checkout + webhook verification + signature validation

#### 1C. Order & Fulfilment (Days 40–62)
- Full order lifecycle state machine (§6.2)
- Auto supplier/vendor assignment and order forwarding
- Vendor accept/reject
- Packing slip generation
- **GST-compliant invoice generation** per sub-order (seller of record per §3.2.4)
- Shiprocket: AWB, label, courier allocation, pickup scheduling
- Tracking sync via webhook
- Delivery confirmation
- Cancellation rules (buyer-side and admin-side, pre-dispatch)
- RTO handling (§6.3)

#### 1D. Settlement, Returns & Notifications (Days 55–72)
- Razorpay Route transfers, holds, reversals
- Settlement scheduling (auto / manual / weekly / monthly)
- Settlement ledger and reports
- Returns & replacement workflow (§6.4)
- Refund and partial refund
- Notification engine: FCM push, SMS India Hub (DLT templates), SMTP email
- Template management as configurable records

#### 1E. Panels & Apps (Days 30–80, parallel)
All four app binaries are **React Native** builds. Web surfaces are React.

- **Buyer:** Android app, iOS app, responsive website
  - Registration, search, filters, product detail, cart, wishlist, checkout,
    order tracking, invoice download, reviews, ratings, coupons, reorder,
    multiple addresses
- **Seller:** Android app, iOS app, web Seller Panel, responsive dashboard
  - Products, inventory, pricing, orders, shipments, settlements, reports,
    business documents
- **Admin Panel:** users, sellers, companies, dropshipping partners, dealers,
  traders, distributors, products, orders, payments, settlements, commission,
  categories, brands, coupons, offers, banners, CMS, reports, analytics,
  audit logs, backup, notifications

#### 1F. B2B Core (Days 60–75)
In Phase 1: dealer/distributor/trader/company registration, MOQ, bulk quantity,
wholesale pricing, dealer pricing, multiple price levels, tax invoice.

#### 1G. Hardening & Handover (Days 75–90)
- Security hardening, 2FA, rate limiting, encryption at rest
- Performance optimisation against §8 targets
- Functional, performance, and security testing
- UAT cycle with Client
- Production deployment, domain and hosting configuration
- Daily + cloud backup configuration
- Administrator training
- Technical documentation, API documentation, deployment guide
- Handover: source code, git repo, database, server credentials, all configs

---

### PHASE 2 — Deferred (separate scope and pricing)

Not part of the 90-day commitment. Do not build.

| Item | Reason for deferral |
|---|---|
| Open APIs (Product, Company, Inventory, ERP, Shipping, Accounting, Order) | 7 documented public APIs is a substantial standalone deliverable; no consumer on day one |
| B2B RFQ workflow | Distinct multi-step workflow module |
| B2B Purchase Orders | Depends on RFQ |
| B2B Credit Limit | Requires credit ledger + exposure tracking |
| Supplier integrations beyond 2 | Each is bespoke adapter work, priced per supplier |
| Supplier self-registration as Dropshipping Partner | SOW says "future" — Admin adds suppliers manually in Phase 1 |
| External partners selling platform products via API | SOW says "future" |
| Tally / Zoho Books | Excluded entirely (§5) |
| WhatsApp notifications | Excluded entirely (§5) |
| AI Chatbot | Excluded entirely (§5) |
| Automated KYC APIs | Excluded entirely (§5) |
| Multi-language, Multi-currency, International commerce | Future |

**Architectural obligation:** the codebase must be modular enough that Phase 2 items can be added without redevelopment. Keep integration layers behind interfaces (payment provider, logistics provider, notification channel, supplier adapter).

---

## 10. Client-Owned Dependencies

Development is blocked without these. Track them with named owners and dates.

| Dependency | Owner |
|---|---|
| Razorpay account with **Route** enabled | Client |
| Razorpay MDR and transaction charges | Client |
| Shiprocket account + per-vendor pickup locations | Client |
| **TRAI DLT registration, Sender ID, SMS template approval** | Client |
| SMTP credentials + SPF / DKIM / DMARC DNS records | Client |
| Firebase project ownership | Client |
| Domain and hosting | Client |
| Apple Developer account ($99/yr) + Google Play Console | Client |
| Legal policy text (Privacy, T&C, Shipping, Return, Vendor Agreement) | Client |
| Seller-of-record and GST TCS/TDS position | Client |
| Logo, brand assets, product content | Client |
| UI/UX design and design system | **Appzeto (internal)** |

---

## 11. Compliance Notes

- **RBI Payment Aggregator framework** — vendor funds cannot be held and disbursed by the platform without a PA licence. Razorpay Route is the compliance path.
- **GST** — TCS under Sec 52 and TDS under Sec 194-O apply to marketplace operators. Invoice structure depends entirely on the seller-of-record decision.
- **TRAI DLT** — every transactional SMS template must be pre-registered.
- **Consumer Protection (E-Commerce) Rules** — the "No Return" default must be reconciled; raise conflicts, don't silently resolve them.
- **IT Act / data protection** — encryption of KYC documents and PII, breach handling.
- **FSSAI** — required for food-category sellers.

---

## 12. Working Conventions

- **Never invent scope.** If a requirement is ambiguous, ask — do not choose an interpretation and build it.
- **Never build anything in §5 (Exclusions).**
- **MERN only.** JavaScript/TypeScript end to end. No native mobile code, no second backend language.
- **All OTP goes through SMS India Hub**, never Firebase. Firebase is FCM push and nothing else.
- **Snapshot financial values** (price, commission, GST rate) onto orders. Never recompute history from live config.
- **Every money movement gets an audit record.**
- **Every privileged action gets an audit log entry.**
- Webhooks (Razorpay, Shiprocket) must be **idempotent** and **signature-verified**.
- Notification templates are **data**, not code (DLT constraint).
- Integration providers sit behind **interfaces** — payment, logistics, notification, supplier adapter.
- Write the state machine for orders **explicitly**; do not scatter status strings across controllers.
- Anything marked **DECISION REQUIRED** in §3.2 blocks the affected module. Do not proceed on assumptions.

---

## 13. Open Questions Log

Track answers here as they arrive.

### 13.1 Resolved

| # | Question | Answer |
|---|---|---|
| 1 | Mobile framework | **MERN only — React Native. No native Android/iOS code.** (§3.1) |
| 2 | Firebase scope | **Push notifications (FCM) only.** No Phone Auth, no Firestore. All OTP via SMS India Hub. (§4.3) |
| 3 | Design / UI ownership | **Owned internally by Appzeto.** Not a client dependency, not a blocker. |
| 4 | Data migration | **None.** No existing system to migrate from. Greenfield build. |
| 5 | Post-delivery support | **Out of scope.** No warranty period or AMC in this engagement. (§5) |

### 13.2 Still Open

| # | Question | Blocks | Status |
|---|---|---|---|
| 1 | Razorpay Route enabled on client account? | Settlement engine | OPEN |
| 2 | Seller of record per business model? | Invoicing, GST, schema | OPEN |
| 3 | Search: Atlas Search or Elasticsearch? | Catalog | OPEN |
| 4 | NFR targets confirmed (§8)? | Infra sizing | OPEN |
| 5 | Which 2 supplier integrations are in Phase 1? | Product sync | OPEN |