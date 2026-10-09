# checkout-orders checklist

Status: V = Verified, B = Built, not tested, X = Blocked. Test account 1111111111 has 0 orders, no addresses, no reviewable items, so detail/track/invoice responses could not be read live (schemas ported verbatim from web).

## Screens
| Screen (route) | API calls | Native notes | Status |
|---|---|---|---|
| SelectAddressScreen `/checkout/address` | GET /user/addresses, POST /user/addresses (via profile agent's useAddressesController + AddressFormModal) | Bottom nav; default address auto-select; stepper | B |
| OrderSummaryScreen `/checkout/summary` | POST /user/orders/shipping-quote, POST /user/coupons/apply, cart hydrate | Redirects to cart/address when empty; coupon apply/remove | B |
| PaymentScreen `/checkout/payment` | GET /user/orders/payment-methods (V shape: {COD,WALLET,RAZORPAY}), POST /user/orders/razorpay-order, POST /user/orders (Idempotency-Key header) | COD/Wallet/Razorpay; key from create-order response `keyId`, falls back to env.razorpayKeyId. Real payment/order creation NOT tested | B (payment/order creation: not tested by design) |
| OrderPlacedScreen `/checkout/success` | GET /user/orders?limit=1 | Web reads router state, which nothing sets (PaymentScreen goes to /orders); falls back to latest order. Split-order list branch unreachable (needs router state) so omitted | B |
| PaymentMethodScreen | - | Not mounted on any web route (routes.jsx only imports it; checkout/delivery redirects to summary) - skipped | n/a |
| OrderListScreen `/orders` | GET /user/orders?status&page&limit (V: items + pagination), POST /user/orders/:id/reorder | FlatList, tabs, page-local search, pager, pull-to-refresh, Returns link, Return/Replace + Reorder | V (list/empty) / B (rows) |
| OrderDetailsScreen `/orders/[orderId]` | GET /user/orders/:id, reorder | Dropship note (no cancel/return), B2B card, canReturn button. Web has no cancel button on this screen, so none added | B |
| TrackShipmentScreen `.../track` | GET /user/orders/:id, GET /user/orders/:id/tracking | Same timeline + parcel cards; courier link via Linking | B |
| InvoiceDownloadScreen `.../invoice` | GET /user/orders/:id/invoice | Native invoice view; print = expo-print printAsync; download = printToFileAsync + expo-sharing share sheet | B |
| InvoicePreviewScreen `.../invoice/preview` | same | Same, sticky "Download PDF Invoice" footer | B |
| RateReviewScreen `/reviews`, `.../review` | GET /user/reviews/reviewable (V empty), POST /user/reviews (multipart, 60s timeout) | Product picker as Sheet, expo-image-picker photos (max 4, 10MB, type check) | B |

## Ported modules
controllers: useCheckoutController, usePaymentMethodsController, useOrdersController, useReviewableItemsController, useSubmitReviewController, useCouponsController (verbatim). services: orderService, reviewService (timeout + RN FormData descriptors), couponService. schemas: orderSchema, reviewSchema, couponSchema. useShippingQuoteController already existed.

## Verification
- eslint clean on all files.
- curl (read-only): orders list, payment-methods, reviewable, coupons/used return the shapes parsed.
