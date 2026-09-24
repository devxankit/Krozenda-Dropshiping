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
