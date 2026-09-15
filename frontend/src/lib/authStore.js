import { create } from 'zustand'
import { storage } from './storage'

const savedUser = storage.getUserData()
const savedToken = storage.getAccessToken()
const savedGrants = storage.getGrants()

export const useAuthStore = create((set) => ({
  user: savedUser || null,
  // An orphaned token with no saved grants (e.g. a stale/corrupted session)
  // must never fall back to elevated roles/permissions — that previously
  // rendered admin/seller UI for a plain customer session missing its grants.
  roles: savedGrants?.roles ?? [],
  capabilities: savedGrants?.capabilities ?? [],
  permissions: savedGrants?.permissions ?? [],
  isAuthenticated: Boolean(savedToken),

  setSession: ({
    user,
    roles = ['user'],
    capabilities = [],
    permissions = [],
    accessToken,
    refreshToken,
  }) => {
    if (!accessToken) {
      throw new Error('setSession requires a real accessToken from the backend');
    }
    storage.setAccessToken(accessToken)
    if (user) storage.setUserData(user)
    if (refreshToken) storage.setRefreshToken(refreshToken)
    storage.setGrants({ roles, capabilities, permissions })
    set({
      user: user || null,
      roles,
      capabilities,
      permissions,
      isAuthenticated: true,
    })
  },

  clearSession: () => {
    storage.clearTokens()
    set({ user: null, roles: [], capabilities: [], permissions: [], isAuthenticated: false })
  },
}))

export const hasPermission = (permissionKey) =>
  useAuthStore.getState().permissions.includes(permissionKey)
export const hasRole = (roleId) => useAuthStore.getState().roles.includes(roleId)
