# Group G2 - Dashboard + Finance

Status key: Verified = run/checked; Built = written, lint clean, not run on a device.
API shapes were checked with curl against https://krozenda.com/api (b2c.demo login): every endpoint below returns
`{ success, data }` with the fields the screens read. The demo account has almost no data (0 revenue, 0 earnings, empty
trend), so populated rows could not be eyeballed from the live data.

## Dashboard (`/dashboard`, `VendorDashboardPage`, pages/DashboardPage.jsx)
Web route `/seller` index. At phone width the web renders ONLY `MobileSellerDashboard` (`block lg:hidden`); the desktop
branch (KpiGrid, AreaTrend/ChartFrame, OrderPipeline, 4 link cards, Recent Orders Table, PageHeader, KYC InlineAlert) is
`hidden lg:block` -> not ported (unreachable at phone width).
| Item | API | Status |
|---|---|---|
| Summary | GET /vendor/summary (storeName, status, totalRevenue, pendingOrdersCount, liveSkusCount, availablePayout, kycStatus) | Built; shape Verified |
| Analytics | GET /vendor/analytics/summary (salesTrend, orderStatusBreakdown, topProducts, productsTotal, productsActive) | Built; shape Verified |
| Recent orders | GET /vendor/orders via `useVendorOrdersController` (first 5) | Built |
| Loading / error states | Skeleton h-40 / red message box | Built |
| Header card (gradient initials tile via SVG gradient, greeting, date, verified icon, Active pill, Add SKU) | - | Built |
| KYC banner when kycStatus != approved | -> KYC_DOCUMENTS | Built |
| 5 shortcut tiles (+ pending badge) | -> PRODUCTS/ORDERS/EARNINGS/ANALYTICS/KYC_DOCUMENTS | Built |
| 4 KPI cards (Delivered Revenue static, others link) | -> ORDERS/PRODUCTS/EARNINGS | Built |
| Order pipeline + cancelled strip | -> ORDERS | Built |
| Revenue trend: 7D/30D toggle, local react-native-svg monotone area chart (grid, k-ticks, press tooltip) | - | Built (no shared chart matches the dashboard's compact styling: 9.5px ticks, 144px, ₹k axis) |
| Recent order cards (SmartImage thumb, status pill, relative time) + View All | -> ORDERS | Built |
| Management Hub (Inventory, Shipping, Reviews, Coupons), footer Help & Support | -> INVENTORY/SHIPPING/REVIEWS/COUPONS/TICKETS | Built |
Notes: web `title`/hover/`active:scale` -> PressableScale. `orders?.total` is undefined in the controller (same as web) so
"View All (n)" shows the count of the (<=5 shown) list length fallback, exactly as the web does. Web `basePath`
(/seller vs /partner) dropped: only /seller exists here.

## VendorStatsGrid (components/VendorStatsGrid.jsx)
Unreachable on web (imported nowhere in the seller panel). Ported for parity, rendered nowhere. Built.

## Analytics (`/analytics`, `AnalyticsPage`)
GET /vendor/analytics/summary. 4 StatTiles (2 cols), Top Products list, Order Status Mix grid, loading text. Built; shape Verified.
`toLocaleString('en-IN')` replaced by `formatIndian` (Hermes-safe).

## Revenue (`/revenue`, `RevenuePage`)
GET /vendor/earnings/revenue?range=7d|30d|90d|fy (kpis, trend, totals, products, rangeLabel). SegmentedControl ranges
(DASHBOARD_RANGES from modules/admin), KpiGrid, Net sales AreaTrend (kit chart) with NoData, Breakdown KeyValueList,
Top products Table (PRODUCT_REVENUE_COLUMNS copied into tableColumns/financeColumns.jsx). Loading PageSkeleton / ErrorState with retry.
Built; shape Verified (kpis/totals present; trend/products empty on demo).

## Reports (`/reports`, `ReportsPage`)
GET /vendor/reports/sales?from&to. Date inputs -> `@react-native-community/datetimepicker` (iOS compact picker, Android
dialog) keeping the web min/max rules (from <= to, to <= today). Export CSV -> `downloadCsv` (src/lib/exportCsv.js:
expo-file-system + share sheet) with the same two sections/columns; double-tap blocked, error toast on failure.
Web only has CSV (no Excel) - nothing added. Built; shape Verified. Export not run on a device.

## Earnings & Settlements (`/earnings`, `EarningsPage` in pages/SettlementsPage.jsx)
GET /vendor/earnings/summary, /vendor/earnings/transactions, /vendor/earnings/payouts. 4 tiles, commission note, Tabs
(Earnings/Payouts with counts), DataTable with EARNING_COLUMNS / PAYOUT_COLUMNS (tableColumns/financeColumns.jsx), empty
states, FAILED reason. Built; shape Verified (all lists empty on demo).

## Notifications (`/notifications`, `NotificationsPage`)
GET /vendor/notifications; PATCH /vendor/notifications/:id/read (tap unread row); PATCH /vendor/notifications/read-all
("Mark all read" when unreadCount > 0). Unread rows tinted + "New" badge (web's undefined `xs` size reproduced: no padding).
Built; list shape Verified; PATCH calls not run (would change live data).

## Other
- Controllers/services/schemas used unchanged (no fixes needed).
- New dependency: none added (`@react-native-community/datetimepicker` was already in package.json). `node tools/gen-icons.mjs` run for `HiCheckCircle`.
- `npx eslint` on all files: clean.
