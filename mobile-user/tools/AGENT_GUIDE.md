# Conversion guide (read fully before writing code)

We are converting the **buyer ("user") app** of the Krozenda MERN web app (`../frontend`, React + Tailwind,
phone width 360-412px) into a native Expo (SDK 57, React Native 0.86, JavaScript only, Expo Router) app in
`mobile-user/`. This is a **conversion, not a redesign**: the web app as it renders at phone width is the spec.
Backend (`../backend`) is read-only; same API, same auth. Production API: `https://krozenda.com/api`.

## Hard rules
- JavaScript only (`.js`/`.jsx`), no TypeScript. Do NOT touch `../frontend` or `../backend`.
- No WebView of the web app. No mock data, fake APIs, placeholder screens or TODOs for existing functionality.
- Do not add anything the web app does not have (screens, features, onboarding, dark mode, analytics...).
  Where the web has separate desktop + mobile layouts, build only the mobile one (ignore `md:`/`lg:` desktop
  branches, hover states, `WebHeader`, `Footer`, `DesktopLeftShowcase`, `HomeLeftSidebar/RightSidebar`).
- Reproduce at phone width: hierarchy, colors, fonts (Plus Jakarta Sans), font sizes/weights, spacing, radius,
  shadows, icons, images, texts/labels, loading/empty/error/success states, animations (intent only).
- Styling = `StyleSheet.create` + tokens from `src/theme` (`colors`, `radius`, `shadows`, `sp`, `fontSize`).
  `colors` contains the full Tailwind palette (`colors.slate[500]`, `colors.blue[600]`...) plus the web's `brand`,
  `ink`, `surface`, `border` tokens. Translate Tailwind classes exactly (px = n*4; `text-sm` = 14/20 etc.; see
  `src/theme/index.js` and `../frontend/tailwind.config.js`). Use arbitrary-value classes as written (`text-[10px]`).
- Only request Android permissions the screen really uses; keep code free of unused deps.

## What already exists (owned by the lead - import, do not duplicate; only make minimal bug fixes and tell me)
- `src/config/env.js`, `src/config/routes.js` (`USER_ROUTES`, `AUTH_ROUTES`, `userPath`; Expo-router paths, no `/app`
  prefix), `src/theme`.
- `src/lib`: `axios.js` (`api`, same interceptors/refresh as web), `authStore.js` (`useAuthStore`: setSession/
  setUser/clearSession/isAuthenticated), `storage.js`, `cartStore.js`, `wishlistStore.js`, `checkoutStore.js`
  (AsyncStorage-persisted), `notificationStore.js` (+`enablePush`), `push.js` (`registerForPush`,
  `unregisterPushToken`, `linkToRoute`), `razorpay.js` (`openRazorpayCheckout`, same signature as web, native SDK),
  `toast.js` (`toast.success/error/...` same API as web), `phoneUtils.js`, `debounce.js`, `queryClient.js`,
  `i18n/` (`useLanguageStore`, `LANGUAGES`, `useT()` for placeholders/alerts), `useNetworkStatus.js`, `session.js`.
- `src/components/ui`: `Text` (ALWAYS use this instead of RN `Text`: maps fontWeight to the bundled font family
  and auto-translates string children; pass `noTranslate` for numbers/prices/codes), `Icon` (`<Icon name="HiHome"
  size={20} color=... />` - same react-icons names as the web; **after you add a new icon name run
  `node tools/gen-icons.mjs`** from `mobile-user/`), `Button`, `Input`, `Sheet` (bottom sheet / centered dialog
  replacing web modals/dropdowns/popovers), `SmartImage` (use for every product/banner image; accepts the same
  `src` values as web incl. `/images/...` which resolve to bundled copies), `Skeleton`, `AsyncBoundary`
  (`ErrorState`, `EmptyResult`, `ListSkeleton`, `ProductGridSkeleton`), `ToastHost`.
- `src/components/layout`: `Screen` (safe-area page container; props: `scroll`, `nav`, `header`, `footer`,
  `keyboard`, `refreshControl`), `BottomNavbar`. `src/components/common`: `NetworkBanner`, `ExitDialog`.
- Routes: `src/app/**` are thin files that render your screens. They already import:
  `src/modules/user/components/<area>/<ScreenName>.jsx` exporting `{ ScreenName }` with the **same names as the web**
  (`../frontend/src/modules/user/components/...`). Create exactly those files/exports. `src/modules/auth/LoginScreen.jsx`
  exports `LoginScreen`. `src/modules/user/components/ai/index.js` exports `AiAssistantLauncher` (mounted globally in
  `src/app/_layout.js`; renders nothing for signed-out users). Do not edit `src/app` except the files named in your brief.

## Web -> native cheat sheet
- `react-router` -> `expo-router`: `useNavigate()` -> `useRouter()` (`router.push/replace/back`), `navigate(-1)` ->
  `router.back()` (if `!router.canGoBack()` go to `USER_ROUTES.DASHBOARD`), `useParams` / `useSearchParams` ->
  `useLocalSearchParams()` (query strings are strings), `<Link>` -> `<Pressable onPress={() => router.push(..)}>`,
  `location.state` -> pass what you need through route params or the zustand stores. Redirect after login uses the
  `redirect` route param (see `src/app/(protected)/_layout.js`).
- Pages' `usePageMeta`, `window.scrollTo`, `document.*`, `ScrollToTop`, `useKeyboardOpen` (exists in BottomNavbar.jsx) -
  drop or replace natively.
- Long lists -> `FlatList` / `SectionList` with stable `keyExtractor` (never ScrollView + map for unbounded lists).
  Pull-to-refresh only where the web has a refresh affordance (the Flutter wrapper had pull-to-refresh on the whole
  web view; add `RefreshControl` on list/feed screens that load server data).
- localStorage/sessionStorage -> AsyncStorage (already wrapped by zustand persist); tokens -> `storage` (SecureStore).
- `<input type=file>` -> `expo-image-picker` / `expo-document-picker`; geolocation -> `expo-location` (foreground);
  share (`navigator.share`) -> RN `Share`; clipboard -> `expo-clipboard`; `window.open`/external links -> `Linking`;
  QR/barcode scan -> `expo-camera` `CameraView`; print/PDF/download -> `expo-print` + `expo-sharing` +
  `expo-file-system`; framer-motion -> `Animated`/Reanimated at the same intent; react-hot-toast -> `lib/toast`;
  hover/focus rings -> pressed states; fixed bottom bars -> `Screen footer`; `position: sticky` headers -> `Screen header`.
- Check the installed SDK 57 docs before using an Expo API (https://docs.expo.dev/versions/v57.0.0/sdk/<module>/ ,
  node_modules/<pkg>/build/*.d.ts). expo-file-system's current API is the new class-based one
  (`File`, `Directory`, `Paths`); the old functions live in `expo-file-system/legacy`. Install new packages only with
  `npx expo install <pkg>` run from `mobile-user/` (one at a time; if the install fails with peer errors the repo's
  `.npmrc` already has legacy-peer-deps).
- zod schemas / react-query controllers / services in the web `modules/user/{schemas,services,controllers}` are
  platform-agnostic: port them nearly verbatim into `src/modules/user/...` (import paths adapt; `import.meta.env` ->
  `src/config/env.js`). If a file already exists there (another agent ported it), reuse it - do not overwrite; add only
  what is missing.

## Process for each screen
1. Read the web screen + its controllers/services/components fully (and any shared pieces it imports).
2. Record in `mobile-user/checklist/<your-area>.md` (create it): for every screen - web route + guard, every API call
   (method, path, payload, response shape used), native replacements, status per row.
3. Write the native screen(s). Port behaviour 1:1 (validation, disabled states, error toasts, empty states, query keys).
4. Verify: `cd mobile-user && npx eslint <your files>` must be clean (it also flags unresolved imports; imports of
   files owned by other agents may be temporarily unresolved - say so in your report). You may call read-only API
   endpoints with `curl`; the test login is mobile `1111111111`, OTP `123456`
   (`POST https://krozenda.com/api/auth/send-otp` then `/auth/verify-otp` -> `data.accessToken`). Only create/
   update/delete data for that test account and only on data you created; never trigger real payments/refunds/
   messages. Do NOT run `expo export`/`expo start` (the lead runs the bundle to avoid cache clashes).
5. Status per row in your checklist file: **Verified** (you actually ran it / saw it work, e.g. API call via curl
   returning the shape you parse), **Built, not tested**, or **Blocked** (why + what is needed). Never claim Verified
   for UI you could not run.

## Final report (keep it short)
Files created, screens done, icons added (and that you re-ran gen-icons), packages installed, anything you could not
finish, any bug you found in lead-owned files (and the fix you made), assumptions.
