# Krozenda — QA, Security & Load Assessment

> **Fix status (2026-09-29):** all 4 P0s and all 7 P1s are fixed, plus QA-005, QA-015, QA-020–022 and the main performance items, all with regression tests (§11). Still open: remaining P2/P3 items, seller earnings summary speed, and running `backfill-vendor-suspended.js` on live data. Suite: 60 suites / 830 tests, 0 failing.

**Date:** 2026-09-28 · **Scope:** backend API (Express 5 / Mongoose 9), realtime (socket.io), frontend build (Vite/React) · **Commit under test:** `2d3bafe`

---

## 1. Executive summary

**Verdict: NOT production-ready.** The core commerce engine is solid: checkout pricing, stock reservation, idempotent order placement, payment verification, seller line isolation and webhook signing all held up under adversarial and concurrent tests. But this assessment found **4 P0 defects** that lose money or expose data, and **7 P1 defects**. All must be fixed before launch.

| Severity | Count | Headline |
|---|---|---|
| **P0** | 4 | Wallet top-up replay mints money · order payments can also be credited to the wallet · any sub-admin can change commission, fees and coupons · anonymous access to every guest and seller support ticket |
| **P1** | 7 | Sellers self-declare delivery and get paid · suspended/unverified sellers stay live · coupon limits bypassed under concurrency · partial refund blocks later refunds · no login brute-force protection · OTP cap resets on resend · OTPs written to logs |
| **P1 (perf)** | 1 | Mixed-traffic capacity ≈ 30 req/s; admin and seller dashboards and OTP login block the event loop |
| **P2** | 10 | see §6 |
| **P3** | 8 | see §6 |

Every confirmed defect has an automated reproduction in `backend/tests/qa/`, tagged `[KNOWN BUG QA-xxx]` (see §9).

---

## 2. Environment

| Item | Value |
|---|---|
| Test DB | `mongodb-memory-server` 7.0/8.2, single-node **replica set** (transactions enabled), fresh per run |
| Shared Atlas DB | **Not touched.** No writes; a read-only index check was attempted and blocked by policy (see §8) |
| Third parties | Razorpay, Shiprocket, CJ, Firebase and WhatsApp are mocked in tests. The load server blanks all credentials and blocks every non-localhost `fetch` |
| Load host | Windows 10, 8 logical cores. Load generator, Node server and mongod share one machine, so absolute throughput is pessimistic; the *ratios* between endpoints are what matter |
| Node | v24.20.0 |

---

## 3. Coverage

| Area | How | Result |
|---|---|---|
| Existing suite | 49 suites / 634 tests, baseline before changes | PASS |
| Auth & tokens | forged `alg:none`, expired, cross-audience, refresh-as-access, deactivated/deleted accounts | PASS (1 P3) |
| RBAC / sub-admin | support-only role against 20+ admin modules | **FAIL: QA-001, QA-020** |
| Multi-vendor checkout | 3 sellers, 1 cart: totals to the paisa, per-line commission snapshot, stock | PASS |
| Seller isolation | read/move/cancel/edit/restock/coupon on another seller's data | PASS |
| Seller fraud paths | self-delivery → settlement; suspended/pending seller visibility | **FAIL: QA-003, QA-004, QA-005** |
| Inventory concurrency | 20 buyers × 3 units; multi-unit; per-variant; partial-cart rollback; 100-buyer hot drop | PASS |
| Coupons | sequential limits, concurrent limits, seller-scoped discount capping | **FAIL: QA-006** |
| Idempotency | same key × 5 parallel; no key × 2 | PASS / **FAIL: QA-012** |
| Razorpay checkout | forged sig, underpay, wrong order, not captured, unknown payment, replay, stock-out refund | PASS |
| Wallet top-up | forged sig, client amount ignored, replay, cross-purpose payment | **FAIL: QA-007, QA-008** |
| Payment webhook | bad/missing sig, fail-closed, duplicate delivery, unknown event, partial refund | PASS / **FAIL: QA-009** |
| Cancellation | 5× parallel cancel refunds/restocks once; cross-buyer cancel | PASS |
| Support tickets | buyer↔buyer, guest, seller ticket exposure | **FAIL: QA-002, QA-021** |
| Security | NoSQL injection ×4, query operators, regex escaping, 413 limit, malformed JSON/ids, helmet, prod CORS, prod error masking, brute force, OTP | PASS / **FAIL: QA-010, 011, 013, 022, 023** |
| Load / performance | 11-stage profile, 6 scenarios, hot-product race, slow-query profiler | see §5 |
| Frontend | secrets in bundle, bundle/image weight, XSS sinks | PASS / P2, P3 |

**Totals after this work:** 57 suites / **770 tests, 0 failing**. That includes 6 new QA suites (119 tests: 88 regular + 31 known-bug reproductions) and 2 suites added concurrently in commit `2d3bafe`.

---

## 4. Critical & high findings

### QA-007 · P0 · Wallet top-up replay credits the wallet on every retry
- **Module:** `Controllers/walletController.js` `verifyTopup`
- **Steps:** complete one ₹500 top-up; POST the same `{razorpay_order_id, razorpay_payment_id, razorpay_signature}` to `/user/wallet/topup/verify` three more times.
- **Expected:** balance ₹500, later calls idempotent. **Actual:** balance **₹2,000**. Calls 2–4 answer *"Wallet already topped up"* while crediting ₹500 each. One WalletTransaction exists, so balance and ledger disagree.
- **Root cause:** `$inc walletBalance` runs *before* the insert guarded by the unique `razorpayPaymentId` index. The `11000` handler returns success without reversing the `$inc`.
- **Fix:** insert the WalletTransaction first (or both in one transaction) and only `$inc` after the insert succeeds.

### QA-008 · P0 · A payment made for an order can also be credited to the wallet
- **Steps:** pay ₹1,000 for an order via Razorpay; POST the same payment triple to `/user/wallet/topup/verify`.
- **Actual:** order placed **and** wallet +₹1,000. Paid once, spent twice.
- **Root cause:** `verifyTopup` never checks the Razorpay order's `notes.purpose`, and nothing checks the payment against `Order.razorpayPaymentId`.
- **Fix:** require `payment.notes.purpose === 'WALLET_TOPUP'` (set it in `createTopupOrder`), and reject any payment id already on an Order.

### QA-001 · P0 · Any sub-admin can change money settings, coupons and payouts
- **Routers with `protectAdmin` only, no `requirePermission`:** `couponRoutes`, `adminSettingsRoutes`, `accountsRoutes`, `cmsRoutes`, `faqRoutes`.
- **Reproduced with a role holding only `admin.people.support`:**
  - created a **100%-off sitewide coupon** (201);
  - set platform **commission 10% → 1%** and a **₹77 buyer platform fee** (200);
  - recorded a **₹50,000 vendor payout** (201), which reduces what the seller is shown as owed;
  - searched customers' **name/email/phone** (200);
  - **published a CMS page live** and created FAQs (201);
  - read the accounts ledger (200).
- **Fix:** add `requirePermission(...)` to each router: `admin.marketing.coupons` already exists; add `admin.settings.manage`, `admin.accounting.*`, and a CMS/FAQ key. Treat `accountsRoutes` writes as admin-only.

### QA-002 · P0 · Anonymous access to every guest and seller support ticket
- **Steps:** `GET /user/tickets?ids=TKT-000000000&search=.` with no token.
- **Actual:** returns **every guest ticket and every seller→admin ticket**, with name, email, phone and full message thread. Then, still anonymous: read a seller's payout dispute, post into it, and close it.
- **Root cause:** (1) for guests the id restriction lives in `filter.$or`, and `search` *appends* to that `$or`, widening it; (2) seller tickets are stored with `user: null`, and `canAccessTicket` returns `true` for any ticket with no user.
- **Fix:** AND the search clause (`$and: [idClause, searchClause]`); in `canAccessTicket`, never grant a ticket that has a `vendor` to a non-vendor; escape the search regex (QA-021); scope guest `counts` to the requested ids.

### QA-003 · P1 · Sellers can self-declare delivery and make the line payable
- **Steps:** seller moves own prepaid line PENDING→PROCESSING→SHIPPED (`trackingNumber: "NOT-A-REAL-AWB"`)→DELIVERED.
- **Actual:** order rolls up to DELIVERED, `deliveredAt` stamped; after the hold window `collectEligibleLines` offers **₹4,500 net** for payout. No carrier evidence is involved.
- **Fix:** once Shiprocket is the fulfilment path, DELIVERED must come from the carrier (webhook/poller) or admin. At minimum, exclude seller-declared deliveries from settlement until an admin confirms.

### QA-004 · P1 · Suspended and unverified sellers stay live and purchasable
- Suspending a seller (`isActive=false`) leaves their products visible, searchable, and **orderable (201)**.
- With auto-approval on, a **KYC-PENDING** seller's product goes live immediately.
- **Fix:** add vendor state to the public visibility predicate, or cascade-deactivate products on suspend; block product activation for non-APPROVED sellers; re-check at checkout.

### QA-006 · P1 · Coupon usage limits bypassed under concurrency
- **Actual:** 8 parallel checkouts on a `usageLimit: 1` coupon → **all 8 orders discounted**, coupon shows `usedCount: 1`, 1 redemption. The same applies to `perUserLimit` from two tabs.
- **Root cause:** `createOrder` evaluates the coupon, places the order, then `redeemCoupon` fails the race and the failure is **swallowed** (by design, "the payment already succeeded").
- **Fix:** redeem (reserve) the coupon *before* placing the order, release it on failure. For COD/wallet no money has moved, so refusing is safe; for Razorpay, redeem before creating the Razorpay order.

### QA-009 · P1 · A partial refund marks the whole order REFUNDED, so later cancellations refund nothing
- **Steps:** one order with seller A (₹1,000) and seller B (₹600) lines, paid by Razorpay. `refund.processed` arrives for A's ₹1,000 return. Seller B then rejects their unshipped line.
- **Actual:** order `paymentStatus` = REFUNDED after the partial refund, and the buyer receives **₹0** of the ₹600 (`isRefundable` requires `PAID`).
- **Fix:** on `refund.processed`, track `refundedAmount` and only set REFUNDED when it reaches `total`. Otherwise keep PAID (or add PARTIALLY_REFUNDED and let `isRefundable` accept it).

### QA-010 · P1 · No brute-force protection on admin and seller password login
25 consecutive wrong passwords → 25 × 401, never throttled or locked. **Fix:** per-account and per-IP rate limit with progressive lockout on `/admin/auth/login` and `/vendor/auth/login`.

### QA-011 · P1 · OTP attempt cap resets on every resend; no resend cooldown
After 5 wrong guesses the OTP locks, but an immediate `send-otp` returns 200 and resets `attempts: 0`. Unlimited guessing in blocks of 5, plus SMS pumping cost. **Fix:** 30–60 s resend cooldown, a per-number hourly send cap, and a cumulative attempt counter that survives resends.

### QA-013 · P1 · Plaintext OTPs written to the server log in production
`console.log('[requestOtp] OTP for <number>: <otp>')` runs on every path. Anyone with PM2/log access can sign in as any customer. **Fix:** remove it, or gate it on `ENV !== 'production'`.

### QA-014 · P1 · Throughput collapses under mixed load
See §5. The main causes are unpaginated admin/seller lists, collection-scan aggregations, and pure-JS bcrypt on the OTP path.

---

## 5. Performance & load results

Isolated server (`tests/performance/perfServer.js`): 3,000 products, 20 sellers, 300 buyers, 6,000 historical orders. Mixed traffic: 55% browse, 15% cart, 10% login, 8% checkout, 7% seller, 5% admin. Closed model, no think time except soak, 10 s client timeout.

| Stage | VUs | Requests | RPS | Avg | P50 | P90 | P95 | P99 | Error rate (5xx+timeout) | Timeouts | Peak CPU* | Peak RSS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Baseline | 1 | 440 | 20.3 | 49 ms | 12 | 58 | 100 | 1,165 | 0% | 0 | 131% | 578 MB |
| Smoke | 10 | 1,052 | 29.8 | 297 ms | 57 | 424 | 1,918 | 3,081 | 0.4% | 4 | 190% | 1.2 GB |
| Normal | 50 | 2,272 | 32.3 | 1.5 s | 650 | 3,188 | 4,917 | 10,011 | 3.0% | 68 | 186% | 1.8 GB |
| Heavy | 100 | 2,041 | 29.1 | 3.3 s | 1,976 | 8,682 | 10,004 | 10,013 | 7.2% | 146 | 148% | 1.9 GB |
| Stress | 150 | 1,001 | 16.4 | 7.8 s | 9,355 | 10,014 | 10,016 | 10,029 | **48.7%** | 487 | 224% | 2.6 GB |
| Stress | 300 | 1,738 | 22.8 | 9.2 s | 10,010 | 10,067 | 10,219 | 10,302 | **76.5%** | 1,328 | 227% | 3.7 GB |
| Spike 10→300 | 300 | 2,330 | 43.3 | 5.7 s | 5,536 | 10,027 | 10,116 | 10,122 | 62.4% | 880 | 154% | 3.7 GB |
| Recovery | 10 | 538 | 26.2 | 374 ms | 71 | 583 | 2,882 | 4,863 | 0% | 0 | 130% | 3.7 GB |
| Soak 5 min | 50 | 8,060 | 26.1 | 1.8 s | 975 | 4,670 | 6,131 | 10,007 | 2.0% | 158 | 226% | 3.7 GB |

\* process CPU across threads (main + GC + libuv); 100% ≈ one core. Event-loop delay p99 was **1.6–2.0 s from 10 VUs upward**, which is the direct cause of the latency.

**Scenario isolation (50 VUs unless noted):**

| Scenario | RPS | P95 | Errors | Verdict |
|---|---|---|---|---|
| S1 browsing | **303** | 312 ms | 0% | healthy |
| S3 cart | 187 | 414 ms | 0% | healthy |
| S4 checkout | 47 | 1.4 s (p99 10 s) | 2.5% | slow placement |
| S2 OTP login | **11.7** | **5.9 s** | 0% | CPU-bound (bcrypt) |
| S7 seller dashboard (20) | — | orders p95 8.1 s | earnings timeouts 17% | full scans |
| S6 admin dashboard (10) | **1.1** | 10 s | **65%** | collapses |
| S5 hot product (100 buyers, 10 units) | — | 777 ms | — | **exactly 10 orders, stock 0** ✔ |

**Memory:** heap returns to ~190–270 MB after every burst, so **no leak**. The 3.7 GB RSS is a high-water mark caused by huge responses.

**Root causes (with evidence):**

| # | Finding | Evidence | Fix |
|---|---|---|---|
| a | `GET /admin/catalog/products` ignores pagination and returns the **entire catalogue** populated | 2.6 MB per call at 3k products; 100% timeouts under 10 admins | server-side pagination + counts via `countDocuments`/`$facet` |
| b | Admin analytics filter orders by `createdAt` range with no leading `createdAt` index, then `$lookup` per line | profiler: **COLLSCAN, ~1.0–1.4 s**, 9.3k docs examined for 1–24 results | index `{ createdAt: -1, status: 1 }`; denormalise `vendor` so the `$lookup` is unnecessary |
| c | Five seller aggregations `$unwind` **before** `$match {items.vendor}` (`vendorDashboardController:27`, `vendorAnalyticsController:12,24,38`, `vendorEarningsController:162`) | profiler: COLLSCAN per seller dashboard | add `{ $match: { 'items.vendor': vendorId } }` before the `$unwind` (uses the existing index) |
| d | `listMyOrders`, `listMyCoupons`, admin coupon/ticket lists load **all** rows then paginate in JS | seller orders p95 8.1 s | paginate in the query |
| e | OTP send/verify use **bcryptjs (pure JS) cost 10** on the main thread | login 11.7 RPS, event loop 2 s | hash 6-digit OTPs with HMAC-SHA256 + pepper (the attempt cap already limits guessing), or native `bcrypt` |
| f | Public search is an unanchored case-insensitive regex on `name`/`sku` | fine at 3k; COLLSCAN at scale | Atlas Search or a text index |

---

## 6. Medium & low findings

| ID | Sev | Finding | Fix |
|---|---|---|---|
| QA-005 | P2 | Sellers can set `isTrending` / `isFlashsale` on their own products (admin-only merchandising) | ignore these fields on vendor routes |
| QA-012 | P2 | `Idempotency-Key` is optional: a client without one double-places the same cart (web frontend does send it) | require it on `POST /user/orders`, or dedupe on cart hash + short window |
| QA-015 | P2 | Editing an APPROVED product (name, images, category, price) keeps it approved and live, so moderation can be bypassed | send material edits back to PENDING |
| QA-016 | P2 | Checkout is multi-step without a transaction: stock reserve → wallet debit → insert. A crash between steps leaks stock or wallet money | wrap in a Mongo transaction (replica set is already required) |
| QA-017 | P2 | Socket.io: any staff token joins the `admin` room regardless of permissions; refresh tokens accepted; account state never re-checked | derive rooms from permissions; reject `typ: refresh`; re-check account on connect |
| QA-020 | P2 | A deactivated Role still grants its permissions (`protectAdmin` ignores `Role.isActive`) | treat inactive role as no permissions |
| QA-021 | P2 | Ticket `?search=` builds `new RegExp(userInput)`: `(` → 500, catastrophic patterns can stall mongod | escape as `listPublicProducts` does |
| QA-024 | P2 | Test/prod divergence: `vendorProductController` relaxes SKU, weight and image validation when `NODE_ENV=test`, so tests never exercise production validation | remove the branches; give fixtures real values |
| QA-025 | P2 | Frontend: 19 MB of unoptimised banner/category JPG/PNG (600–850 KB each, with duplicates), 868 KB `routes` chunk (197 KB gz) | WebP/AVIF at 1–2× display size; split the routes chunk |
| QA-026 | P2 | Seller order view exposes buyer phone and full address before the seller accepts | business decision; consider revealing on acceptance |
| QA-019 | P3 | `/fcm-token` accepts a 30-day buyer refresh token | use `verifyAccessToken` in `protectAnyAccount` |
| QA-022 | P3 | Operator payload at admin login → unhandled 500 (safe, but should be 400) | type-check `email`/`password` |
| QA-023 | P3 | Production CORS rejection surfaces as HTTP 500 | return 403 from the CORS error |
| QA-027 | P3 | 14 handlers return raw `err.message` on 500, bypassing production masking | let the global handler format 500s |
| QA-028 | P3 | JSON-LD breadcrumb uses `dangerouslySetInnerHTML` + `JSON.stringify` (seller-controlled names). **Not exploitable in the SPA today**; becomes stored XSS if SSR/prerender is added | escape `<` as `<` |
| QA-029 | P3 | Vendor coupon lacks the `>100%` guard that admin coupons have (clamped, so harmless) | same validator |
| QA-030 | P3 | Test suite writes KYC PDFs into the real `backend/uploads/vendors/` | point uploads at a temp dir in tests |
| QA-031 | P3 | `jest-mongodb`'s shared `globalConfig.json` makes two concurrent `npm test` runs in one checkout kill each other's suites | run one suite at a time per checkout, or set a per-run `globalSetup` path |

---

## 7. Things verified correct (no action)

- Checkout total is always server-computed; `shippingFee`/`amount` from the client are ignored; Razorpay order amount = server total.
- Payment verification checks signature, `order_id`, `captured` status **and** exact amount; one payment cannot pay for two checkouts (unique index → 409, stock released); stock-out after capture auto-refunds.
- Stock reservation is an atomic conditional `$inc` per line/variant: 20→3, 10×2→5, and 100→10 races all ended exactly at 0, never negative; partial-cart failures roll back.
- Same-key idempotent submits (×5 parallel) produce one order; parallel cancels refund and restock once.
- Seller isolation on orders, lines, products, inventory, coupons, shipments; buyer isolation on orders, tickets, invoices, tracking.
- JWTs: audience-bound, `alg:none` rejected, expiry honoured with `TOKEN_EXPIRED`, refresh ≠ access on buyer routes; socket rooms come from the token, never the client.
- Webhooks: HMAC over raw body, constant-time compare, fail closed without secret, duplicate deliveries idempotent.
- Uploads: magic-byte sniffing, SVG refused, 40 MP decompression-bomb cap, 10 MB limit.
- `$`/`.` keys stripped from body/query/params; public search regex escaped; 10 kb body limit; helmet headers; no secrets in the frontend bundle (only public Razorpay key id and Firebase web config).

---

## 8. Blocked / not executed

| Item | Reason |
|---|---|
| Index verification on the live Atlas DB | Read-only query refused by the environment's production-read policy. **Action:** run `db.wallettransactions.getIndexes()` and `db.orders.getIndexes()` and confirm the unique `razorpayPaymentId` / `idempotencyKey` indexes exist (Mongoose `autoIndex` builds them silently and logs failures only as an event) |
| Browser E2E (Playwright/Cypress), cross-browser, device and network-throttling runs | No E2E tooling in the repo; it would need an isolated full stack (backend on memory DB + Vite). The API-level golden path is covered by `full-order-journey.test.js` plus the QA suites |
| Live Razorpay / Shiprocket / CJ sandbox calls | Needs sandbox credentials and accounts; covered with mocks only |
| PM2 restart behaviour | No PM2 ecosystem file in the repo |
| Staging/production load test | No staging URL; `tests/performance/k6-staging.js` is ready for one |

---

## 9. Regression plan & how to use the tests

```
cd backend
npm test                                   # full suite (don't run two at once in one checkout, QA-031)
npx jest tests/qa                          # QA suites only
node tests/performance/perfServer.js       # isolated load target on :5055
node tests/performance/loadRunner.js quick|full|scenarios|hot
```

**Known-bug workflow.** Each `[KNOWN BUG QA-xxx]` test is a `test.failing` that asserts the *correct* behaviour, so today it passes because the bug reproduces. When a fix lands, that test turns red: change `knownBug(` to `test(` and it becomes the permanent regression test.

**Fix order:** QA-007, QA-008, QA-001, QA-002 (P0, all small, localised changes) → QA-013, QA-011, QA-010 (auth hardening) → QA-006, QA-009, QA-003, QA-004 (money/marketplace integrity) → perf items a–e → P2/P3.

---

## 10. Production readiness checklist

- [ ] P0 fixed and their QA tests promoted (QA-001, 002, 007, 008)
- [ ] P1 fixed (QA-003, 004, 006, 009, 010, 011, 013)
- [ ] Live DB unique indexes confirmed (orders `razorpayPaymentId`/`idempotencyKey`, wallettransactions `razorpayPaymentId`, products `barcode`)
- [ ] Admin/seller list endpoints paginated in the query; `$match` before `$unwind`; `createdAt` index
- [ ] OTP hashing moved off pure-JS bcrypt; rate limits on auth endpoints
- [ ] `ENV=production` and `ALLOWED_ORIGINS` set on the server (CORS is fully open otherwise)
- [ ] Staging load test with k6 meets p95 < 800 ms at expected peak
- [ ] Browser E2E golden path added for checkout
- [x] Payment verification, stock atomicity, idempotency, seller isolation, webhook signing

---

## 11. Fix log (2026-09-29)

| ID | Fix | Regression tests |
|---|---|---|
| QA-007 | `/topup/order` records a PENDING top-up; `verifyTopup` claims it and credits the wallet in one transaction. Replays credit nothing | `payments-razorpay.test.js`: sequential + 6× parallel replay |
| QA-008 | A payment is creditable only against a top-up the same buyer opened, so order payments and other buyers' top-ups are refused | same file: order payment → wallet, buyer B → buyer A's top-up |
| QA-001 | `requirePermission` on coupons (`marketing.coupons`), settings (`settings.view` / `settings.manage`), accounts (`accounting.view` / `payout.manage` / `accounting.post`), CMS and FAQ (`banners` or `manage` / `marketing.manage`). Accounts menu now permission-gated in the admin nav | `rbac-auth.test.js` + positive controls |
| QA-020 | A deactivated role grants nothing (middleware and login payload) | `rbac-auth.test.js` (off → 403, back on → 200) |
| QA-002 / 021 | Guest list keeps the id filter under `$and` and excludes seller tickets; seller tickets are never "guest" in `canAccessTicket`; guest counts scoped; all three ticket searches escaped | `support-tickets-isolation.test.js` |
| QA-013 | In production the OTP is never logged (masked number only) | `security-hardening.test.js` (production-mode controller) |
| QA-011 | 30 s resend cooldown and 5 codes per number per hour (atomic, `Retry-After`); attempt counter reserved atomically, so parallel guesses lock at 5; code consumed atomically. Reviewer/QA bypass numbers exempt. OTP hashing moved from bcryptjs to HMAC-SHA256 (old bcrypt hashes still verify) | cooldown, parallel resend, hourly cap, 20 parallel guesses, single-use |
| QA-010 / 022 | Per-account sign-in limit for admin and seller (5 attempts / 15 min, then a 15 min lock; reserved before the password check; unknown emails treated the same; cleared on success or password reset). Non-string credentials → 400 | 6 tests incl. 30-guess parallel burst |
| QA-006 | Coupon redeemed against a pre-generated order id **before** stock, wallet or order are touched; released on every failure path; Razorpay payment auto-refunded if the coupon is gone | 8-buyer race → 1 discounted; release on stock-out and wallet shortfall |
| QA-009 | `refund.processed` marks REFUNDED only when refunds cover the order total | partial, full, accumulated |
| QA-004 | `Product.vendorSuspended`, maintained by a Vendor save hook and set at creation; filtered in listing, detail, related, category counts, cart, checkout, reorder and wishlist. **Run `node backfill-vendor-suspended.js` (dry run) then `--apply` on live** | suspend / restore / approve round-trip, cart → checkout 409 |
| QA-003 | Business decision: **payout hold**. Order lines record `deliveryConfirmedBy` (CARRIER / ADMIN / SELLER). A seller's own DELIVERED shows as delivered but is excluded from settlement until the carrier sync or an admin confirms it. Admin: "Delivery unconfirmed" tab + "Confirm delivery" row action on Sub-orders. Older lines (no value) stay settleable | `multi-vendor-isolation.test.js`: hold, admin confirm (once), carrier confirm, admin order-level delivery, legacy lines |
| QA-005 | Business decision: **admin only**. Seller create/update ignore `isFlashsale` / `isTrending`; toggles removed from the seller product modals | same file |
| QA-015 | Business decision: **re-approval on name / photos / category**. Such edits to an APPROVED product set it PENDING and hide it (unless auto-approval is on); price/stock edits stay live. Approval now keeps a seller-set Inactive product off | same file: each field, price/stock, no-op save, auto-approval, re-approve |
| Perf | Admin product list paged on the server (frontend updated); admin order list and seller order list paged in Mongo (seller status derived in the pipeline, pinned to the serializer); `$match` before `$unwind` in 5 seller pipelines; `orders.createdAt` index; 30 s coalescing cache on dashboard and analytics; config read no longer an upsert | `admin-product-paging`, `order-list-paging`, `analytics-cache` |

**Load test after the fixes (same isolated setup):**

| Scenario | Req/s before → after | p95 before → after | Errors before → after |
|---|---|---|---|
| OTP login (50) | 11.7 → **397** | 5.9 s → **180 ms** | 0 → 0 |
| Admin dashboard (10) | 1.1 → **139.6** | 10 s → **118 ms** | 65% → **0%** |
| Seller dashboard (20) | 8.7 → **59.6–68.5** | 9.4 s → **0.4–1.8 s** | 4.2% → 0–0.4% |
| Checkout (50, warm) | 46.9 → **104** | 1.4 s → **0.89 s** | 2.5% → **0%** |

**Still open:** seller earnings summary re-prices commission per unsettled order (p99 ~4.5 s at 20 sellers); frontend image weight; P2/P3 list in §6; live index check (§8).

---

## 12. Round 2 (2026-09-29): P2 fixes and browser E2E

**Fixed**

| ID | Fix | Tests |
|---|---|---|
| QA-012 | COD and wallet checkouts without an `Idempotency-Key` get a server key from the **cart version** (items + `updatedAt`) + address + method + coupon. A double-tap places one order; buying the same item again seconds later is a new order. Razorpay excluded (payment id already unique; a replay stays a hard 409) | `concurrency-inventory-coupons.test.js` |
| QA-016 | Stock reservation, wallet debit, orders, wallet ledger row and cart-clear run in **one MongoDB transaction**; the hand-written undo code is gone. "Order placed" WhatsApp is sent after commit (the insert hook stays quiet inside a transaction). Load: checkout 76 req/s at 50 users, 0 errors; hot-product race still exact (10 of 100) | `checkout-transaction.test.js`: failure injected after each step → nothing written; retry succeeds |
| QA-003 (UI) | The admin "Confirm delivery" action was unreachable (the Sub-orders list route redirects to Orders). Now: **Orders → "Delivery unconfirmed" tab**, and a **Confirm delivery** button on each seller-marked line in the order detail | E2E `admin-panel.spec.js` |
| QA-032 (new, P1) | Seller login page pre-filled the demo seller password in production builds, and the password was in the shipped JS. Now dev-server only (`import.meta.env.DEV`); verified absent from `vite build` output | bundle grep |
| QA-034 (new, P2) | Seller order dialog kept showing the old status after "Start Processing" and offered the same action again. Now shows the order the server returns | E2E `seller-fulfilment.spec.js` |
| QA-035 (new, P2) | A wrong admin/seller password (or OTP) showed "Your session has expired". A 401 from a sign-in call, or from an unauthenticated request, now passes the server's message through | E2E |
| QA-036 (new, P1) | Buyer OTP boxes lost a digit when two arrived before a re-render (fast typing, SMS auto-fill); the 5-digit code never submitted and the buyer was stuck. Next code is built from a synchronously updated ref | E2E (fast fill), 2 clean runs |

**Open — needs your decision**

| ID | Finding |
|---|---|
| QA-037 (P0 if live) — **fixed 2026-09-29 (owner: dev-only)** | The **admin** login page pre-fills `admin@example.com` / the super-admin password, which equals `ADMIN_EMAIL`/`ADMIN_PASSWORD` in `backend/.env`, and it is in the public JS bundle. A code comment records this as the owner's deliberate demo choice (commit `c056644`), "remove before any real deployment". If the live admin was bootstrapped from that `.env`, the live admin password is public. Now pre-filled under the Vite dev server only; verified absent from `vite build` output. **Still to do by the owner: change the live admin password**, since it has already shipped in earlier builds. |
| QA-033 (P2) | ~29 admin service functions have no backend (finance vouchers/COA/trial balance/tax centre/statements/expenses, invoices, offers, templates, policy acceptances, shell summary, 2FA verify, supplier sync, dropship products) and show **fixture data** whenever the build does not set `VITE_USE_MOCKS=false` — including the sidebar summary counts |
| QA-038 (P3) | Mobile product page has no header/cart link (cart reachable from Home only) |

**Browser E2E (new, `e2e/`)** — Playwright 1.63.0 (pinned), isolated stack (in-memory DB backend on :5056 + Vite on :5174, every other origin refused), desktop and Pixel 7 viewports:

| Spec | Covers |
|---|---|
| `buyer-checkout.spec.js` | OTP sign-in → product → cart → new address → summary → COD → My Orders; stock moved; guest redirect; invalid coupon; mobile cart entry |
| `seller-fulfilment.spec.js` | Processing → Shipped (manual AWB) → Delivered with live dialog; lands in admin unconfirmed queue; seller isolation; wrong password message |
| `admin-panel.spec.js` | Confirm a seller-declared delivery from the order screen; product list server paging + search |

Run: `cd e2e && npx playwright test` (starts both servers itself). Result: **34 passed / 0 failed, ×2 runs**.

---

## 13. Round 3 (2026-09-29): E2E coverage, admin modules, small fixes

**New browser E2E**

| Spec | Covers |
|---|---|
| `buyer-after-delivery.spec.js` | Review (4 stars, HTML payload stays text on the product page); refund claim for a delivered item |
| `buyer-discovery.spec.js` | Search by name / SKU / nonsense; "Price: low to high"; wishlist |
| `catalog-approval.spec.js` | Seller lists a product with a real image upload → PENDING and hidden → admin "Skip & approve" → live |
| `admin-smoke.spec.js` | Every admin sidebar module (42) opens without error screen, page error or unexpected API error |
| `admin-staff-permissions.spec.js` | Support-only staff: sidebar shows only Support; coupons / settings / ledger URLs get no data (403) |
| `coupon-end-to-end.spec.js` | Admin creates a ₹100 flat coupon in the UI → buyer applies it → order placed ₹100 less; usedCount 1 |

Totals: **E2E 32 passed / 0 failed** (6 skipped = desktop-only specs on mobile and vice versa). **Backend 64 suites / 850 tests, 0 failed.**

**Fixed**

| ID | Fix |
|---|---|
| QA-033 (part) | `GET /admin/shell-summary` built for real (sidebar counts + tray from actual pending work, scoped to the caller's permissions); the invented fixture alerts are gone. The admin smoke test found it 404-ing on every admin page. |
| QA-017 | Socket handshake: refresh tokens, deleted/deactivated accounts and suspended sellers refused; staff join the admin feed only with `admin.dashboard.view` |
| QA-019 | `/fcm-token` refuses refresh tokens |
| QA-023 | Refused CORS origin → 403 |
| QA-024 | Test-mode shortcuts removed from both product-create endpoints (SKU / weight / image required under test as in production) |
| QA-025 | `frontend/public/images` recompressed in place, same names and formats: 17.2 MB → 2.1 MB; `dist` 23 MB → 7.6 MB |
| QA-027 | 14 handlers no longer echo raw errors on 500 (`utils/sendServerError`: validation → 400 with reason, else generic 500 + log) |
| QA-028 | JSON-LD escaped (`toJsonLd`), verified against a `</script>` payload |
| QA-029 | Seller percentage coupons capped at 100% |
| QA-030 | `UPLOADS_DIR` (Config/uploads.js); jest and the E2E server write to temp folders |
| QA-031 | `globalConfig.json` untracked and ignored (concurrent jest runs in one checkout still clash — run one at a time) |
| A11y | Review screen: named rating stars (`aria-pressed`), back / add-photo buttons, review textbox, product select label |

**Open**

| ID | Item |
|---|---|
| QA-033 | Invoices and ~27 other admin screens still have no backend (owner's decision) |
| QA-026 | Seller sees buyer phone/address before accepting (owner's decision) |
| QA-038 | Mobile product page has no cart link (UX decision) |
| Perf | Seller earnings summary re-prices commission per unsettled order (money code — needs a careful rewrite) |
| A11y | Seller product form fields have placeholders but no labels |
| Housekeeping | 7 duplicate images (`*_1787…jpg`) unreferenced in code — may still be referenced from the live DB, so not deleted. 29 untracked files in `backend/uploads/` from test runs before QA-030 (mixed in the same folder as the dev server's real uploads, so left for the owner to review) |

---

## 14. Round 4 (2026-09-29): remaining engineering items

| Item | Change | Verified by |
|---|---|---|
| Sub-orders leftovers | The unreachable "Delivery unconfirmed" tab / "Confirm delivery" action added to the hidden Sub-orders page (QA-003) removed: the three frontend files are back to their pre-audit version, and the backend `unconfirmed` sub-order tab is gone. The admin confirms deliveries from **Orders → Delivery unconfirmed** and the order detail page, as before. No sidebar menu or route was added at any point in the audit (checked with git against the pre-audit commit). | Tests retargeted to the Orders queue |
| Seller earnings summary | Coupons for all orders needing an estimate are read in one query, and orders are priced up to 8 at a time. Output unchanged: `tests/qa/earnings-equivalence.test.js` runs the ORIGINAL implementation (copied verbatim) and the new one on a dataset covering ledger-posted, estimated, legacy (no snapshot), seller- and platform-funded coupon, multi-seller and batch-claimed lines — identical rows. On load-test data (all legacy orders) the gain is small, p95 ≈ 3.75 s at 20 sellers, because legacy lines still look up commission rules per order date; orders placed since the commission snapshot (2026-09-25) need no per-order query. Batching rule lookups across order dates would touch commission resolution and was not done without the owner. | Equivalence test; load run |
| Form labels (a11y) | Shared `Input` / `Select` / `Textarea` generate an id when none is passed, so every label is linked to its field across the app (seller product form, seller order dialog, …) | E2E fills the seller product form by label; the seller dialog's fields are now named "Tracking number" / "Courier (optional)" |

**Totals:** backend **65 suites / 851 tests, 0 failed**; browser E2E **32 passed, 0 failed** (6 skipped by design); admin smoke 42 modules clean; frontend build OK.

**Left for the owner:** change the live admin password; commit; review 29 old test files in `backend/uploads/`; check live DB indexes; decide QA-033 (admin screens without backend), QA-026 (buyer contact before acceptance), QA-038 (mobile cart link); optionally, batching legacy commission lookups for the earnings summary.

---

## 15. Owner decisions (2026-09-29)

| ID | Decision | Result |
|---|---|---|
| QA-026 | Seller keeps seeing buyer phone and address before accepting — **by design** | Closed, no change |
| QA-038 | Add a cart link on the mobile product page | **Fixed:** cart button with item badge next to Share in the mobile top bar (same look as the web header), opens the existing cart page — no new route or menu. E2E: add to cart → badge "1" → cart opens with the product (mobile) |
| QA-033 | Remove the admin screens that are not in the sidebar and have no backend | **Done** — see §16 and §17 (Invoices built; all unlinked screens removed) |

## 16. QA-033: unlinked admin screens removed (2026-09-29)

Removed: Pricing rules, Chart of accounts, Journal vouchers, Expenses, Trial balance, P&L, Balance sheet, Cash flow, Tax centre, legacy Dropshipping (overview, partners, products, orders, margins), Supplier sync, Policy acceptances, Offers, Templates, and the Two-factor page. None of them was in the sidebar, the command palette (which reads the sidebar), or linked from a reachable screen; all ran on fixtures only.

For each screen the route, route constant, page, controller hook, service call, fixture, schema, table columns and components were deleted, down to helpers only they used (29 files deleted). Their URLs now show the panel's Not found page.

Kept on purpose: Invoice detail (opened from Invoices, which is in the sidebar) and Vendor statement (opened from Vendor ledgers). The dropshipping partner drawer stays because the Sellers screen uses it.

Verified: `vite build` OK; lint shows nothing new; admin E2E (sidebar smoke over every module, admin panel, staff permissions) 7 passed / 3 skipped by design.

## 17. QA-033 round 2: Invoices built, all remaining unlinked screens removed (2026-09-29)

Owner decisions: build the Invoices backend; remove every admin screen that is not reachable from the sidebar.

**Invoices (Orders → Invoices) now run on the real backend.**
- `GET /admin/invoices` (paged; tabs *All / Krozenda is seller / Vendor is seller / Inter-state*; search by invoice number, order, buyer or seller) and `GET /admin/invoices/:id`, in `Controllers/adminInvoiceController.js`. Access: `admin.orders.invoices` or `admin.orders.view`, the same rule the sidebar uses.
- Invoices are not stored. They are derived by `services/invoiceService` — the same code behind the buyer's own invoice — so admin and buyer figures cannot differ. There is one invoice per supplier on an order.
- An order is invoiced once it is a real supply: not cancelled, payment not failed, and paid unless it is COD.
- Listing never freezes supplier details; opening an invoice does, exactly like the buyer opening theirs.
- `invoiceService` was split into a bulk, read-only supplier loader and a pure `composeInvoices`, so the list fetches platform settings and sellers once for all orders.
- Bug fixed on the way: an order whose only platform charge was the platform fee (no delivery fee, only seller lines) produced a Krozenda invoice with no supplier, printed as "Seller". The platform is now included whenever there is a platform fee.
- The invoice screen no longer shows hard-coded content:
  - "Paid (Online Verified)" → the real payment state
  - "State: Maharashtra (27)" → the supplier's state
  - a fixed "IGST 18% / CGST 9%" → per-line rates and summed amounts
  - "Shipping: Free / Included" → the actual delivery charge and platform fee
  - "Registered Seller" / "VERIFIED DOCUMENT" → removed
  - A supplier without a GSTIN now shows a **Bill of Supply** with no tax.
- The unused invoice "void" chain and the invoice fixtures were removed.
- Tests: `tests/qa/admin-invoices.test.js` (9 tests: parity with the buyer invoice, eligibility, tabs, paging, no freeze on list, detail, platform-fee fix, bad ids, permissions). E2E: a placed COD order appears under Invoices and its tax invoice opens (desktop and mobile). The admin smoke no longer tolerates `/admin/invoices` 404.

**Unreachable screens removed.** Reachability was computed from the sidebar, settings sub-menu, shell and auth pages, following every link in the pages and components they render (fixture/mock links excluded), then checked by hand.

Removed:
- the Accounting module (13 screens)
- legacy Finance: overview, transactions, refunds, settlements, settlement batch, vendor ledgers, vendor statement
- Attributes
- Sub-order detail and the old Sub-orders, Cancellations, RTO and Shipments lists
- Carrier accounts
- Report runner
- Policies, Notifications and API & webhooks settings
- the Showcase index and the empty placeholder-route mechanism
- alias routes: B2B buyers, Partners, Companies and Channel partners, which reused the Customers/Sellers screens
- the old redirect-only URLs

Their controllers, services, schemas, fixtures, columns, components and constants went with them. An iterative dead-code pass removed anything no remaining file used: 42 more files and about 12,600 lines in total across both rounds.

Seller payouts are unaffected: they run from `Jobs/settlementAutomationJob.js`, and none of the removed screens was in that path. Backend endpoints were left as they are.

**Kept, awaiting the owner:**
- `/admin/settings/logistics` is the only UI that turns shipping on and picks the courier strategy. The backend's "enable it in Shipping Settings" message points there.
- `/admin/finance/commission-rules` is the only UI that changes a seller's commission after KYC approval.

Neither is in the sidebar today. The owner should choose between adding each to the Settings sub-menu and deleting it.

Verified: `vite build` OK; no new lint errors (one latent `no-undef` disappeared with dead code); reachability re-run shows only the two kept screens; admin E2E 9 passed / 3 skipped by design (smoke: 43 sidebar modules, 0 problems); backend invoice, RBAC, security, shell and money suites 99/99.

## 18. Category import (owner request, 2026-09-30)

Catalog → Categories now has an **Import** button next to *Add Category*. The button is disabled in seller-only mode, like *Add Category*.

**How it works:**
- The admin uploads a CSV. A template can be downloaded from the dialog.
- The server checks every row in a dry run, and the dialog previews each row as *Will be created*, *Skipped* or *Error* with the reason.
- Nothing is written until the admin confirms.

**CSV columns:**
- `name` (required)
- `active`, `top_category`, `food`: yes/no, y/n, true/false or 1/0. A blank cell takes the create form's default: active yes, the other two no.
- `commission_type` (PERCENTAGE or FIXED) with `commission_value`: optional.

**Rules** (the same as the create form, plus import-specific ones):
- Seller-only mode is refused.
- Commission uses the same limits and permission as the create form. A staff member without the commission permission gets an error on those rows only.
- Names already in the catalogue, or repeated in the file, are skipped. The match ignores case and extra spaces, so running the same file twice creates nothing twice.
- A file can have at most 500 rows, and a name at most 100 characters.
- Images are not imported. Add them from each category afterwards.

**Backend:** `POST /admin/catalog/categories/import` (`{ rows, dryRun }`), behind `admin.catalog.categories`. That path alone gets a 128kb JSON limit, the same exception `/translate` already has. Every other route stays at 10kb.

**Tests:**
- `tests/qa/category-import.test.js`, 7 tests: dry run writes nothing, flags and commission, re-run skips, bad rows, 300/501 rows, seller-only mode, permissions.
- E2E on desktop and mobile: upload, preview, import, the category appears in the list, and a second upload of the same file skips both rows.
- Admin smoke: 0 problems.

## 19. Sidebar audit — admin and seller (2026-09-30)

A new crawl E2E (`e2e/tests/panel-crawl.spec.js`, helper `crawl.js`) signs in and opens every screen reachable by clicking: the sidebar, settings sub-menus, tabs and detail pages, one per route pattern. Each screen must show no error state, throw no page error and get no unexpected 4xx/5xx. A code scan looked for handler-less buttons, inert inputs and fixture data.

- **Seller:** all 20 sidebar modules clean. Every seller service is live (no fixtures), and there are no inert controls and no hard-coded figures.
- **Admin:** 41 sidebar modules, 47 screens in all. One problem remains: Settings → *Commission & business rules* (no backend; see below).

Fixed now (owner-approved):
- **Mocks default off** (`src/config/env.js`). Fixtures load only when `VITE_USE_MOCKS=true` is set explicitly. Before this, an unset variable meant mocks on, so a screen with no backend showed invented data instead of its error state.
- **Customers:**
  - The bulk *Export selected* action now downloads the selected rows. It was a no-op.
  - *Send campaign* and *Block* were removed from the bulk bar; they had no backend. The per-row Block/Unblock is real and stays.
- **Integration health:**
  - *Re-check now* re-reads the server's integration configuration.
  - The per-card *Configure* buttons were removed; they did nothing.
- **Backups:** *Test a restore* was removed; it did nothing.

E2E: an export-selected and re-check test was added to `admin-panel.spec.js` (5/5 pass). The seller crawl passes.

Open, awaiting the owner:
- **Settings → Commission & business rules.** It has no backend: the page 404s, or shows fixtures with mocks on. Its inputs are inert. The real commission and GST settings already live under Settings → General → Commission & GST. Remove the page, or build it?
- **My profile** (topbar). There is no `GET /admin/profile`, and Change password, End session and the notification switches are inert. A "General & Profile" tab exists under Settings → General. Build the backend, or point the topbar there and remove the page?
- The admin crawl fails until the business-rules decision is made.

## 20. Business rules and My profile built (owner decision "build both", 2026-09-30)

**Settings → Commission & business rules** is now a real form over the accounting policy the system already enforces: `GET/PATCH /admin/accounting/config` (AccountingConfig).

- Sections:
  - **Commission:** limit and base.
  - **Payment gateway fee:** % plus fixed amount, and who pays it.
  - **Delivery charge:** who keeps it.
  - **Settlement:** hold after delivery, and whether to wait for COD cash.
  - **Seller payouts:** automatic or manual, and the extra wait before paying.
- Every field is read by the ledger, settlement or the payout jobs. No invented figures remain: the old 15% commission, weekly schedule, IMPS, maker-checker and "changed from" notes are gone.
- Only changed fields are sent. The save writes the existing audit entry `ACCOUNTING_CONFIG_UPDATED`.
- The default commission rate stays under General → Commission & GST, which writes the same record.
- The return window (7 days, set in code) is shown read-only. The page warns when the settlement hold is shorter than the return window.
- Staff without `admin.accounting.commission.manage` see the rules read-only. Reading needs `admin.accounting.view`.

**My profile** (topbar) reads `GET /admin/auth/me`:
- Name, email and mobile can be edited, and the photo changed, via `PUT /admin/auth/profile`. The topbar updates at once.
- The password can be changed via `PUT /admin/auth/change-password`.
- The fixture sections were removed rather than faked: sessions, notification preferences and the two-factor badge. Nothing stores sessions (JWT) or preferences.

**Security fixes found on the way** (`adminAuthController.changePassword`):
- The current password was only checked *if it was sent*, so a stolen session token alone could set a new password. It is now required whenever the account has a password.
- Wrong current-password guesses now share the account's sign-in throttle (5 per 15 min, then a lock), so a token cannot be used to brute-force the password.

**Tests:**
- Backend `tests/qa/admin-profile-rules.test.js`, 6 tests:
  - config payload and return window
  - save and bounds
  - view/manage permissions
  - `me` has no password
  - the current password is required
  - guesses are throttled
- The audit-log suite still passes.
- E2E: *business rules survive a reload* (plus the hold-vs-return warning) passes.
