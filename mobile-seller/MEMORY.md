# MEMORY — Krozenda Seller (Expo / React Native)

## 1. What this app is
Native Android app for the **seller (vendor) role** of the Krozenda MERN marketplace. Converted from the web seller panel
(`../frontend/src/modules/seller` + `../frontend/src/modules/vendor-shared`, rendered at phone width). Backend: `../backend`
(read-only, shared with the web). Previous Android shell (reference only, replaced by this app): `../Krozenda Seller` (Flutter WebView).
Dropshipping-partner and admin panels are NOT part of this app.

## 2. Discovered inputs
| Item | Value | Source |
|---|---|---|
| App name | Krozenda Seller | Flutter `AndroidManifest.xml` android:label |
| Package | `com.krozenda.seller` | Flutter `android/app/build.gradle` applicationId |
| Version | 1.0.0 (versionCode 1) | Flutter `pubspec.yaml` 1.0.0+1 |
| API base URL | `https://krozenda.com/api` | Flutter `lib/config/app_config.dart`; `.env` |
| Icon / splash | `assets/logo.png`, `assets/splashLogo.png` (adaptive bg `#FDD200`) | Flutter `assets/images`, pubspec launcher-icons config |
| Push | `google-services.json` (project `krozenda-a62bb`) | Flutter `android/app/google-services.json` |
| Order ringtone | `assets/sounds/order_ringtone.mp3` | Flutter `res/raw/order_ringtone.mp3` |

## 3. Stack
Expo SDK 57, React Native 0.86, React 19, Expo Router, JS only. zustand (auth/toast), @tanstack/react-query (server state),
axios, zod, socket.io-client (realtime), react-native-svg (icons, charts, barcode shapes), expo-notifications (FCM),
expo-image-picker / expo-document-picker / expo-camera (barcode scan) / expo-print / expo-sharing / expo-file-system / expo-clipboard,
sp-react-native-in-app-updates (forced Play update), @react-native-community/datetimepicker, Plus Jakarta Sans font.

## 4. Structure & conventions
- `src/app/` thin Expo Router files. `login.js`, `register.js` outside the guard; `(panel)/` = guarded seller panel (`_layout.js` = topbar + bottom nav + More drawer + onboarding gate + realtime/push). Route files are generated: `node tools/gen-routes.mjs`.
- `src/modules/vendor-shared/{pages,components,controllers,services,schemas,tableColumns,lib}` mirrors the web module 1:1 (same export names).
- `src/components/ui/*` = ports of web `components/ui` (same names/props; `onChange({target:{value}})` convention, see `ui/index.js`).
- `src/components/admin/*` + `src/modules/admin/*` = ports of the admin shared pieces the seller screens use (PageBody, ListScreen, DataTable, Drawer, FormDrawer, charts, useListController, …).
- `src/theme` tokens (from web tailwind). `src/lib` API client, stores, push, realtime, i18n, format, exportCsv.
- Add a screen: write `modules/vendor-shared/pages/X.jsx`, add it to `tools/gen-routes.mjs`, run it, add nav entry in `modules/vendor-shared/lib/vendorNav.js`. New react-icons name → `node tools/gen-icons.mjs`.
- `tools/AGENT_GUIDE.md` = conversion rules used while porting.

## 5. Auth
Email + password → `POST /vendor/auth/login` → bearer JWT (7 days, no refresh endpoint). Token in SecureStore (`lib/storage.js`), user/grants in AsyncStorage; hydrated before first render (`lib/session.js`) so the session survives restarts. Every request carries `Authorization: Bearer`. Any 401 on an authenticated call → `clearSession()` → panel guard redirects to login. Logout: disconnect socket, `DELETE /fcm-token`, clear session.

## 6. API layer
`lib/axios.js` (`api`, timeout 15 s, normalised errors `{status, code, message, isOffline, isTimeout}`); services under `modules/vendor-shared/services` are the only importers of `api`. No auto-retry for mutations. Error boundary at app root.

## 7. Web → native decisions
Hover/desktop layouts dropped; web Table → horizontally scrolling table; Drawer → full-width slide-in panel; `<select>` → bottom-sheet Select; recharts → react-native-svg charts (`components/admin/charts`); barcode = server PNG fetched with auth (as web), label PDF via expo-print; web push (service worker) → expo-notifications with FCM token registered `deviceType:'app'`; socket.io unchanged; DOM auto-translate → `<Text>` runtime translator (`lib/i18n`, POST /translate); CSV export → expo-file-system + share sheet; in-app update → Play IMMEDIATE flow on launch and every resume (`lib/inAppUpdate.js`, only effective for Play-installed builds).
Push: backend sends FCM *notification* messages without an Android channel, so the app creates the default channel `webview_notifications` (MAX importance, order ringtone) and registers it as FCM default in the manifest (expo-notifications plugin). Foreground pushes → toast.
Footer links (Marketplace/Terms/Privacy/Support) open the website in the browser.

## 8. Backend changes
None.

## 9. Commands
- Install: `npm install` · Lint: `npx expo lint` · Doctor: `npx expo-doctor` · JS bundle: `npx expo export --platform android`
- Toolchain: JDK 17 `C:\Users\admin\.jdks\jdk-17.0.20.1+1` (`JAVA_HOME`), Android SDK `C:\Users\admin\AppData\Local\Android\Sdk` (`ANDROID_HOME`; build-tools 36, platform 36, NDK 27.1, CMake 3.22.1).
- Release build (Windows needs a short path): sync project to `C:\app\s` with robocopy `/MIR` (exclude only the top-level `android`, `dist`, `.expo` folders — NOT every folder named `dist`, node_modules needs its own), then in `C:\app\s`: `npx expo prebuild --platform android --no-install` and in `C:\app\s\android`: `.\gradlew.bat assembleRelease bundleRelease --no-daemon`. Do not let the PC sleep.
- Outputs copied to `mobile-seller/dist-release/` (APK for phones, AAB for Play Store).
- Signing: permanent keystore `C:\Users\admin\.krozenda-keys\krozenda-seller.jks` (copied from the Flutter wrapper's `krozenda.jks` = the key the published app used). Passwords are in `C:\Users\admin\.gradle\gradle.properties` (`KROZENDA_SELLER_*`), wired by `plugins/withReleaseSigning.js`. **Back the keystore up** — losing it means the app can never be updated. Release SHA-1 `F9:31:A4:18:FD:C8:5F:BD:83:38:C9:FD:B8:32:6D:A4:E4:9C:DF:F6`.
- Test login (live DB!): `b2c.demo@krozenda.com`, `b2b.demo@krozenda.com` (password in `backend/Router/seedVendors.js`). Create/update only data you create and delete again.

## 10. Known issues
See `CONVERSION_CHECKLIST.md` (status per row). Nothing was run on a device (none connected): all UI is "Built, not tested".
- `GET /tutorials`, `/vendor/fssai` return "Route not found" on the live server (backend not deployed with these routes) → Tutorials tab and FSSAI warning degrade.
- Tutorial videos open in the browser (web plays inline).
- Forced Play update only works when installed from Play.

## 11. Assumptions
Target = seller because "seller apk" was requested; keystore = the Flutter wrapper's. Nav "bell" in the topbar keeps the web's toast behaviour. Footer links open browser.
