# G1 - Auth (login / forgot-password / register)

Status key: Verified = run against live API; Built, not tested = written + eslint clean, not exercised on a device/emulator.

## Files
- `src/modules/vendor-shared/pages/VendorLoginPage.jsx` (`VendorLoginPage`, `SellerLoginPage`, `ForgotPasswordFlow`)
- `src/modules/vendor-shared/pages/VendorRegisterPage.jsx` (`VendorRegisterPage`)
- `src/modules/vendor-shared/components/modals/PolicyAcceptanceModal.jsx`
- `src/components/common/PolicyContent.jsx`
- `src/modules/vendor-shared/components/auth/AuthFields.jsx` (local: `AuthInput`, `AuthSelect`, `AuthLabel`, `AuthError`, `AuthButton`; replicates the web's raw styled inputs/buttons)
- Edit: `src/modules/vendor-shared/components/shell/VendorAuthShell.jsx` - added optional `scrollRef` prop (forwarded to its ScrollView) so the register wizard can scroll to top on step change (web: `window.scrollTo`).

## /seller/login -> `src/app/login.js` (public route)
| Item | Native | Status |
|---|---|---|
| Shell `VendorAuthShell` title/subtitle | same | Built, not tested |
| B2C/B2B segmented switch (clears email/password/error; web only prefilled demo creds in dev - NOT prefilled here) | Pressable segment | Built, not tested |
| `POST /vendor/auth/login {email,password}` -> `data.{token,vendor}` | `useVendorLoginController` | Verified (curl, demo B2C login returns token); UI flow Built, not tested |
| Session: `setSession({user{id,name,email,storeName,entityType,language}, roles:['seller', b2b_seller/b2c_seller], permissions:['seller.access','vendor.access'], accessToken})` | identical | Built, not tested |
| `registerPushToken()` then toast "Signed in" then `router.replace(SELLER_ROUTES.DASHBOARD)` | identical | Built, not tested |
| Error alert tones for VERIFICATION_PENDING / VERIFICATION_REJECTED / ACCOUNT_INACTIVE / default + matching toasts | same colors/titles | Built, not tested |
| Show/hide password, "Forgot password?" toggle, "Create an account" -> `AUTH_ROUTES.REGISTER` | same | Built, not tested |
| HTML `required` (blocks empty submit) | empty email/password shows inline alert, no request | Built, not tested |
| Keyboard: email-address + autoCapitalize none, next -> password, `go` submits; shell has KeyboardAvoidingView + `keyboardShouldPersistTaps="handled"` | yes | Built, not tested |
| Double submit guard | `busy` ref + `isSubmitting` disabled | Built, not tested |
| `mode="partner"` demo branch (`PartnerDemoLoginPage`) | out of scope, not ported (prop ignored) | n/a |

### ForgotPasswordFlow (view inside login)
| Step | API | Status |
|---|---|---|
| request: email | `POST /vendor/auth/forgot-password {email}` -> `data.otp` shown as "Demo OTP" + Auto-fill if returned | Built, not tested (not called live: sends email to a real inbox) |
| reset: OTP (number-pad, max 6, mono), new password, confirm | `POST /vendor/auth/reset-password {email,otp,newPassword,confirmPassword}` then back to login with email filled, password cleared | Built, not tested (not called live per brief) |
| Cancel / Back buttons, error box, button labels ("Sending Code...", "Saving...") | same | Built, not tested |

## /seller/register -> `src/app/register.js` (public route)
| Item | Native | Status |
|---|---|---|
| 3-step wizard + stepper (labels hidden at phone width as on web), per-step `validateStep` verbatim | same | Built, not tested |
| Step 1: B2C/B2B cards, name, mobile (phone-pad, max 10), email (email-address), password/confirm (secure + eye) | same | Built, not tested |
| Step 2: store name, business structure (select; required star only B2B), PAN (upper, mono, max 10), GST registered select, GSTIN (upper, max 15), sells food select + hint, FSSAI no. (digits only, number-pad, max 14), B2B contact person (name, mobile) | `AuthSelect` opens shared `OptionSheet` | Built, not tested |
| KYC uploads (PAN, GST, FSSAI, food test): pick -> type check (jpeg/png/webp/pdf) + 10MB check -> `POST /vendor/auth/upload-doc` multipart `file` -> `{url,filename}`; uploaded row with remove; error text | `expo-document-picker` (images + PDF from one picker, copied to cache) -> `{uri,name,type}` appended to FormData | Built, not tested (upload would create files on live storage) |
| Step 3: address line, city, state, pincode (number-pad, max 6), bank holder/bank name/account no. (number-pad)/IFSC (upper, max 11, regex check), policy checkbox (opens modal; click again clears) | same | Built, not tested |
| Policy modal: `GET /public/cms-acceptance` (no cache) -> list of `{slug,title,version,updatedAt,content}`; quick-link chips scroll to a doc; Accept enabled once scrolled to end (or content fits); "I Accept All N & Continue" -> `onAccepted([{slug,title,version}])`; empty -> Continue; error -> Try again | `ScrollView` onScroll/onContentSizeChange replaces IntersectionObserver | Policies endpoint Verified (curl, returns 200 + docs); modal UI Built, not tested |
| Submit: `POST /vendor/auth/register` with payload built exactly as web (documents[], policyAcceptances[{slug,version}]); POLICY_VERSION_CHANGED / POLICIES_NOT_ACCEPTED clears acceptance; server error box + toast | same | Built, not tested (NOT called: would create an account on the live DB) |
| Success view ("Application Submitted", summary, Go to Seller Login -> `router.replace(AUTH_ROUTES.LOGIN)`) | same | Built, not tested |
| "Already selling on Krozenda? Sign In" -> `AUTH_ROUTES.LOGIN` | `router.replace` | Built, not tested |
| Scroll to top on step change / submit | `scrollRef` on shell ScrollView | Built, not tested |

## Unreachable on web (not ported)
- `contactDesignation`, `contactEmail`, `tradeName` form fields exist in state/payload but no input renders them (sent as empty strings, same as web).
- `PartnerDemoLoginPage` (out of scope).

## Notes / deviations
- Web file `<input type=file>` accepts images and PDFs via the browser dialog; native uses one document picker filtered to those MIME types (no camera/gallery split, no extra permissions).
- Native input affordances not on web: `returnKeyType`/focus chaining on login, autofill hints.
- `PolicyContent` markdown subset ported 1:1 (h1/h2/bullets/bold/line breaks); no dangerouslySetInnerHTML equivalent.
- lint: `npx eslint` on all files above is clean.
