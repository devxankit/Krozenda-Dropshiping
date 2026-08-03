// Contract every notification channel must satisfy (project context §12).
// Three channels in scope: FCM push (§4.3, push only — no Auth/Firestore),
// SMS India Hub (§4.4, DLT-templated), SMTP (§4.5). Templates are DATA
// (DLT constraint — §4.4), so `templateKey` looks one up rather than a
// channel building message text inline.
export class NotificationChannel {
  /** @param {string} recipient @param {string} templateKey @param {object} payload */
  async send(_recipient, _templateKey, _payload) {
    throw new Error('Not implemented')
  }
}
