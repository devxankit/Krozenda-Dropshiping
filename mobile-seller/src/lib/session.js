// Boot sequence: load tokens from SecureStore, then hydrate the auth store before the first screen.
import { bootstrapStorage } from './storage'
import { useAuthStore } from './authStore'

let booted = false

export async function bootstrapSession() {
  if (booted) return
  booted = true
  await bootstrapStorage()
  useAuthStore.getState().hydrateAuth()
}
