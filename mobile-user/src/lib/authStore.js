import { create } from 'zustand'
import { storage } from './storage'

// Initial state is empty: tokens live in SecureStore, which is async, so `hydrateAuth()` (called
// from app/_layout.js after bootstrapStorage) loads the saved session before the first screen.
export const useAuthStore = create((set) => ({
  user: null,
  roles: [],
  capabilities: [],
  permissions: [],
  isAuthenticated: false,

  hydrateAuth: () => {
    const grants = storage.getGrants()
    set({
      user: storage.getUserData() || null,
      roles: grants?.roles ?? [],
      capabilities: grants?.capabilities ?? [],
      permissions: grants?.permissions ?? [],
      isAuthenticated: Boolean(storage.getAccessToken()),
    })
  },

  setSession: ({ user, roles = ['user'], capabilities = [], permissions = [], accessToken, refreshToken }) => {
    if (!accessToken) throw new Error('setSession requires a real accessToken from the backend')
    storage.setAccessToken(accessToken)
    if (user) storage.setUserData(user)
    if (refreshToken) storage.setRefreshToken(refreshToken)
    storage.setGrants({ roles, capabilities, permissions })
    set({ user: user || null, roles, capabilities, permissions, isAuthenticated: true })
  },

  setUser: (user) => {
    if (!user) return
    storage.setUserData(user)
    set({ user })
  },

  clearSession: () => {
    // State first, storage second — the cart/wishlist stores react to the transition and persist
    // their emptied copies; wiping storage afterwards leaves nothing behind.
    set({ user: null, roles: [], capabilities: [], permissions: [], isAuthenticated: false })
    storage.clearAll()
  },
}))

export const hasPermission = (permissionKey) => useAuthStore.getState().permissions.includes(permissionKey)
export const hasRole = (roleId) => useAuthStore.getState().roles.includes(roleId)
