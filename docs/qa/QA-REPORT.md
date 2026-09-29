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
