# Conversion guide (read fully before writing code)

We are converting the **seller panel** of the Krozenda MERN web app (`../frontend/src/modules/seller` +
`../frontend/src/modules/vendor-shared`, React + Tailwind, rendered at phone width 360-412px, i.e. the `VendorLayout`
mobile shell: `VendorTopbar` + `VendorBottomNav` + drawer `VendorSidebar`) into a native Expo (SDK 57, React Native
0.86, JavaScript only, Expo Router) app in `mobile-seller/`. This is a **conversion, not a redesign**: the web app as it
renders at phone width is the spec. Backend (`../backend`) is read-only; same API, same auth (vendor JWT bearer token,
`POST /vendor/auth/login`). Production API: `https://krozenda.com/api`. Test login: `b2c.demo@krozenda.com` /
`Demo@1234` (B2C) and `b2b.demo@krozenda.com` / `Demo@1234` (B2B) - these hit the LIVE database: GET freely, create/
update/delete only data your own test creates, never trigger payments/refunds/notifications to real users.

## Hard rules
- JavaScript only (`.js`/`.jsx`), no TypeScript. Do NOT touch `../frontend` or `../backend`.
- No WebView of the web app. No mock data, fake APIs, placeholder screens or TODOs for existing functionality.
- Do not add anything the web app does not have. Where the web has separate desktop + mobile layouts, build only the
  mobile one (ignore `sm:`/`md:`/`lg:`/`xl:` branches, hover states, desktop sidebar/table density, `print:`).
  Port what is actually rendered; text is not shortened (truncate only where the web truncates). Skip UI that can
  never appear (setter never called, imported-not-rendered) and list it in your checklist as "unreachable on web".
- Reproduce at phone width: hierarchy, colors, fonts (Plus Jakarta Sans), sizes/weights, spacing, radius, shadows,
  icons, texts/labels, loading/empty/error/success states, animation intent (add none).
- Styling = `StyleSheet.create` + tokens from `src/theme` (`colors`, `radius`, `shadows`, `sp`, `fontSize`).
  `colors` has the full Tailwind palette (`colors.slate[500]`...) plus the web's `brand`, `ink`, `surface`, `border`,
  `success`, `warning`, `danger`. Translate Tailwind classes exactly (px = n*4; `text-sm` = 14/20; `text-2xs` = 11/16;
  see `src/theme/index.js` and `../frontend/tailwind.config.js`). Arbitrary values (`text-[10px]`) as written.
- Mobile behaviour: every request has a timeout (axios does); keyboard must not cover inputs (use
  `KeyboardAvoidingView`/scrollable forms, `keyboardShouldPersistTaps="handled"`); right keyboardType per field;
  block double submit; keep the web's validation exactly; Android back closes the open modal/sheet first
  (`Sheet`/`Drawer` already handle `onRequestClose`); no console logging of tokens/PII.

## What exists (import, do not duplicate; minimal bug fixes only and tell the lead)
- `src/config/env.js`, `src/config/routes.js` (`SELLER_ROUTES`, `AUTH_ROUTES`), `src/theme`.
- `src/lib`: `axios.js` (`api`, bearer token interceptor, 401 -> clearSession), `authStore.js` (`useAuthStore`),
  `storage.js`, `toast.js` (`toast.success/error/...` same API as web `lib/toast` AND `admin/stores/toastStore`),
  `queryClient.js`, `i18n/` (`useT()`, `useLanguageStore`), `useNetworkStatus.js`, `push.js`, `session.js`.
- `src/components/ui`: `Text` (ALWAYS use instead of RN `Text`; auto-translates string children, pass `noTranslate` for
  numbers/codes), `Icon`, `Button`, `Input`, `Sheet` (bottom sheet / centred dialog), `Skeleton`, `SmartImage`,
  `AsyncBoundary`, `ToastHost`, `motion`.
- Web `components/ui` primitives (Badge, Card, Checkbox, EmptyState, Select, Switch, Textarea, Tabs, SegmentedControl,
  Pagination, Table, Avatar, RadioGroup, RadioCards, PasswordInput, Modal, Tooltip) are ported with the SAME names and
  props in `src/components/ui/` (barrel: `src/components/ui/index.js`).
- Web `modules/admin/components/*` pieces that the seller screens import are ported with the SAME names and props in
  `src/components/admin/{shell,data,overlay,forms,feedback,display,charts}/` (each folder has an `index.js` barrel;
  `StatTile` at `src/components/admin/StatTile.jsx`, `dashboard` pieces in `src/components/admin/dashboard/`).
  `PageBody` is a ScrollView (it is the page's scroll container and owns the gutter); the shell already handles the top
  safe-area inset and the bottom nav, so screens never add insets. `ListScreen`/`DataTable` render the table exactly
  as the web does at phone width (horizontally scrollable table, pagination below).
- Seller shell (lead-owned): `src/app/(panel)/_layout.js` renders `VendorTopbar`, the routed screen, `VendorBottomNav`
  and the More drawer. `src/app/(panel)/*.js` route files are thin: they render the screens you create under
  `src/modules/vendor-shared/pages/<Name>.jsx` exporting the SAME name as the web (e.g. `VendorProductsPage`,
  `OrdersPage`, `EarningsPage`). Create exactly those files/exports. Do not edit `src/app` except files named in your
  brief.

## Web -> native cheat sheet
- Folder mirror: web `modules/vendor-shared/{pages,components,controllers,services,schemas,tableColumns,lib,constants.js}`
  -> `src/modules/vendor-shared/...` (same relative structure). Web `lib/*` helpers used by those files -> `src/lib/*`
  (create what is missing; check before writing, another agent may have added it). `import.meta.env` -> `src/config/env.js`.
- `react-router`: `useNavigate()` -> `useRouter()` from expo-router (`router.push/replace/back`; if `!router.canGoBack()`
  go to `SELLER_ROUTES.DASHBOARD`); `useParams`/`useSearchParams` -> `useLocalSearchParams()` (strings);
  `<Link to>` -> `<Pressable onPress={() => router.push(..)}>`; web paths `/seller/x` -> `SELLER_ROUTES.X` (`/x`).
- `useQuery`/`useMutation`/zod schemas/services are platform-agnostic: port nearly verbatim.
- Long lists -> `FlatList` with stable `keyExtractor`; tables are paginated so rows may be plain views.
- localStorage -> AsyncStorage; tokens -> `storage` (SecureStore). `<input type=file>` -> `expo-image-picker` /
  `expo-document-picker` (installed); barcode scan -> `expo-camera` `CameraView` (installed); clipboard ->
  `expo-clipboard`; `window.open`/tel:/mailto: -> `Linking`; CSV/Excel export, PDF/label download/print ->
  `expo-file-system` (new class API: `File`, `Directory`, `Paths`; old API in `expo-file-system/legacy`) + `expo-sharing`
  / `expo-print`; `window.confirm`/alerts -> `Alert` or `ConfirmDialog`; framer-motion -> Animated at same intent;
  recharts -> SVG charts in `src/components/admin/charts`; socket.io-client works as-is (`src/lib/realtime.js`).
- Check SDK 57 docs/typings in `node_modules/<pkg>` before using an Expo API; install new packages only with
  `npx expo install <pkg>` from `mobile-seller/` (one at a time; `.npmrc` has legacy-peer-deps). Tell the lead what you
  added.
- Icons: `<Icon name="..." />` accepts the web's semantic names (`dashboard`, `search`, ...) and react-icons export names
  (`HiOutlineEnvelope`). After using a NEW react-icons name run `node tools/gen-icons.mjs` from `mobile-seller/`.

## Process
1. Read the web source fully (screen + controllers/services/components it imports).
2. Write `mobile-seller/checklist/<area>.md`: per screen - web route + guard, wrapper/shell, every API call (method,
   path, payload, response used), native replacements, status per row (Verified / Built, not tested / Blocked - never
   claim Verified for what you did not run).
3. Write the native code, 1:1 behaviour.
4. Verify: `cd mobile-seller && npx eslint <your files>` clean (it flags unresolved imports; imports of files another
   agent is still writing may be temporarily unresolved - say so). GET endpoints can be checked with curl using a token
   from the test login.
5. Final report to the lead: files created, deps added, anything blocked / unreachable, backend gaps.
