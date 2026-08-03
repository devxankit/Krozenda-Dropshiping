// Global auth/session state (zustand). This is the single source of truth
// ProtectedRoute and RoleGuard read from — RBAC is data-driven (project
// context §2), so `permissions` is a plain string array from the API, never
// a hardcoded role switch. Actual login/OTP/refresh flows are business logic
// and belong in modules/auth; this store just holds the resulting session.

import { create } from 'zustand'
import { storage } from './storage'

export const useAuthStore = create((set) => ({
  user: null,
  roles: [],
  capabilities: [],
  permissions: [],
  isAuthenticated: Boolean(storage.getAccessToken()),

  setSession: ({ user, roles = [], capabilities = [], permissions = [], accessToken, refreshToken }) => {
    if (accessToken) storage.setAccessToken(accessToken)
    if (refreshToken) storage.setRefreshToken(refreshToken)
    set({ user, roles, capabilities, permissions, isAuthenticated: true })
  },

  clearSession: () => {
    storage.clearTokens()
    set({ user: null, roles: [], capabilities: [], permissions: [], isAuthenticated: false })
  },
}))

export const hasPermission = (permissionKey) => useAuthStore.getState().permissions.includes(permissionKey)

export const hasRole = (roleId) => useAuthStore.getState().roles.includes(roleId)
