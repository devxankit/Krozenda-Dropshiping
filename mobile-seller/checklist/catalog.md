# Catalog (G3a) - Products, Inventory, product forms, barcode

Status legend: **Verified** = run against the live API (curl, same multipart/JSON the app sends); **Built, not tested** = code written + eslint clean, not run on a device/emulator (no device available to the agent).
Live-DB test data: one product `ZZ-APP-TEST delete me` (Draft) was created, updated (with a variant + 2nd image), stock-patched, barcode PNG fetched, then DELETED. Nothing else was written.

## Screens

### Products - `VendorProductsPage` (`src/modules/vendor-shared/pages/ProductsPage.jsx`, route `src/app/(panel)/products.js`)
Web: `/seller/products` (vendor-shared `ProductsPage`), wrapper = VendorLayout shell. Guard = onboarding allow-list (shell, lead-owned).

| Item | Native | Status |
|---|---|---|
| Header: title + count pill, description, actions (Refresh w/ spinner, Export, Scan barcode, Import CSV, Add Product) | icon-only buttons except "Add Product" (labels are `hidden sm:inline` on web) | Built, not tested |
| 5 KPI cards (Total, Active, Pending, Rejected, Stock Alert - last full width) from `tabCounts` | 2-col grid | Built, not tested |
| Import-preview banner ("N imported products waiting", Review previews, Approve all N) | same | Built, not tested |
| Toolbar: status tabs (+ "Import Preview" tab only when previews exist / selected), search, grid/table toggle | horizontal tab strip; search writes `filters.search` live like the web | Built, not tested |
| Grid cards (image, flash/trend/discount/out badges, status badge, category/brand, name, price/MRP, stock + SKU, rejection reason, Live/Hidden, view/edit/stock, Approve/Delete for previews) | 2 cards per row; hover-only effects dropped | Built, not tested |
| Table view (SKU/Product, Price, Stock, Status + Actions col) | ui `Table`, horizontal scroll | Built, not tested |
| Loading / error (Retry) / empty (filtered vs first-product) / pagination | same | Built, not tested |
| Pull to refresh | native addition used by every list (PageBody) | Built, not tested |
| Export visible rows to CSV | `downloadTableCsv` -> cache file -> share sheet | Built, not tested |
| Approve one / approve all / delete preview (ConfirmDialog) | same calls | Built, not tested |

API calls (all via existing `services/vendorService.js`, `catalog-import` service):
- `GET /vendor/products?tab&page&rowsPerPage&search` -> `{items, page, rowsPerPage, totalItems, totalPages, tabCounts}` - **Verified** (live, incl. `search`)
- `POST /vendor/products` (multipart) - **Verified** (curl, Draft product; fields/`images`/`variants`)
- `PUT /vendor/products/:id` (multipart: variants JSON with `new:<idx>` image refs, `removeImages`, `images`) - **Verified** (curl)
- `DELETE /vendor/products/:id` - **Verified** (curl; also used for "Delete preview")
- `PATCH /vendor/inventory/:id {stock}` - **Verified** (curl)
- `GET /vendor/products/barcode/:code` (scan lookup) - **Verified** (200 for a real code, 404 for unknown)
- `GET /vendor/catalog/categories`, `GET /vendor/catalog/brands` (form pickers) - **Verified**
- `POST /vendor/products/import/approve-products {productIds | all}` - Built, not tested (would change live data)

### Add / Edit product (`AddVendorProductModal.jsx`, `EditVendorProductModal.jsx`)
Same 7 numbered sections, same validation messages/order, same FormData fields. Shared markup (image section, status segmented control, returnable card, GST slab list) lives in `src/components/catalog/productFormParts.jsx` because the web duplicates it verbatim in both modals.
- Image upload: `expo-image-picker` multi-select (`src/components/catalog/pickImages.js`) -> `{ uri, name, type }` appended to FormData (`images`). The web's hover-only remove button is always visible on touch.
- Variant image picking uses the same identity trick as the web (a picked photo object is the key; `new:<index>` sent to the server).
- Submit blocked while in flight; footer button text swaps like the web. Error text = server message, falling back to the normalised error message.
Status: Built, not tested on device (request shapes **Verified** with curl).

### Product details (`VendorProductDetailModal.jsx`), Update stock (`UpdateStockModal.jsx`)
Read-only fields, footer actions, barcode label block. Update stock: fire-and-close like the web, plus an error toast if the PATCH fails (the web leaves an unhandled rejection). Built, not tested.

### Barcode label (`src/components/common/ProductBarcode.jsx`)
Web: barcode + QR are server PNGs (`/vendor/products/:id/barcode.png?v=6`, `/qrcode.png`) fetched with auth as blobs - no client barcode library, so nothing to hand-draw with react-native-svg. Native: fetched with the bearer token as bytes (`responseType: 'arraybuffer'`), shown via `data:` URI. **Both endpoints Verified** (200 `image/png`).
- Download label: web draws a canvas PNG. Native: same label content rendered as HTML -> `expo-print` PDF -> share sheet (**format differs: PDF instead of PNG**).
- Barcode PNG: bytes written to cache + share sheet. Print: `Print.printAsync`. Copy: `expo-clipboard`.
Built, not tested.

### Scan barcode (`src/components/common/ScanBarcodeModal.jsx`)
Web: always-focused text input submitted with Enter (handheld/Bluetooth scanners type into it) + the `^\d{13}\s*\|` QR-line rule - ported 1:1 (default keyboard, not numeric-only, because SKUs are accepted too). **Native addition requested in the brief**: "Scan with camera" button -> `expo-camera` `CameraView` (barcode types ean13/ean8/upc/code128/code39/code93/itf14/codabar/qr); camera permission is requested only when that button is first pressed; denied+can't-ask-again shows an "open settings" line. Built, not tested.

### CSV import (`src/modules/catalog-import/*`, ported because ProductsPage imports it)
`components/AdminImportModal.jsx`, `components/ImportStatusBadge.jsx`, `controllers/useProductImportController.js` (verbatim), `services/productImportService.js`. File chosen with `expo-document-picker`; template downloaded to cache and shared. Web-only pieces not ported (not reachable from the seller panel): `ImportBatchReview`, `ImportRowCard`, `ProductImportWorkspace` (admin).
- `GET /vendor/products/import` (history) - **Verified**; `GET .../import/template` - **Verified** (200 text/csv)
- `POST /vendor/products/import` (upload), `GET .../import/:id`, `.../rows` - Built, not tested (would create live preview rows)

### Inventory - `VendorInventoryPage` (`pages/InventoryPage.jsx`, route `inventory.js`)
`ListScreen` + tabs All/Low Stock/Out of Stock, out-of-stock banner, "Adjust" -> UpdateStockModal.
- `GET /vendor/inventory` - **Verified**; stock PATCH - **Verified**. UI: Built, not tested.

### Category / Brand drawers (`components/catalog/VendorCatalogForms.jsx`)
`VendorCategoryFormDrawer`, `VendorBrandFormDrawer` ported (FormDrawer, FSSAI warning for food categories, "Go to Store Profile" -> `SELLER_ROUTES.PROFILE`, live card preview). `onSubmit` receives `{ name, image | logo, isFood }` where image/logo is `{ uri, name, type }` or null - the Categories/Brands page must append it with `appendFile`-style `{uri,name,type}` FormData parts. Built, not tested.

## Shared pieces
- `src/components/catalog/`: `ProductAdvancedFields.jsx` (all 6 exports, GstTypeField is the only one the seller modals use; the rest are reachable only from the admin product drawer), `ProductVariantsSection.jsx` (the web `<datalist>` of attribute names became a tappable suggestion strip under the focused name field), `productFormPayload.js` (verbatim), `productVariants.js` (`File` check replaced by `isLocalFile`), plus helpers `layout.jsx`, `pickImages.js`, `productFormParts.jsx`, `tw.js`.
- `src/modules/vendor-shared/tableColumns/catalogColumns.jsx`: `VENDOR_PRODUCT_COLUMNS`, `VENDOR_PRODUCT_TABS` (copied; `vendorColumns.jsx` untouched).

## Not ported / unreachable on web
- `ProductAdvancedFields`: `CollapsibleSection`, `ShippingFields`, `TaxFields`, `PriceTierEditor`, `VariantEditor` are only used by the admin product drawer (ported anyway as part of the shared file, not used by seller screens).
- `formatRupees`-style `title=` tooltips, hover/animate-pulse effects.
- Admin-only import review screens (see above).

## Minimal fixes to shared code
None - no edits to controllers/services/schemas or other agents' files.
