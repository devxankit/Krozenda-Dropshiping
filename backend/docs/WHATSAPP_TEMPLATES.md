# WhatsApp templates (BhashSMS)

Sent by `services/whatsappService.js`, triggered from the Order model hooks in
`Models/Order.js`. Submit each template below in the BhashSMS panel for Meta
approval. Once one is approved, put its name in the matching env var in
`.env` and restart the server — no code change needed.

Rules for every template:

- **Category:** Utility. **Language:** English.
- The variables must stay in exactly the order shown: the code fills
  `{{1}}`, `{{2}}`… in that order.
- A status whose env var is empty is **skipped**, never sent with another
  template's wording. The one exception is "order placed", which falls back to
  the already-approved `order_update` (`WHATSAPP_TEMPLATE_DEFAULT`).

| Event | When it fires | Env var | Template name |
|---|---|---|---|
| Order placed | order created (checkout, admin order) | `WHATSAPP_TEMPLATE_ORDER_PLACED` | `order_placed` |
| Confirmed | order moves to PROCESSING | `WHATSAPP_TEMPLATE_ORDER_CONFIRMED` | `order_confirmed` |
| Shipped | order moves to SHIPPED | `WHATSAPP_TEMPLATE_ORDER_SHIPPED` | `order_shipped` |
| Delivered | order moves to DELIVERED | `WHATSAPP_TEMPLATE_ORDER_DELIVERED` | `order_delivered` |
| Cancelled | order is cancelled (buyer, admin, seller, CJ refusal) | `WHATSAPP_TEMPLATE_ORDER_CANCELLED` | `order_cancelled` |

---

## order_placed

Variables: `{{1}}` first name · `{{2}}` order number · `{{3}}` amount · `{{4}}` order date

```
Hi {{1}}, thank you for shopping with Krozenda! 🛍️

Your order {{2}} for {{3}} was placed successfully on {{4}}.

We will keep you updated here on WhatsApp at every step. You can also track it anytime in the Krozenda app under My Orders.
```

Sample: `Rehan, ORD-9F3A21BC, Rs.999, 24-09-2026`

## order_confirmed

Variables: `{{1}}` first name · `{{2}}` order number · `{{3}}` amount · `{{4}}` date

```
Hi {{1}}, good news! ✅

Your Krozenda order {{2}} for {{3}} was confirmed on {{4}} and is now being packed.

We will message you again as soon as it is shipped.
```

## order_shipped

Variables: `{{1}}` first name · `{{2}}` order number · `{{3}}` courier · `{{4}}` tracking number

```
Hi {{1}}, your Krozenda order {{2}} is on its way! 🚚

Courier: {{3}}
Tracking number: {{4}}

You can follow the delivery in the Krozenda app under My Orders.
```

When the courier or AWB is not known yet the code sends `our courier partner`
/ `shared soon`, so the message still reads correctly.

## order_delivered

Variables: `{{1}}` first name · `{{2}}` order number · `{{3}}` amount · `{{4}}` delivery date

```
Hi {{1}}, your Krozenda order {{2}} for {{3}} was delivered on {{4}}. 🎉

We hope you love your purchase! If anything is not right, reach us anytime from Help & Support in the Krozenda app.

Thank you for shopping with Krozenda.
```

## order_cancelled

Variables: `{{1}}` first name · `{{2}}` order number · `{{3}}` amount · `{{4}}` refund status

```
Hi {{1}}, your Krozenda order {{2}} for {{3}} has been cancelled.

Refund: {{4}}.

For any help, contact us from Help & Support in the Krozenda app.
```

`{{4}}` is one of:

- `to your original payment method in 5-7 working days` (dropship/CJ orders, refunded via Razorpay)
- `credited to your Krozenda wallet` (other prepaid orders)
- `not applicable as no payment was taken` (COD)

---

## login_otp (OTP)

Sent by `sendOtpWhatsApp` from `userAuthController.requestOtp`, at the same
time as the SMS and with the same code. **Production only** — exactly like the
SMS: dev/staging and the bypass numbers (`1111111111`, `TEST_PHONE_NUMBERS`)
never send anything. Env var: `WHATSAPP_TEMPLATE_OTP`. If it is empty, login
works on SMS alone as before.

- **Category:** Authentication (not Utility — Meta rejects OTPs in Utility).
- **Language:** English.
- **Code delivery:** Copy code button.
- Tick "Add security recommendation" and "Add expiry time" → **5 minutes**
  (the OTP's real validity, `OTP_TTL_MS`).

Variables: `{{1}}` the 6-digit OTP

Meta generates the body text itself for Authentication templates; it reads:

```
*{{1}}* is your verification code. For your security, do not share this code.

This code expires in 5 minutes.
```

Button: `Copy code`

Sample: `482913`

The code sends a single param (the OTP). If BhashSMS's panel shows the copy-code
button needing its own value, do one live send to your own number after
approval and check the raw response in the logs (`[requestOtp] WhatsApp send
failed: …`) before relying on it.

---

## coupon_offer (Marketing)

Sent from **Admin → Marketing → Coupons → WhatsApp** on an active or upcoming
coupon, either to every customer the coupon is valid for (its New / Existing /
Specific eligibility is respected) or to hand-picked customers. Each customer
gets a given coupon at most once; failed sends are retried on the next send.
Env var: `WHATSAPP_TEMPLATE_COUPON`. If it is empty the drawer says so and
nothing is sent.

- **Category:** Marketing (not Utility — Meta rejects offers in Utility).
- **Language:** English.
- **No buttons.** The code sends only the five body variables; a "Copy offer
  code" button needs its own value, so don't add one.

Variables: `{{1}}` first name · `{{2}}` coupon code · `{{3}}` offer · `{{4}}` minimum order · `{{5}}` valid till

```
Hi {{1}}, here is a special offer from Krozenda just for you! 🎁

Use code *{{2}}* to get {{3}} on your next order.
Minimum order value: {{4}}
Valid till: {{5}}

Apply the code at checkout in the Krozenda app. Happy shopping!
```

Sample: `Rehan, SAVE20, 20% off (up to Rs.200), Rs.499, 31-12-2026`

`{{3}}` is `20% off`, `20% off (up to Rs.200)` or `Rs.100 off`, with
` on selected items` added when the coupon is limited to products,
categories or sellers. `{{4}}` is `Rs.499` or `no minimum`. A customer with no
name gets `there` for `{{1}}` ("Hi there, …").

---

# Seller, reminder, delivery, refund and admin templates

Sent through `sendTemplateOnce` in `services/whatsappService.js`. Each send is
claimed in the `NotificationDispatch` collection first, so a retried webhook or
a second server instance never sends the same message twice. Same rule as
above: **an empty env var means the message is skipped** (the push and in-app
notification still go out).

Amounts come as `Rs.1499`, with no comma, because a comma would split the
variable. Links need `FRONTEND_URL` to be set. Without it, the variable reads
`the Krozenda app`.

| Template | Category | Env var | When |
|---|---|---|---|
| `vendor_new_order` | Utility | `WHATSAPP_TEMPLATE_VENDOR_NEW_ORDER` | a seller's product is ordered (skipped if the seller turned off order updates) |
| `vendor_settlement` | Utility | `WHATSAPP_TEMPLATE_VENDOR_SETTLEMENT` | a settlement is marked paid, or a Razorpay Route transfer is confirmed |
| `vendor_account` | Utility | `WHATSAPP_TEMPLATE_VENDOR_ACCOUNT` | admin approves or rejects a seller application |
| `payment_pending` | Utility | `WHATSAPP_TEMPLATE_PAYMENT_PENDING` | checkout reached Razorpay but no order 30 min later; at most one per buyer per day |
| `out_for_delivery` | Utility | `WHATSAPP_TEMPLATE_OUT_FOR_DELIVERY` | Shiprocket or CJ tracking marks the parcel out for delivery |
| `delivery_failed` | Utility | `WHATSAPP_TEMPLATE_DELIVERY_FAILED` | the courier reports a failed delivery attempt (Shiprocket NDR, or CJ `DELIVERY_FAILED`) |
| `refund_processed` | Utility | `WHATSAPP_TEMPLATE_REFUND_PROCESSED` | a return refund reaches the wallet, or Razorpay confirms a refund |
| `cart_reminder` | **Marketing** | `WHATSAPP_TEMPLATE_CART_REMINDER` | cart left unchanged for 24 h (the 1 h reminder is push only) |
| `review_request` | **Marketing** | `WHATSAPP_TEMPLATE_REVIEW_REQUEST` | 2–5 days after delivery, if an item is not reviewed yet |
| `admin_alert` | Utility | `WHATSAPP_TEMPLATE_ADMIN_ALERT` | urgent alerts, sent to `ADMIN_ALERT_WHATSAPP_NUMBERS` |

## vendor_new_order

Variables: `{{1}}` seller first name · `{{2}}` order number · `{{3}}` item count · `{{4}}` amount

```
Hi {{1}}, you have a new Krozenda order! 🛒

Order: {{2}}
Items: {{3}}
Value: {{4}}

Please pack and dispatch it from Orders in your seller panel.
```

Sample: `Asha, ORD-9F3A21BC, 2, Rs.1998`

## vendor_settlement

Variables: `{{1}}` seller first name · `{{2}}` amount · `{{3}}` reference

```
Hi {{1}}, your Krozenda settlement of {{2}} has been paid to your bank account. 💰

Reference: {{3}}

You can see the details under Earnings in your seller panel.
```

Sample: `Asha, Rs.12450, UTR 412345678901`

## vendor_account

Variables: `{{1}}` seller first name · `{{2}}` `approved` / `not approved` · `{{3}}` next step or rejection reason

```
Hi {{1}}, your Krozenda seller application has been {{2}}.

{{3}}.

Log in to the seller panel for details.
```

Samples: `Asha, approved, Log in and list your first products` ·
`Asha, not approved, GST certificate is not readable`

## payment_pending

Variables: `{{1}}` first name · `{{2}}` amount · `{{3}}` cart link

```
Hi {{1}}, your Krozenda order of {{2}} is not complete yet because the payment did not go through.

Your cart is saved. Complete your order here: {{3}}
```

Sample: `Sana, Rs.1499, https://krozenda.com/app/cart`

## out_for_delivery

Variables: `{{1}}` first name · `{{2}}` order number · `{{3}}` courier · `{{4}}` tracking number

```
Hi {{1}}, your Krozenda order {{2}} is out for delivery today! 📦

Courier: {{3}}
Tracking number: {{4}}

Please keep your phone reachable so the delivery partner can contact you.
```

## delivery_failed

Variables: `{{1}}` first name · `{{2}}` order number · `{{3}}` courier · `{{4}}` tracking number

```
Hi {{1}}, {{3}} could not deliver your Krozenda order {{2}} today.

Tracking number: {{4}}

They will try again. Please keep your phone reachable, or contact us from Help & Support in the Krozenda app.
```

## refund_processed

Variables: `{{1}}` first name · `{{2}}` order number · `{{3}}` amount · `{{4}}` where it went

```
Hi {{1}}, your refund of {{3}} for Krozenda order {{2}} has been processed.

It has been {{4}}.
```

`{{4}}` is `credited to your Krozenda wallet` or
`sent to your original payment method (5-7 working days)`.

## cart_reminder (Marketing)

Variables: `{{1}}` first name · `{{2}}` item count · `{{3}}` first product name · `{{4}}` cart link

```
Hi {{1}}, you left {{2}} item(s) in your Krozenda cart, including {{3}}. 🛍️

They are still waiting for you. Complete your order here: {{4}}
```

## review_request (Marketing)

Variables: `{{1}}` first name · `{{2}}` product(s) · `{{3}}` review link

```
Hi {{1}}, how are you liking {{2}}? ⭐

Your review helps other shoppers choose. It takes less than a minute: {{3}}
```

## admin_alert

Variables: `{{1}}` alert title · `{{2}}` details

```
Krozenda alert: {{1}}

{{2}}

Open the admin panel for details.
```

Unlike every other template, both variables go out in full: the title up to
100 characters and the details up to 800. Other templates cap each variable at
60, but a cut-off alert is useless. Meta's limit is 1024 characters for the
whole body, so keep the template's own text short, as above.
