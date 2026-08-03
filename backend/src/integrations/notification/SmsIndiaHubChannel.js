import { NotificationChannel } from './NotificationChannel.js'

// Stub. Every transactional SMS AND all OTP delivery goes through this
// channel — never Firebase Phone Auth (§4.4, §12). OTP generation, hashing,
// expiry, and rate limiting are this project's responsibility, not the
// provider's; that logic belongs in modules/auth/services once built, not
// here — this file only sends an already-composed message.
// Blocked on client-owned TRAI DLT registration + template approval (§4.4, §10).
export class SmsIndiaHubChannel extends NotificationChannel {}
