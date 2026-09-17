// Thin wrapper around localStorage so token persistence has one call site.
// Swapping storage mechanism (e.g. httpOnly cookie handoff) later means
// editing this file only.

const KEYS = Object.freeze({
  ACCESS_TOKEN: 'krozenda.accessToken',
  REFRESH_TOKEN: 'krozenda.refreshToken',
  USER_DATA: 'krozenda.userData',
  // Roles and permissions have to survive a reload alongside the token.
  // Without this a refresh inside a permission-gated panel drops the caller
  // back to sign-in even though their session is still valid.
  GRANTS: 'krozenda.grants',
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
    localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : value)
  } catch {
    // Storage unavailable
  }
}

// Sign-out wipes the whole origin, not just the four auth keys above.
// Everything this app persists — the guest cart and wishlist copies, the
// local ticket-id list, the admin sidebar preference — belongs to whoever was
// signed in, and the next person on the device must not inherit it. Removing
// a hand-listed set of keys leaked every key added after this file was
// written, which is exactly what happened.
function clearAll() {
  try {
    localStorage.clear()
  } catch {
    // Storage unavailable — nothing was persisted to begin with.
  }
}

export const storage = Object.freeze({
  getAccessToken: () => get(KEYS.ACCESS_TOKEN),
  setAccessToken: (token) => set(KEYS.ACCESS_TOKEN, token),
  getRefreshToken: () => get(KEYS.REFRESH_TOKEN),
  setRefreshToken: (token) => set(KEYS.REFRESH_TOKEN, token),
  getUserData: () => {
    const raw = get(KEYS.USER_DATA)
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  },
  setUserData: (user) => set(KEYS.USER_DATA, user),
  getGrants: () => {
    const raw = get(KEYS.GRANTS)
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  },
  setGrants: (grants) => set(KEYS.GRANTS, grants),
  clearAll,
})
