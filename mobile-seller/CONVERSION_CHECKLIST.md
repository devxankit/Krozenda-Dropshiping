# Conversion checklist — Krozenda Seller

Inputs (see MEMORY.md §2): app "Krozenda Seller", package `com.krozenda.seller`, API `https://krozenda.com/api`.
Per-area detail (API calls, native replacements, status per row) is in `checklist/*.md`:
`auth.md`, `dashboard-finance.md`, `catalog.md`, `orders-shipping.md`, `misc.md`, `kit-ui.md`, `kit-admin.md`.

## Screens (web route → native)
| Web route (`/seller/…`) | Native route | Status |
|---|---|---|
| login, register | `/login`, `/register` | Built, not tested (login API Verified via curl; register/reset not run on live DB) |
| status (onboarding) | `/status` | Built, not tested |
| dashboard | `/dashboard` | Built, not tested (GET shapes Verified) |
| products, inventory | `/products`, `/inventory` | Built, not tested (product create/update/stock/delete Verified by curl with a test product, removed) |
| categories, brands | `/categories`, `/brands` | Built, not tested |
| orders, shipping, shipping/settings | `/orders`, `/shipping`, `/shipping/settings` | Built, not tested (demo account has no orders/shipments; mutations never run) |
| customers, coupons, returns, reviews | same | Built, not tested (coupon create/delete Verified by curl) |
| earnings, analytics, revenue, reports | same | Built, not tested |
| tickets (+ tutorials tab), notifications | same | Built, not tested; tutorials route not deployed on live server → Blocked until backend deploy |
| profile, kyc-documents, settings | same | Built, not tested (KYC upload Verified by curl, removed) |
| `products/import` | redirect on web; CSV import is a modal on Products | Built |

Shell: topbar, bottom nav (Home/Orders/Products/Earnings/More), drawer, onboarding gate, realtime socket, push refresh — Built, not tested.

## Flutter wrapper capabilities
| Capability | Carried over as | Status |
|---|---|---|
| Push (FCM) + order ringtone channel | expo-notifications, channel `webview_notifications` MAX + `order_ringtone` | Built, not tested |
| Foreground push display | toast + list refresh | Built, not tested |
| Tap on notification / closed app | `data.link` → in-app route | Built, not tested |
| In-app update (forced) | Play IMMEDIATE flow on launch + resume | Built, not tested (Play-installed only) |
| Exit dialog on root back | `ExitDialog` | Built, not tested |
| Camera / files / downloads | expo-camera, pickers, file-system + share | Built, not tested |
| Splash, icon | `assets/splashLogo.png`, `assets/logo.png` | Built, not tested |
| Location, mic, background service | NOT used by the web seller panel → not requested | n/a |

## Unreachable on web / left out (confirm)
Admin-only branches in ShipmentDrawer, `VendorStatsGrid` (rendered nowhere), desktop dashboard branch, partner (`/partner`) panel, admin panel, buyer app, dropshipping-partner login demo branch, `ImportBatchReview`/`ProductImportWorkspace` (admin).

## Images replaced
None.

## Test login (not in app code)
`b2c.demo@krozenda.com` / `b2b.demo@krozenda.com` — live DB; password in `backend/Router/seedVendors.js`.

## Device test list
1. Install release APK on a clean phone; check icon + splash.
2. Login (B2C and B2B), wrong password message, forgot-password flow.
3. Close and reopen the app (still logged in); background and resume; open with no network (offline banner, retry on screens).
4. Bottom nav tabs, More drawer (all 22 entries; locked ones for unapproved sellers), top-right account menu, language switch.
5. Dashboard, Orders (tabs, filters, drawer, accept/reject/ship on a real test order), Shipping (create shipment, AWB, label download/share), Shipping settings.
6. Products: list, search, add (images from gallery/camera, variants), edit, stock update, barcode view/download/scan (camera permission), CSV import.
7. Categories/Brands/Coupons/Returns/Reviews/Tickets/Customers; KYC upload (camera + document), store profile, settings.
8. Earnings/Revenue/Reports (CSV export + share), Analytics charts.
9. Push: new-order push in background and foreground (ringtone, tap opens the screen); logout stops pushes.
10. Session expiry (expired token → login); Android back button (closes sheets first, root → exit dialog, never logs out).
11. Forced update (after uploading a higher versionCode to Play internal track).
12. Install from Play and confirm Google Play update prompt.
