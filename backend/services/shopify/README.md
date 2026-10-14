# Shopify integration — operator guide

Krozenda sells products that live in a Shopify store, which dropshipping apps
(vFulfill, Dropship India) stock and fulfil.

**The money never touches Shopify.** The buyer pays Krozenda through Krozenda's
own Razorpay account. The Shopify order is created *already paid*, purely so
the dropshipping app sees a paid order and ships it. Shopify charges nobody.

```
buyer → pays Krozenda (Razorpay)
      → order held for the cancel window (default 15 min)
      → pushed to Shopify as PAID, one order PER SUPPLIER
      → vFulfill / Dropship India fulfils its own order
      → tracking + delivery status come back by webhook
```

---

## Setting up webhooks (do this once)

Without webhooks the integration is **one-way**. Orders reach your supplier,
but tracking numbers, delivery updates, cancellations and stock changes never
come back — orders sit at "PENDING" forever even after the parcel arrives.

### 1. Get a public HTTPS address for this server

Shopify sends webhooks **to** your server, so it must be reachable from the
internet. `localhost` will not work, and the admin screen refuses it rather
than registering something undeliverable.

**Production** — whatever your API is deployed at:

```
https://api.krozenda.com
```

**Local development** — open a tunnel and use the address it prints:

```bash
npx ngrok http 5000
# → Forwarding  https://a1b2-49-36-22-7.ngrok-free.app -> http://localhost:5000
```

The tunnel URL changes every restart, so re-register after restarting ngrok.

### 2. Register from the admin panel

**Admin → Dropshipping → Orders & delivery → Updates from Shopify**

Paste the address (just the origin, no path) and press **Subscribe**. Krozenda
appends `/webhook/shopify` itself.

The badge turns **Receiving updates** when all ten topics are subscribed.

### 3. Confirm it worked

The panel lists the subscriptions. All ten should be present:

| Topic | What it gives you |
|---|---|
| `FULFILLMENTS_CREATE` / `FULFILLMENTS_UPDATE` | tracking number and courier |
| `ORDERS_FULFILLED` / `ORDERS_PARTIALLY_FULFILLED` | shipped status |
| `ORDERS_UPDATED` | general status changes |
| `ORDERS_CANCELLED` | supplier cancelled — raises an urgent admin alert |
| `PRODUCTS_UPDATE` / `PRODUCTS_DELETE` | title, status, variants |
| `INVENTORY_LEVELS_UPDATE` | stock, so you do not oversell |
| `APP_UNINSTALLED` | stops the push job retrying into a dead connection |

### 4. Test it end to end

1. **Admin → Dropshipping → Orders & delivery**, switch **test orders** on.
2. Place an order on the storefront.
3. Press **Send due orders now** instead of waiting out the cancel window.
4. The push row should go **PUSHED** with a Shopify order number.
5. In Shopify, mark the order fulfilled with any tracking number.
6. Within seconds the Krozenda order should show that tracking number.
7. **Switch test orders back off.**

### If nothing arrives

- Is the address still reachable? An ngrok tunnel dies when the terminal does.
- `SHOPIFY_CLIENT_SECRET` in `.env` must match the app's **current** secret.
  The webhook signature is checked against it, and a rotated secret makes
  every push fail with a 401.
- Shopify retries for about 48 hours, then **deletes the subscription**. If the
  server was down that long, press Subscribe again.
- The 15-minute sync job is the safety net: stock and status are re-read even
  when webhooks were missed. It is a fallback, not a replacement.

---

## Environment

```bash
SHOPIFY_SHOP_DOMAIN=krozenda.myshopify.com
SHOPIFY_CLIENT_ID=...          # Dev Dashboard → app → Settings
SHOPIFY_CLIENT_SECRET=...      # also the webhook signing key
SHOPIFY_API_VERSION=2026-10    # pinned; bump deliberately each quarter
SHOPIFY_RATE_PLAN=STANDARD     # STANDARD | ADVANCED | PLUS

BACKEND_URL=https://api.krozenda.com   # default webhook address

# Optional
SHOPIFY_ORDER_PUSH_CRON=* * * * *      # how often paid orders are sent
SHOPIFY_SYNC_CRON=*/15 * * * *         # stock re-read
SHOPIFY_PUSH_MAX_ATTEMPTS=6
SHOPIFY_RECONCILE_DELAY_MS=120000      # see "ambiguous outcomes" below
SHOPIFY_DISABLE_OUTBOUND=false         # global dry run
```

There is **no access token to copy**. Shopify stopped issuing permanent
`shpat_` tokens to new apps on 2026-01-01; the client id and secret are
exchanged for a 24-hour token that the backend refreshes on its own.

Also required: `RAZORPAY_WEBHOOK_SECRET`, from the Razorpay dashboard. Without
it the payment webhook fails closed and captured-payment reconciliation does
not run.

---

## Things that are the way they are for a reason

**One Shopify order per supplier.** Several dropshipping apps watch the same
store. One order holding two suppliers' lines can be fulfilled by both — two
parcels shipped and billed for one sale. Each supplier gets its own order
containing only its own lines. The buyer still sees one Krozenda order.

**Delivery is apportioned, not duplicated.** Each supplier's order carries its
share of the delivery fee by goods value, with the remainder on the last one,
so the parts sum to exactly what the buyer paid.

**An ambiguous push is parked, not retried.** If `orderCreate` times out, the
order may or may not exist at Shopify. Shopify's order search index lags its
writes by about ten seconds (measured), so looking immediately answers "no" for
an order that exists — and retrying on that answer bills the supplier twice.
Such a push goes to `NEEDS_RECONCILE` and is checked after two minutes.

**The push row is written inside the checkout transaction.** Outside it, a
rollback could leave a supplier order for a sale that never happened, or a
commit could lose the push and leave a paid order nobody ships.

**Buyer cancellation is all-or-nothing.** An order can only be cancelled while
*every* supplier's push is still unsent. Once one has gone, a parcel is on its
way and refunding would lose the money and the goods.

**Krozenda never pushes stock for imported products.** The Shopify order it
creates is itself the single decrement. Pushing a quantity as well would
double-count the same sale.

**Buyer apps are told `STANDARD`, not `SHOPIFY`.** Their response schemas
enumerate the fulfilment type and would fail to parse an unknown value, and
their `isDropship` flag renders "cannot be cancelled or returned" — which is
false here. See `utils/buyerFulfillment.js`.

---

## Where to look when something is wrong

| Symptom | Where |
|---|---|
| Order paid, supplier never got it | **Orders & delivery** → status `FAILED` / `ABANDONED` → Retry |
| Order stuck "SCHEDULED" past its time | the push cron is not running → **Send due orders now** |
| No tracking ever appears | webhooks not subscribed → **Updates from Shopify** |
| Stock wrong / overselling | **Sync stock now**; check `INVENTORY_LEVELS_UPDATE` is subscribed |
| Buyer cannot pay at all | online payment switched off in payment settings — supplier-shipped carts are online-only |
| Money looks wrong | **Payment exceptions** — each state is listed with its remedy |

Structured logs are JSON on stdout with `"scope":"SHOPIFY"`, `"SHOPIFY_PUSH"`,
`"SHOPIFY_WEBHOOK"` or `"SHOPIFY_SYNC"`.
