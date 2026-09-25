// Layer rule: services/ is the ONLY place that imports the axios instance.

import { api } from '../../../lib/axios'
import { fetchResource } from './mockTransport'
import { shellSummaryFixture } from '../fixtures/shell'
import { shellSummarySchema } from '../schemas/shellSchema'

export function fetchShellSummary() {
  return fetchResource({
    path: '/admin/shell-summary',
    fixture: shellSummaryFixture,
    schema: shellSummarySchema,
  })
}

// Push device registration for the signed-in admin. Same endpoint the buyer
// app and seller panel use; the server files the token under whoever the JWT
// belongs to, never under anything the body says.
export async function registerAdminPushToken(token) {
  const { data } = await api.post('/fcm-token', { token, deviceType: 'web' })
  return data
}

export async function removeAdminPushToken(token) {
  const { data } = await api.delete('/fcm-token', { data: { token } })
  return data
}
