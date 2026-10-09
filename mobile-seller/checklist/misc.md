# misc (G3b): Categories, Brands, Coupons, Customers, Reviews, Returns, Tickets, Store Profile, KYC, Settings, Onboarding status

Status key: Built = written + eslint clean, not run on a device/emulator. API-checked = the exact HTTP call was replayed with curl against https://krozenda.com/api using b2c.demo@krozenda.com (test data created by me was deleted again). No row is claimed "Verified on device".

Guard for every screen: the seller shell (lead-owned) mounts them; `status.js` is the only screen reachable before approval (gate already done).

## Screens

| Screen (web route) | Native file | API calls | Status |
|---|---|---|---|
| CategoriesPage (`/seller/categories`) | pages/CategoriesPage.jsx + components/catalog/CatalogBrowser.jsx (shared body) + components/catalog/VendorCatalogForms.jsx (`VendorCategoryFormDrawer`) | GET `/vendor/catalog/categories` (list, client-side search/filter/sort/10 per page); POST `/vendor/catalog/categories` multipart `name`, `isFood`, `image` (file) -> `created.fssaiRequired/fssaiStatus` toast; GET `/vendor/documents/fssai` (food warning) | GET API-checked; create: Built, not tested (vendor catalog has no delete endpoint, so I did not create live data) |
| BrandsPage (`/seller/brands`) | pages/BrandsPage.jsx + CatalogBrowser + `VendorBrandFormDrawer` | GET `/vendor/catalog/brands`; POST `/vendor/catalog/brands` multipart `name`, `logo` | GET API-checked; create: Built, not tested (same reason) |
| CouponsPage (`/seller/coupons`) | pages/CouponsPage.jsx + components/marketing/VendorCouponFormDrawer.jsx + components/marketing/DateField.jsx | GET `/vendor/coupons` (ListScreen: tabs/search/paging via useListController); POST `/vendor/coupons` JSON; PATCH `/vendor/coupons/:id/status` `{isActive}`; DELETE `/vendor/coupons/:id`; GET `/vendor/products?tab=active&rowsPerPage=100` (product picker) | API-checked end to end with a `ZZAPPTEST` coupon (create -> list -> deactivate -> delete, removed); UI Built, not tested |
| CustomersPage (`/seller/customers`) | pages/CustomersPage.jsx | GET `/vendor/customers` | GET API-checked (demo has 0 customers); Built |
| ReviewsPage (`/seller/reviews`) | pages/ReviewsPage.jsx | GET `/vendor/reviews`; POST reply (`replyToVendorReview`) | GET API-checked (0 reviews). Reply: Built, not tested (would post a public reply on a real review) |
| ReturnsPage (`/seller/returns`) | pages/ReturnsPage.jsx + components/modals/VendorReturnDrawer.jsx | GET `/vendor/returns`; recommendation POST (`recommendOnVendorReturn`) | GET API-checked (0 returns). Recommendation: Built, not tested (would change real returns) |
| TicketsPage (`/seller/tickets`) | pages/TicketsPage.jsx + components/common/TutorialsPanel.jsx + lib/tutorialService.js | GET `/vendor/tickets`; GET `/vendor/tickets/:id`; POST `/vendor/tickets` (`{subject,category,priority,message}`); POST message (`addVendorTicketMessage`); GET `/tutorials?audience=seller` | List + detail API-checked. Create/reply: Built, not tested (notifies admin). `/tutorials` returns "Route not found" on live: the backend route (`app.use('/tutorials', publicTutorialRoutes)`) exists in the local backend working tree but is not deployed yet, so the Tutorials tab shows the web's own error text until it is |
| StoreProfilePage (`/seller/profile`) | pages/StoreProfilePage.jsx + components/modals/FilePickerField.jsx | GET `/vendor/auth/me`; PUT `/vendor/auth/me` `{name,mobile,business:{businessName},address:{...}}`; GET `/vendor/documents/fssai`; POST `/vendor/documents` multipart `documentType=FSSAI_LICENSE`, `documentLabel`, `documentNumber`, `file` | GET API-checked; save/upload: Built, not tested (profile save changes the demo account; the multipart upload itself was API-checked via the KYC test below) |
| KycDocumentsPage (`/seller/kyc-documents`) | pages/KycDocumentsPage.jsx + components/modals/UploadKycModal.jsx + FilePickerField | GET `/vendor/documents`; POST `/vendor/documents` multipart `documentType`, `documentLabel`, `file`; submit for verification (`submitVendorForVerification`) | List API-checked; upload API-checked with curl multipart (ADDRESS_PROOF `ZZ-APP-TEST`, then DELETE `/vendor/documents/:id`, removed); UI + native file pick Built, not tested. Submit for verification deliberately NOT called |
| SettingsPage (`/seller/settings`) | pages/SettingsPage.jsx | GET `/vendor/settings`; PUT `/vendor/settings` `{bank:{...}, notificationPrefs:{...}}` | GET API-checked; save Built, not tested |
| VendorOnboardingStatusPage (`/seller/status`) | pages/VendorOnboardingStatusPage.jsx | GET `/vendor/auth/me`; GET `/vendor/documents`; submit for verification | Built, not tested (submit not called) |

## Native replacements

| Web | Native |
|---|---|
| `<input type=file>` (image) | `expo-image-picker` `launchImageLibraryAsync` via `lib/filePicker.js` `pickImageFile()` |
| `<input type=file accept=.pdf,.jpg,.png>` | `expo-document-picker` via `pickDocumentFile()` + `FilePickerField` (shows "Choose File" / name) |
| `formData.append('file', File)` | `appendFile(formData, field, {uri,name,type})` (RN FormData file object), same field names and same axios `multipart/form-data` call as the web service |
| `<input type=date>` (coupon dates) | `DateField` (`@react-native-community/datetimepicker`, Android dialog / iOS inline); value stays `YYYY-MM-DD`, validation unchanged |
| `<select>` sort (categories/brands) | `OptionSheet` bottom sheet |
| `<a target=_blank>` (KYC "View", FSSAI "View file", return evidence photos) | `Linking.openURL` |
| `<Link to=profile>` in FSSAI warning / navigate to KYC | `useRouter().push(SELLER_ROUTES.PROFILE / KYC_DOCUMENTS)` |
| Tutorial video (YouTube/Vimeo iframe, direct `<video>`) | The web plays inline. Natively every video link opens via `Linking.openURL` ("Watch video"): no WebView / expo-video dependency was added. Say so if you want inline playback (needs `react-native-webview` + `expo-video`) |
| `toast` from admin/stores/toastStore | `src/lib/toast` (same API) |
| CSV export (coupons) | `lib/exportCsv.downloadTableCsv` (file + share sheet); the web ExportMenu ignores the chosen format and always exports CSV, same here |

## Port notes / deviations (all faithful to the web at phone width)

- Categories + Brands are the same layout on the web; one shared `CatalogBrowser` renders both (config object carries the label/icon/colour/field differences). Header is drawn locally (title + count pill) because `PageHeader`'s title is a `Text`.
- Web `bg-gradient-to-br` tiles are flat tints (no gradient lib); grid card image area uses slate-100.
- `VendorReturnDrawer`: the web Drawer body has no padding, so content is flush with the panel edges exactly like the web. `bg-surface-subtle` (not a real token) renders transparent on the web and here.
- Reviews `Badge size="xs"` is not a valid web size (renders unpadded); native uses `sm`.
- SettingsPage passes `subtitle` to `PageHeader` on the web, which ignores it; no description is shown on either.
- Added only guards against double-submit (disabled/isLoading) on submit buttons; behaviour/validation unchanged.
- Keyboard types added per field (tel for mobile, number-pad for pincode/account number/FSSAI/usage limits, decimal-pad for amounts, `characters` caps for coupon code/IFSC).
- Hover states, `sm:` grids, desktop table density skipped. Unreachable on web: none found in these files beyond the above.

## Shared helpers created (new files)

- `src/lib/tutorialService.js`, `src/components/common/TutorialsPanel.jsx`
- `src/modules/vendor-shared/lib/filePicker.js`
- `src/modules/vendor-shared/tableColumns/miscColumns.jsx` (customer, coupon, return, KYC-doc columns + coupon tabs)
- `src/modules/vendor-shared/components/catalog/{CatalogBrowser,VendorCatalogForms}.jsx` (`VendorCatalogForms` was imported by Categories/Brands on the web; it was not in the brief but was missing, so it is created here)
- `src/modules/vendor-shared/components/marketing/{DateField,VendorCouponFormDrawer}.jsx`
- `src/modules/vendor-shared/components/modals/{FilePickerField,UploadKycModal,VendorReturnDrawer}.jsx`
