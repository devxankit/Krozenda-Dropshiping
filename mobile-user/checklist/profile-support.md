# profile-support checklist

Status: Verified = ran/seen; Built, not tested = written + eslint clean, not run on a device.

| Screen (native route) | Web route / guard | API calls | Native replacements | Status |
|---|---|---|---|---|
| ProfileDashboardScreen (/profile) | /app/profile, protected | GET /auth/me, GET /user/wallet, POST /user/wallet/topup/order + /verify (Razorpay), DELETE /auth/account | SVG gradient, Sheet modals, logout = `unregisterPushToken()` then `clearSession()` then replace to login, nav tab "profile" | Built, not tested (top-up payment never triggered) |
| EditProfileScreen (/profile/edit) | /app/profile/edit | GET /auth/me, PUT /auth/profile, POST /auth/profile/image (multipart `image`), PUT /auth/change-password | expo-image-picker (mime + 10MB check), @react-native-community/datetimepicker for DOB | Built, not tested |
| MyAddressesScreen (/profile/addresses) | /app/profile/addresses | GET/POST /user/addresses, PUT/DELETE /user/addresses/:id, PATCH /user/addresses/:id/default | Sheet form | Built, not tested |
| AddressFormModal | modal | pincode: GET api.postalpincode.in; reverse geocode: Nominatim then BigDataCloud (same as web; no map widget exists in the web form) | expo-location foreground permission + getCurrentPositionAsync (10s timeout), state picker Sheet with search, AsyncStorage `krozenda.lastPincode` prefill | Built, not tested |
| WishlistScreen (/wishlist) | /app/wishlist | wishlistStore (GET/POST/DELETE /user/wishlist), cartStore.addItem | FlatList 2 columns; web builds its own cards (no ProductCard), ported inline; nav bar | Built, not tested |
| WalletScreen (/wallet) | /app/wallet | GET /user/wallet, topup order + verify | native Razorpay via `openRazorpayCheckout`; nav tab "profile" | Built, not tested (no real payment) |
| CouponsOffersScreen (/coupons) | /app/coupons | GET /user/coupons/used | none (no nav bar, as web) | Built, not tested |
| NotificationCenterScreen (/notifications) | /app/notifications | notificationStore: GET /user/notifications, PATCH read/read-all, DELETE | FlatList + pull to refresh + load older | Built, not tested |
| SettingsScreen (/settings) | /app/settings | PUT /auth/language (via languageStore) | picker Sheet instead of `<select>`; links to /privacy and /terms; web has no logout/delete here (those are on the profile screen) | Built, not tested |
| HelpSupportScreen (/support) | /app/support | GET /faq, GET /user/tickets | Linking for WhatsApp/tel/mailto; ticket id cache moved localStorage to AsyncStorage; no nav bar (as web) | Built, not tested |
| RaiseTicketModal | modal | POST /user/tickets, GET orders (fetchUserOrders) | order picker Sheet. Web has NO attachment upload, so none added | Built, not tested |
| TicketDetailsModal | modal | GET /user/tickets/:id, POST .../messages, PATCH .../status | ScrollView auto-scroll | Built, not tested |
| ReturnReplacementScreen (/returns) | /app/returns?orderId= | GET /user/returns/returnable, POST /user/returns (multipart `photos`) | expo-image-picker multi-select (max 4), item picker Sheet, `orderId` via route params | Built, not tested |
| PublicCmsScreen (/terms, /privacy, /return-policy, /shipping-policy, /about, /cod-policy, /p/[slug]) | public | GET /public/cms/:slug (fallback text bundled) | content is plain text / light markdown (not HTML), so rendered natively by PolicyContent port, no HTML renderer needed; expo-clipboard link copy; expo-print for Print | Built, not tested |

Services/controllers/schemas ported: profile, wallet, address, faq, ticket, return (+ controllers useProfile/useWallet/useAddresses/useReturns). coupon files already existed (checkout agent).
Footer (web) intentionally not ported on Wishlist, Wallet, Support, CMS (guide rule).
