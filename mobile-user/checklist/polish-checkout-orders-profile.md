# Polish pass: checkout / orders / profile / support / ai / auth / cms

Status of everything below: **Built, not tested on a device** (eslint clean on `src/modules/user/components`, `src/modules/auth`, `src/modules/cms`).

## Animations (all via `components/ui/motion.jsx`, Reanimated UI thread, reduced-motion honoured, <=250ms)
- CheckoutStepper: animated progress bar (240ms), turns green on the final step; progressbar a11y label.
- SelectAddress: rows enter staggered (first 6), PressableScale on options, radio dot / tick fade in, CTA PressableScale.
- OrderSummary: CTA PressableScale; back button role + hitSlop.
- Payment: method cards stagger + press scale, radio dot fade, error box fades in (`role=alert`), CTA with spinner while placing.
- OrderPlaced: tick springs in over an expanding halo (Reanimated only, no Lottie), text/details fade in, buttons PressableScale.
- OrderList: rows enter staggered, card press scale + a11y label, reorder error fades in.
- TrackShipment: timeline steps stagger in.
- RateReview: tapped star pops (`usePop`), `radio` role.
- Login OTP: shake + red cell borders on a failed verification (error alert text remains, so not animation-only).
- AI chat: messages fade/rise in.
- Notifications: rows enter + `smoothLayout` on delete. Coupons / wallet transaction rows stagger in.

## Performance / guards
- Orders list: module-level `keyExtractor`/separator, `initialNumToRender=6`, `windowSize=7`, `removeClippedSubviews`.
- Notifications list: stable keyExtractor/separator, `initialNumToRender=8`, `windowSize=7`.
- AI chat: `MessageBubble` memoised (panel re-renders per keystroke), stable `renderItem`, `initialNumToRender=12`.
- Double-submit guards (synchronous refs, in addition to existing `isPending` flags): Payment `handlePay`,
  Login `verifyOtpCode` (auto-submit on 6th digit + button), Wallet and Profile add-money confirm.
  Reorder button now disables for all rows while one reorder is in flight.
- Controllers audited: global query default staleTime 30s, invalidations already targeted (`['user','orders']`,
  order id, addresses, wallet, reviewable, returns); payment-methods intentionally `staleTime: 0` (server authoritative).
  No controller changes were needed.

## Skipped / not done
- OrderDetails, Help/Support modals, Edit profile, Settings, Addresses: no entering animations added (kept as is) - time-boxed.
- Server-authoritative flows untouched: payment verify flow, totals, order creation payload unchanged.
- No new screens, routes, deps or icons.
