# KROZENDA — Phase Plan & Checklist

> Derived from `Krozenda-project-context.md` §9 (Phase Breakdown). This file
> is the trackable checklist — every item here traces back to that section.
> `Krozenda-progress-log.md` is the dated, append-only record of what
> actually happened against this checklist; update **both** when work lands
> (check the box here, add a dated entry there).

**Status legend:** `[ ]` not started · `[~]` in progress / partial · `[x]` done

---

## Phase 0 — Foundation (Days 1–10)

Blocking for everything else. Source: §9 "PHASE 0".

- [~] Repo structure — `frontend/`, `backend/`, `tools/` scaffolded.
      Monorepo-vs-single-app decided (single Vite app, frontend §14.4 item 8
      default). Branching strategy and CI **not** set up.
- [ ] Environment setup (dev / staging / prod), secrets management
- [~] MongoDB schema for core collections (§7) — `User`, `Role`, `Seller`,
      `Order`, `SubOrder` skeletons only (5 of ~19 collections). Missing:
      `kyc_documents`, `categories`, `brands`, `products`, `price_tiers`,
      `inventory`, `commission_rules`, `carts`, `shipments`, `invoices`,
      `settlements`, `returns`, `notifications`, `audit_logs`,
      `policy_acceptances`.
- [~] Auth service: registration, login, JWT/refresh, email verification,
      own OTP implementation — JWT sign/verify/refresh is real and
      verified working. Registration, login, email verification, and the
      SMS India Hub OTP implementation (generation/hashing/expiry/retry
      limits/rate limiting) are **not** built.
- [~] RBAC engine — permissions as data, 13 roles seeded — data model
      (`Role`), `requirePermission` middleware, and `seedRoles` script are
      built and the permission-check logic is verified standalone. The
      seed script has not yet been run against a live database (none
      available in the dev environment it was built in).
- [~] Design system + shared component library (React + React Native) —
      React web component library (`frontend/src/components/ui`,
      `layout`) done. React Native shared component library **not**
      started.
- [ ] Razorpay sandbox + Route linked-account test flow — interface only
      (`PaymentProvider` / `RazorpayProvider` stub), no SDK installed, no
      sandbox account wired. Blocked on §3.2 item 1 (Route provisioning
      confirmation).
- [ ] Shiprocket sandbox connection — interface only (`ShiprocketProvider`
      stub).
- [ ] Firebase project + FCM wiring — interface only (`FcmChannel` stub).
- [ ] SMS India Hub + SMTP sandbox harness — interface only
      (`SmsIndiaHubChannel`, `SmtpChannel` stubs). Blocked on client-owned
      DLT registration / SPF-DKIM-DMARC records (§10).
- [ ] API contract definition (OpenAPI spec)

**Exit criteria** ("a user can register, verify, log in, and hit a
permission-gated endpoint on staging"): **not met**. No register/login/OTP
flow exists yet. A permission-gated endpoint exists and is confirmed
working (`GET /api/v1/admin/dashboard-summary` etc.), but only reachable
today via a manually-issued JWT, not a real login.

---

## Phase 1A — Catalog & Seller Onboarding (Days 11–30)

- [ ] Seller/Company registration + KYC document upload
- [ ] Admin manual verification workflow (approve/reject with reason)
- [ ] Digital policy acceptance capture
- [ ] Category tree + brand management with approval chains
- [ ] Product CRUD: Simple, Variable, Bulk, Wholesale, Pack Size
- [ ] SKU, barcode, HSN, GST, MOQ fields
- [ ] CSV + Excel import with validation and error reporting
- [ ] Product approval workflow
- [ ] Search infrastructure (blocked on §3.2 item 3 — Atlas Search vs.
      Elasticsearch decision)

## Phase 1B — Pricing, Cart & Checkout (Days 25–45)

- [ ] Commission engine with full resolution hierarchy (§6.5)
- [ ] Multiple price levels by buyer role
- [ ] Discount and pricing rules
- [ ] Cart with per-line tier resolution
- [ ] Multi-vendor cart splitting (§6.1) — parent order + sub-orders
- [ ] Address book, multiple addresses
- [ ] Coupons and offers
- [ ] Razorpay checkout + webhook verification + signature validation

## Phase 1C — Order & Fulfilment (Days 40–62)

- [ ] Full order lifecycle state machine (§6.2) — status constants exist
      (`config/constants.js`, both apps) but no state machine / transition
      logic is implemented
- [ ] Auto supplier/vendor assignment and order forwarding
- [ ] Vendor accept/reject
- [ ] Packing slip generation
- [ ] GST-compliant invoice generation per sub-order (blocked on §3.2 item
      2 — seller-of-record decision)
- [ ] Shiprocket: AWB, label, courier allocation, pickup scheduling
- [ ] Tracking sync via webhook
- [ ] Delivery confirmation
- [ ] Cancellation rules (buyer-side and admin-side, pre-dispatch)
- [ ] RTO handling (§6.3)

## Phase 1D — Settlement, Returns & Notifications (Days 55–72)

- [ ] Razorpay Route transfers, holds, reversals
- [ ] Settlement scheduling (auto / manual / weekly / monthly)
- [ ] Settlement ledger and reports
- [ ] Returns & replacement workflow (§6.4)
- [ ] Refund and partial refund
- [ ] Notification engine: FCM push, SMS India Hub (DLT templates), SMTP
      email — interface contracts exist (`src/integrations/notification/`),
      no implementation
- [ ] Template management as configurable records

## Phase 1E — Panels & Apps (Days 30–80, parallel)

- [~] Web Seller Panel — `frontend/src/modules/seller/` scaffolded
      (mounts `vendor-shared`'s dashboard), no real screens
- [~] Web Admin Panel — `frontend/src/modules/admin/` scaffolded, no real
      screens beyond the reference dashboard
- [~] Buyer responsive website — `frontend/src/modules/user/` scaffolded,
      no real screens
- [ ] Buyer Android app (React Native)
- [ ] Buyer iOS app (React Native)
- [ ] Seller Android app (React Native)
- [ ] Seller iOS app (React Native)

## Phase 1F — B2B Core (Days 60–75)

- [ ] Dealer/distributor/trader/company registration
- [ ] MOQ, bulk quantity
- [ ] Wholesale pricing, dealer pricing, multiple price levels
- [ ] Tax invoice

## Phase 1G — Hardening & Handover (Days 75–90)

- [ ] Security hardening, 2FA, rate limiting, encryption at rest — a
      baseline API rate limiter exists (`backend/src/middlewares/rateLimiter.js`);
      2FA and encryption at rest do not
- [ ] Performance optimisation against §8 targets
- [ ] Functional, performance, and security testing
- [ ] UAT cycle with Client
- [ ] Production deployment, domain and hosting configuration
- [ ] Daily + cloud backup configuration
- [ ] Administrator training
- [ ] Technical documentation, API documentation, deployment guide
- [ ] Handover: source code, git repo, database, server credentials, all
      configs

---

## Phase 2 — Deferred (separate scope and pricing)

Not part of the 90-day commitment. Do not build without a scope change —
see §9 "PHASE 2" for the full list and reasons (Open APIs, B2B RFQ/PO/Credit
Limit, supplier integrations beyond 2, supplier self-registration, external
partner API access, Tally/Zoho/WhatsApp/AI Chatbot/automated KYC — all
excluded per §5, multi-language/currency).

---

## Blocking decisions (repeat of §3.2 / §13.2 — nothing here should proceed on an assumption)

| # | Decision | Blocks |
|---|---|---|
| 1 | Razorpay Route enabled on client account? | Settlement engine, Phase 0 Razorpay sandbox item |
| 2 | Seller of record per business model? | Invoicing, GST TCS/TDS, Phase 1C invoice generation |
| 3 | Search: Atlas Search or Elasticsearch? | Phase 1A search infrastructure |
| 4 | NFR targets confirmed (§8)? | Infra sizing, Phase 1G performance work |
| 5 | Which 2 supplier integrations are in Phase 1? | Product sync, supplier adapters |

These are still open as of the last update to this file — see
`Krozenda-project-context.md` §13.2.
