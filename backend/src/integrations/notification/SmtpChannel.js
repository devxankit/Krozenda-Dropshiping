import { NotificationChannel } from './NotificationChannel.js'

// Stub. Must be a queued sender with retry, not synchronous in the request
// cycle (§4.5) — wire up a queue (e.g. a job table or worker) when this is
// implemented, don't call send() straight from a controller.
// Blocked on client-owned SPF/DKIM/DMARC DNS records (§4.5, §10).
export class SmtpChannel extends NotificationChannel {}
