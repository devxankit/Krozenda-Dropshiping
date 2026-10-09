# orders-shipping (G4)

Status key: Verified = run against live API with demo login (GET only); Built, not tested = written, eslint clean, not run on device and/or mutating on live DB.
Demo account (b2c) has 0 orders and 0 shipments on live, so list/drawer rendering with real rows is not exercised.

| Screen | Web route / guard | Native file | Status |
|---|---|---|---|
| Orders | `/seller/orders` (+partner) | pages/OrdersPage.jsx (`OrdersPage`), route `(panel)/orders.js` | Built, not tested |
| Order drawer | in-page | components/modals/VendorOrderDrawer.jsx | Built, not tested |
| Create shipment drawer | in-page | components/shipping/CreateShipmentDrawer.jsx | Built, not tested |
| Shipment drawer | in-page (Orders + Shipping) | components/shipping/ShipmentDrawer.jsx | Built, not tested |
| Shipping list | `/seller/shipping` | pages/ShipmentsPage.jsx (`ShippingPage`), route `(panel)/shipping/index.js` | Built, not tested |
| Shipping settings | `/seller/shipping/settings` | pages/ShippingSettingsPage.jsx, route `(panel)/shipping/settings.js` | Built, not tested |
| Columns | tableColumns/vendorColumns.jsx (orders), shipmentColumns.jsx | tableColumns/orderShippingColumns.jsx (VENDOR_ORDER_COLUMNS/TABS, SELLER_SHIPMENT_COLUMNS) | Built, not tested |

## API calls (all via existing shippingService / vendorService, unchanged)
| Call | Used by | Status |
|---|---|---|
| GET /vendor/orders | Orders list | Verified (200, empty list, tabCounts) |
| PATCH /vendor/orders/:id/items/:productId/status | order drawer advance/reject | Built, not tested (mutating, live) |
| GET /vendor/shipments | Shipping list, order shipments | Verified (200, empty) |
| GET /vendor/shipping/integration | banner, courier section | Verified (200) |
| GET /vendor/shipping/pickup-locations | settings, create drawer | Verified (200, 1 registered location) |
| POST /vendor/shipping/package/suggest | create drawer | Built, not tested |
| POST /vendor/shipments | create shipment | Built, not tested (mutating) |
| GET /vendor/shipments/:id, /tracking | shipment drawer | Built, not tested (no shipments on demo) |
| POST .../awb, /pickup, /cancel, /return, /restock, /tracking/refresh, /ndr/action | shipment drawer actions | Built, not tested (mutating / carrier calls) |
| GET .../documents/:type, /ndr | documents, delivery attempts | Built, not tested (carrier calls) |
| POST/PUT/PATCH/DELETE pickup-locations | settings | Built, not tested (mutating) |

## Native replacements
- Documents (label / manifest / invoice): backend returns a carrier URL (`{type,url,cached}`), same as web (which `window.open`s it). Native: `File.downloadFileAsync` (expo-file-system class API) into `Paths.cache/shipment-documents/`, then `expo-sharing` share sheet (save/print/send); falls back to `Linking.openURL` if download/sharing is unavailable. No axios arraybuffer needed because the API serves URLs, not bytes. Web "popup blocked" link UI is dropped (no popups natively).
- "Track on carrier site" -> `Linking.openURL`.
- `navigate('settings')` -> `router.push(SELLER_ROUTES.SHIPPING_SETTINGS)`.
- Raw `<svg>` icons (bolt, trash) in settings -> react-native-svg with same paths.
- `<pre>` NDR JSON -> max-height 160 nested ScrollView.
- Web 2/3/4-column grids -> 2-up rows (phone width).

## Notes / deviations
- Added per-button loading guards in VendorOrderDrawer (busyItem) and documents (pending) to block double submit; web had none.
- `renderRowActions` is passed on Orders as on web but ListScreen never reads it (same as web: unreachable).
- Unreachable on web seller app (not ported): ShipmentDrawer `isAdmin` branches (InternalDetails, Shipped-on field, super-admin Delete + ConfirmDialog), ADMIN_SHIPMENT_COLUMNS; `Field` helper in ShippingSettingsPage (defined, never used).
- `lib/shipping/presentation.js`: uses only `toLocaleString('en-IN')`/Intl; works natively unchanged (no edits made). `contracts.js` zod only.
- Minimal fixes to pre-copied files: none.

## Blockers (other agents' files, unresolved imports at time of check)
- `controllers/useShippingController.js` imports `../../admin/controllers/useListController` (missing at check time).
- `services/shippingService.js` and `vendorService.js` import `../../admin/services/mockTransport`; `vendorService.js` imports `../../admin/schemas/analyticsSchema` (missing at check time).
- `components/admin/display/cells.jsx` imports `modules/admin/lib/format` (formatMoney) - not yet present.
