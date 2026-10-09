# auth-home-ai checklist

Status: **Verified** = API shape confirmed with curl against production; **Built, not tested** = eslint clean, UI not run on device; **Blocked** = reason given.

## Login (`src/modules/auth/LoginScreen.jsx`, web `/auth/*` LoginPage, public)
| Item | Detail | Status |
|---|---|---|
| POST /auth/send-otp | `{mobileNumber}` -> `data.isRegistered` | Verified (curl, 1111111111) |
| POST /auth/verify-otp | `{mobileNumber, otp}` -> `data.user/accessToken/refreshToken`, `isNewUser` (top level) | Verified (curl) |
| Steps 1-4 (welcome, mobile, OTP, verified) | `mode=welcome` starts at step 1, else 2; back button/Android back follow web goBack | Built, not tested |
| Redirect after login | `redirect` route param (must start with `/`, not `/auth`) else DASHBOARD | Built, not tested |
| Session | `setSession` incl. refreshToken; cart/wishlist merge via auth store; `enablePush()` on "Continue" tap | Built, not tested |
| Language adoption | `adoptFromAccount` runs globally from AiAssistantLauncher (web TranslationProvider effect) | Built, not tested |
| OTP input | 6 boxes, paste/autofill spread, backspace focus, `autoComplete="sms-otp"` + `textContentType="oneTimeCode"` | Built, not tested |
| SMS User Consent API (Flutter wrapper auto-read SMS) | No Expo module exposes Android SMS User Consent; needs a custom native module / dev client | **Blocked** |
| Resend timer 45s, resend, error/success alerts, loading states | ported | Built, not tested |
| Animations (stagger, halos, shine, glow strip, step fade) | Animated API | Built, not tested |
| Terms/Privacy/Help links | open web pages via Linking (web used target=_blank) | Built, not tested |
| New-user name capture | web LoginPage has none (name only sent optionally) - not added | n/a |

## Home (`HomeScreen.jsx`, `HomeCenterFeed.jsx`, web `/app/dashboard`, public)
| Item | Detail | Status |
|---|---|---|
| Feed queries (useHomeFeed) | GET /catalog/categories, /catalog/products?flashSale/trending, /catalog/brands, /catalog/banners, /catalog/coupons | Built, not tested |
| All Products rail | useProductsController + useCatalogSettingsController (catalog agent) | Built, not tested |
| Header: logo, search (focus collapses logo/icons), language, bell dot, cart badge | ported | Built, not tested |
| Hero 16:9 carousel auto 5.5s + dots; categories bar; hot deals + midnight countdown; trending; brands; trust strip | ported; blurred backdrop copy of hero omitted (fully covered by cover image) | Built, not tested |
| Pull to refresh | refetch `['catalog']` queries | Built, not tested |
| Bottom tab bar | `<Screen nav activeTab="home">` | Built, not tested |

## AI assistant (`components/ai/*`, mounted in `_layout.js`)
| Item | Detail | Status |
|---|---|---|
| POST /user/ai/chat, GET /user/ai/conversations, GET/DELETE /user/ai/conversations/:id | services/schemas/controller ported verbatim | Built, not tested |
| FAB (bottom 76+inset, right 16), panel as 88% bottom-sheet Modal, history overlay, suggestions, retry | ported | Built, not tested |
| Signed-out users | follows web: button shown, tap goes to login with `redirect` (see report) | Built, not tested |
| Hidden on /auth/* | web mounts it only inside buyer routes | Built, not tested |
| Keyboard avoidance in Modal | KeyboardAvoidingView padding | Built, not tested |

## LanguageSwitcher (`src/components/common/LanguageSwitcher.jsx`)
| Item | Detail | Status |
|---|---|---|
| compact / field variants, Sheet picker, native-script names | ported; web "translating" spinner omitted (no busy flag in lib/i18n) | Built, not tested |
