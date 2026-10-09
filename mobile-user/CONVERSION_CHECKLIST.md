# Krozenda User App - Conversion Checklist

Target app: **User (buyer) app**. Stated by the user ("User App"); the repository has two Flutter wrappers
(`Krozenda_User_App`, `Krozenda Seller`) so the stated target was required and used.

## 0. Discovered inputs

| Item | Value | Source |
|---|---|---|
| Web frontend | `frontend/` (React 18 + Vite + Tailwind 3, react-router 6, zustand, react-query, axios) | repo |
| Backend | `backend/` (Node/Express/MongoDB) | repo |
| Flutter wrapper (reference only) | `Krozenda_User_App/` | repo |
| New app folder | `mobile-user/` (Expo SDK 57, RN 0.86, Expo Router, JS) | this run |
| App name | `Krozenda` | wrapper `AndroidManifest.xml` `android:label`, `AppConfig.appName` |
| Android package | `com.krozenda.user` | wrapper `android/app/build.gradle` `applicationId` |
| Version | `1.0.8` / versionCode `39` | **Assumption**: wrapper `pubspec.yaml` has two versions - active `1.0.0+1` and a commented previous `1.0.7+38`. The commented one is the last real release, so we continue from it (must be > any Play Store versionCode). |
| App icon | wrapper `assets/images/logo.png` (adaptive icon bg `#EB2527`, from `flutter_launcher_icons` config) | wrapper `pubspec.yaml` |
| Splash | wrapper `assets/images/splashLogo.png`, white background, 2 s | wrapper `splash_screen.dart`, `AppConfig.splashDurationSeconds` |
| API base URL | `https://krozenda.com/api` | wrapper `AppConfig.apiBaseUrl`; web production build is served from `https://krozenda.com` (`frontend/.env` has `http://localhost:5000` = local dev only, **conflict - production value chosen**, recorded here). Verified live: `GET /api/health` -> 200 |
| FCM / Firebase | project `krozenda-a62bb`, Android app `com.krozenda.user` (`1:778748845767:android:334a7a936d430abf4928e2`) | wrapper `android/app/google-services.json` (copied to `mobile-user/google-services.json`) |
| Payment public key | **Not available as a live key in the repo.** `frontend/.env` holds only `rzp_test_...`. The app takes the key from the backend create-order response where it returns one; otherwise `extra.razorpayKeyId` in `app.json` (empty) | see checkout checklist |
| Maps key | none used by the buyer web app / wrapper manifest (no `com.google.android.geo.API_KEY`) | wrapper manifest |
| Google sign-in | wrapper declares `google_sign_in`/`firebase_auth` deps but the buyer web app has no Google login (OTP only) -> not carried over | `LoginPage.jsx` |
| Test login | mobile `1111111111`, OTP `123456` (fixed OTP; backend `userAuthController.PERMANENT_TEST_NUMBERS`, works in production, no SMS sent). Verified against `https://krozenda.com/api/auth/send-otp` + `/auth/verify-otp` on 2026-10-09 (account auto-created, customer role). | backend code + live call |

Backend changes: **none required so far** (the test-number mechanism already exists).

## 1. Auth (how it works)
- OTP login: `POST /auth/send-otp {mobileNumber}` -> `{data:{isRegistered}}`; `POST /auth/verify-otp {mobileNumber, otp, name?}` ->
  `{data:{user, accessToken, refreshToken}, isNewUser}` (new numbers are auto-registered).
- Bearer JWT in `Authorization` header. Access token lives ~1 h, refresh token ~30 d.
- Refresh: `POST /auth/refresh-token {refreshToken}` -> `{data:{accessToken, refreshToken?}}`; one in-flight refresh shared by parallel 401s;
  on failure the session is cleared (`SESSION_EXPIRED`). Same logic as web `lib/axios.js` (ported verbatim in `src/lib/axios.js`).
- Storage: tokens in **SecureStore** (Android Keystore) mirrored in memory (`src/lib/storage.js`, loaded before first render),
  user/grants cache + zustand-persisted stores (cart/wishlist/checkout/language) in AsyncStorage. Logout wipes everything.
- Push: `POST /fcm-token {token, deviceType:'app'}` (native FCM token via expo-notifications), `DELETE /fcm-token {token}` on logout.
- Status: login + persistence **Built, not tested on device** (API contract verified with curl; SecureStore persistence needs a device).

## 2. Routes / screens in scope (web `modules/user/routes.jsx`, `modules/auth/routes.jsx`)
| Web route | Guard | Native route file | Area checklist |
|---|---|---|---|
| `/auth/login` (+ welcome, mobile, otp, verified) | public | `app/auth/[mode].js` | auth-home-ai |
| `/app/dashboard` | public | `app/dashboard.js` | auth-home-ai |
| `/app/categories` | public | `app/categories.js` | catalog |
| `/app/listing`, `/app/search` | public | `app/listing.js`, `app/search.js` | catalog |
| `/app/product/:productId` | public | `app/product/[productId].js` | catalog |
| `/app/cart` | signed-in | `app/(protected)/cart.js` | catalog |
| `/app/checkout/address,summary,payment,success` | signed-in | `app/(protected)/checkout/*` | checkout-orders |
| `/app/orders`, `/:id`, `/:id/track`, `/:id/invoice`, `/:id/invoice/preview`, `/:id/review`, `/app/reviews` | signed-in | `app/(protected)/orders/**`, `reviews.js` | checkout-orders |
| `/app/profile`, `/profile/edit`, `/profile/addresses`, `/wishlist`, `/wallet`, `/coupons`, `/notifications`, `/settings`, `/support`, `/returns` | signed-in | `app/(protected)/**` | profile-support |
| `/p/:slug`, `/terms`, `/privacy`, `/return-policy`, `/shipping-policy`, `/about`, `/cod-policy` (public CMS) | public | `app/p/[slug].js` etc. | profile-support |
| AI assistant launcher (global) | signed-in | `_layout.js` | auth-home-ai |

Left out (with reason): `/app/showcase` (developer gallery of every screen, not a product screen); legacy redirect routes
(`filters`, `search/results`, `product`, `orders/details|track|invoice|review`, `checkout/delivery`) - they only redirect and the
native app has no old links; `/admin/*`, `/seller/*`, `/partner/*` panels (other roles / desktop panels stay on web);
`HomeLeftSidebar`/`HomeRightSidebar`/`WebHeader`/`Footer`/`DesktopLeftShowcase` (desktop-only layout).

## 3. Shared pieces
- Design tokens: Tailwind palette + `frontend/tailwind.config.js` extensions -> `src/theme` (`palette.js` generated by `tools/gen-theme.mjs`).
- Font: Plus Jakarta Sans 400-800 (`@expo-google-fonts/plus-jakarta-sans`), same family the web loads from Google Fonts.
- Icons: react-icons (`Hi*` Heroicons 2, a few FA6/Feather) - react-icons has no RN build, so the exact glyphs are rendered to SVG once
  (`tools/gen-icons.mjs` -> `src/components/ui/iconData.js`) and drawn with react-native-svg.
- Images: web `public/images` + `public/brands` bundled (`tools/gen-local-images.mjs`); `/uploads/...` and API image URLs load from `https://krozenda.com`.
- i18n: the web translates the DOM through `POST /translate`; natively every `Text` looks its string up in a runtime dictionary
  (`src/lib/i18n/dictionary.js`) with the same endpoint, cache and 14 languages (RTL languages: see device list).

## 4. Flutter wrapper capabilities -> native
| Wrapper capability | Carried over as | Status |
|---|---|---|
| Splash (2 s, logo) | expo-splash-screen (`splashLogo.png`) hidden once fonts + session are ready | Built, not tested |
| App icon / name / package | `app.json` (icon, adaptive icon `#EB2527`, `com.krozenda.user`, "Krozenda") | Built, not tested |
| Push notifications (FCM, channel `webview_notifications`, tap -> page) | expo-notifications + google-services.json; token to `POST /fcm-token`; tap routes via `data.link` (`linkToRoute`) | Built, not tested (needs device + a real push) |
| Notification permission at startup | requested on login (`enablePush`) and when the notification feed first loads | Built, not tested |
| Camera / photos / location / storage / mic permissions requested up-front | requested when a feature needs them (image picker, camera scan, location autofill); mic + legacy storage not requested (unused, blocked in manifest) | Built, not tested |
| Exit confirmation dialog on back at root | `ExitDialog` + BackHandler in `_layout.js` | Built, not tested |
| Android back follows web navigation | Expo Router stack; back pops the stack (`router.back()`), exit dialog at root | Built, not tested |
| Offline screen / "No internet" | `NetworkBanner` + per-screen `ErrorState` offline wording (as the web) | Built, not tested |
| Pull to refresh | `RefreshControl` on list/feed screens | Built, not tested |
| Share (native share sheet) | RN `Share` | Built, not tested |
| File downloads / receipts (blob download -> Downloads, open file) | expo-print + expo-sharing (+ expo-file-system) | Built, not tested |
| UPI app launching / Razorpay UPI intents | react-native-razorpay native SDK (handles UPI intent apps) | Built, not tested (needs a device and the live Razorpay key) |
| SMS OTP auto-read (Android SMS User Consent API via smart_auth) | `autoComplete="sms-otp"` on the OTP input (keyboard suggestion). The SMS User Consent API itself has no Expo module | **Blocked** for full parity: needs a custom native module (e.g. `react-native-otp-verify`) |
| In-app update (Play Core `in_app_update`) | none - Play Core has no Expo module and the APK is distributed outside Play for now | **Blocked** (needs a native module + Play Store distribution) |
| Social/phone/WhatsApp/mail external links | RN `Linking` | Built, not tested |
| Dynamic status-bar colour | static light status bar with dark icons (screens are light) | Built, not tested |
| Language/theme prefs | language: yes (account + AsyncStorage); wrapper theme mode: not used by the web UI | n/a |

## 5. Web-only code / native replacements
See `tools/AGENT_GUIDE.md` cheat sheet. Libraries added: expo-router, expo-secure-store, @react-native-async-storage/async-storage,
expo-image, react-native-svg, expo-notifications, expo-device, expo-location, expo-image-picker, expo-document-picker, expo-camera,
expo-file-system, expo-sharing, expo-print, expo-clipboard, @react-native-community/netinfo, react-native-razorpay, axios, zustand,
@tanstack/react-query, react-hook-form, zod, @expo-google-fonts/plus-jakarta-sans (+ area-specific ones listed in the area checklists).

## 6. Per-area rows
Per-screen rows (APIs, payloads, status) live in `checklist/*.md` (auth-home-ai, catalog, checkout-orders, profile-support) and are
summarised in section 7 when the conversion is complete.

## 7. Status summary / device test list
**Checks run (2026-10-09):** `eslint src` clean; `expo-doctor` 21/21; `expo export --platform android` bundles (Hermes bytecode 6.1 MB);
Expo config resolves. API read checks (login, products, categories, brands, delivery check, reviews, orders list, payment methods,
reviewable, used coupons) done with curl against production using the test account. No emulator/device and no local Android SDK were
available, so local native build was skipped; the EAS cloud build is the compile check.

- **Verified:** OTP login API contract (send-otp / verify-otp / token shapes); catalog, product, category, brand, delivery-check and
  review read endpoints parse with the ported zod schemas.
- **Built, not tested:** every screen's UI and interaction, login persistence across restart (SecureStore), token refresh at runtime,
  push (token registration + tap routing), Razorpay checkout (COD/Wallet/Online order placement, wallet top-up - nothing paid in testing),
  invoice print/PDF share, review/profile/return photo upload, location autofill, language switching (14 languages, RTL for ur/ar),
  Android back / exit dialog, no-network banner.
- **Blocked:** SMS auto-read (SMS User Consent API - needs a custom native module); Play in-app update (no Expo module, APK sideload);
  live Razorpay key is not in the repo (the backend create-order response supplies `keyId`; live `GET /payment-methods` currently shows
  `RAZORPAY:false` - the live gateway must be enabled/configured on the backend or online payment will be unavailable).
- **Deviations from web (recorded by area agents):** filters change route params in place; listing grid/list toggle omitted (desktop only);
  AI launcher is shown to guests exactly like the web code (the web comment saying otherwise is stale); `PaymentMethodScreen` not ported
  (no route reaches it); `OrderPlacedScreen` uses the web's "latest order" fallback.

### Device test list (walk through in order)
1. Install APK, open: splash -> dashboard (banners, categories, products). Pull to refresh.
2. Language switcher: switch to Hindi, scroll home/product pages (texts translate), switch back; try Urdu (RTL).
3. Search, categories, listing + filters + sort, product detail (gallery, variants, delivery PIN check, reviews, share, wishlist heart, add to cart as guest).
4. Login: mobile `1111111111`, OTP `123456` (new account: welcome flow). Guest cart merges. Kill and reopen the app: still signed in.
5. Cart quantity stepper, remove, coupon; checkout -> address (add via form, "use my location" permission) -> summary -> payment:
   COD first; then online (Razorpay UPI intent / card with test key if the backend is in test mode); wallet if funded.
6. Orders list/tabs/search, order detail, track shipment, invoice preview/print/PDF share, rate & review with photos, return/replace.
7. Profile: edit profile + photo, addresses CRUD, wishlist, wallet (view; top-up with test mode only), coupons, notifications feed,
   settings (language, Privacy/Terms CMS pages), help & support (FAQ, raise ticket, ticket details).
8. Notification permission prompt; send a push from admin and tap it (opens the linked order/page); logout (token removed) and confirm
   cart/wishlist wiped.
9. Session expiry (wait > 1 h, or revoke) -> silent refresh; invalid refresh -> sent to login.
10. Airplane mode: offline banner, error states with "Try again", reconnect banner. Android back at each depth; back on dashboard shows "Exit App?".
11. Large font size / small phone (360 px) visual check against the web at phone width.
