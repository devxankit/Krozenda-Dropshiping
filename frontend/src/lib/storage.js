// Thin wrapper around localStorage so token persistence has one call site.
// Swapping storage mechanism (e.g. httpOnly cookie handoff) later means
// editing this file only.

const KEYS = Object.freeze({
  ACCESS_TOKEN: 'krozenda.accessToken',
  REFRESH_TOKEN: 'krozenda.refreshToken',
})

function get(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function set(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage unavailable (private browsing, quota) — fail silently, the
    // caller falls back to in-memory auth state for the session.
  }
}

function remove(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    // no-op
  }
}

export const storage = Object.freeze({
  getAccessToken: () => get(KEYS.ACCESS_TOKEN),
  setAccessToken: (token) => set(KEYS.ACCESS_TOKEN, token),
  getRefreshToken: () => get(KEYS.REFRESH_TOKEN),
  setRefreshToken: (token) => set(KEYS.REFRESH_TOKEN, token),
  clearTokens: () => {
    remove(KEYS.ACCESS_TOKEN)
    remove(KEYS.REFRESH_TOKEN)
  },
})
