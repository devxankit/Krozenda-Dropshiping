// Drops this device's push token from the signed-in account. Called BEFORE the
// session is cleared (the request needs the JWT), so a logged-out device stops
// receiving that buyer's or seller's notifications — on a shared phone or
// computer they used to keep arriving. Capped, so a slow or failing request
// never holds the sign-out. The admin panel has its own copy in
// useAdminAlertsController.

import { api } from './axios'
import { currentPushToken } from './firebase'

export async function unregisterPushToken() {
  const attempt = currentPushToken().then((token) =>
    token ? api.delete('/fcm-token', { data: { token } }) : null
  )
  await Promise.race([attempt.catch(() => {}), new Promise((resolve) => setTimeout(resolve, 1500))])
}
