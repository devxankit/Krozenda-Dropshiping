# SMS India Hub — OTP gateway

Krozenda sends its login/registration OTP through SMS India Hub.
Implementation: `backend/utils/smsService.js`, called from
`backend/Controllers/userAuthController.js` (`requestOtp`).

No API keys are written in this file. Live values live in `.env`, which is not committed.

---

## Current arrangement: Krozenda sends on the Mynzo account

This is a deliberate, temporary setup. Read this section before touching any
`SMS_INDIA_HUB_*` var or the OTP message text.

Krozenda has its own SMS India Hub account, but **no DLT template registered under
its own entity**. Rather than wait for a template approval, Krozenda currently sends
on the **Mynzo** account, reusing Mynzo's API key, entity and template.

| Var | Value | Belongs to |
|---|---|---|
| `SMS_INDIA_HUB_API_KEY` | see `.env` | Mynzo account |
| `SMS_INDIA_HUB_ENTITY_ID` | `1001376214913784124` | Mynzo principal entity |
| `SMS_INDIA_HUB_TEMPLATE_ID` | `1007282516644508833` | registered under the Mynzo entity |
| `SMS_INDIA_HUB_SENDER_ID` | `BGADEC` | Mynzo header |

Krozenda's own (currently unused) credentials are preserved in `.env.bak-sms` —
a separate account with entity `1001164203633432409` and roughly 10,000 credits.

### Consequences you are accepting

- **The OTP SMS says "Mynzo", not "Krozenda".** Krozenda users receive a message
  branded for a different product. The text cannot be changed — see below.
- **Krozenda's OTP traffic is attributed to Mynzo's registered entity** under TRAI DLT.
  That is a compliance irregularity, and complaints or scrubbing action land on the
  Mynzo account.
- **Both apps draw down the same credit pool** (~49,842 transactional at time of
  writing). Krozenda's own credits sit unused.

### The message text is frozen

```
Welcome to the Mynzo powered by Appzeto.Your OTP for registration is {#var#}.BGADEC
```

DLT scrubbing compares the submitted body against the registered template
character for character; only the `{#var#}` slot may vary. `buildOtpMessage()`
hard-codes this string on purpose — it is **not** read from `APP_NAME`, because
substituting "Krozenda" is exactly what produced the historic failures.

---

## Long-term fix

Register Krozenda's own DLT content template under Krozenda's own entity
(`1001164203633432409`) with Krozenda wording, then:

1. Restore Krozenda's own API key and entity ID in `.env` (from `.env.bak-sms`).
2. Set `SMS_INDIA_HUB_TEMPLATE_ID` to the newly approved template ID.
3. Update `buildOtpMessage()` to the new registered text.
4. Confirm the sender ID / header is approved on the Krozenda account — `BGADEC`
   is Mynzo's header and may not be usable there.

Approval typically takes a few days.

---

## History: the ErrorCode 006 failures

Sends used to fail with `ErrorCode 006 — Invalid template text`. This was **not** a
provider-side linkage problem (an earlier code comment claimed it was, and that was
wrong). Two independent faults were present at the same time:

1. **Template borrowed across accounts.** `SMS_INDIA_HUB_TEMPLATE_ID` was Mynzo's
   template `1007282516644508833`, while the API key and entity ID pointed at the
   Krozenda account. A DLT template only resolves under the entity it was registered
   to, so the gateway could not match it.
2. **Brand text mismatch.** `buildOtpMessage()` used `process.env.APP_NAME || 'Krozenda'`,
   and `APP_NAME` was never set — so the body said "Krozenda" where the registered
   template said "Mynzo".

Fixing only one of the two would still have returned 006.

---

## Guard against a reverted .env

`.env` has already been restored from an older backup once, which silently put the
Krozenda entity id back while `buildOtpMessage()` still held the Mynzo wording — the
exact 006 mismatch described above, but now in production where it just looks like
"OTP login is broken".

`sendOtpSms` therefore checks `SMS_INDIA_HUB_ENTITY_ID` against `MYNZO_ENTITY_ID`
(hard-coded in `smsService.js`, deliberately not read from `.env`) and throws a
message naming the real cause before any request goes out:

```
SMS_INDIA_HUB_ENTITY_ID is 1001164203633432409, but the OTP template text in
buildOtpMessage() is registered under 1001376214913784124. The gateway will
reject this with ErrorCode 006. ...
```

When Krozenda moves to its own template, update `MYNZO_ENTITY_ID` and
`buildOtpMessage()` together — they are one unit.

---

## Test-number bypass

`TEST_PHONE_NUMBERS` in `.env` (comma separated) lists numbers that skip the gateway
**even in production** and accept the fixed OTP `123456` — for app-store reviewers and
QA handsets, so verifying a build never depends on a live SMS arriving or spends a
credit. The OTP is still never returned in the API response; whoever uses these numbers
already knows the fixed code. Unset or empty disables the bypass.

---

## Verifying it works

Balance check — read-only, sends nothing, costs nothing:

```bash
node --env-file=.env -e "require('./utils/smsService').checkSmsBalance().then(console.log)"
# -> Success#Promotional:4|Transactional:49842
```

Live send — costs 1 credit and delivers a real SMS:

```bash
node --env-file=.env -e "
require('./utils/smsService').sendOtpSms('<10-digit-number>','123456')
  .then(r=>console.log('ACCEPTED:',JSON.stringify(r)))
  .catch(e=>console.error('FAILED:',e.message))"
```

Last verified send returned:

```json
{
  "ErrorCode": "000",
  "ErrorMessage": "Done",
  "JobId": "115718719",
  "MessageData": [{ "Number": "918225819420", "MessageId": "WdkexFA4B0W3o6iCbywWfw" }]
}
```

Transactional balance moved `49843` → `49842`, confirming a real submission.

### Reading the gateway response

- The gateway returns **HTTP 200 even on rejection** — never treat `res.ok` as success.
  `isSuccess()` checks `ErrorCode === "000"`.
- `ErrorCode 006` = "Invalid template text" — the body does not match the registered
  template, or the template does not belong to the entity being used.
- Accepted ≠ delivered. `000` means DLT scrubbing passed and the operator took the
  message. Handset delivery still depends on carrier and DND status; trace a specific
  message on the SMS India Hub panel using its `MessageId`.

---

## Notes

- Only production sends SMS. Dev and staging use the fixed OTP `123456`
  (`userAuthController.requestOtp`), so no live SMS account is needed locally.
- `gwid=2` (transactional) is required — the account's promotional balance is 4.
- `sendOtpSms` throws on rejection and `requestOtp` returns HTTP 502. Do not soften
  that into a success response: a swallowed failure means the user waits for an OTP
  that was never sent.
- The API key travels in a URL query string. Keep it server-side only.
