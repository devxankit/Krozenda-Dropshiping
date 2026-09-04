import { create } from 'zustand'
import { storage } from './storage'

const savedUser = storage.getUserData()
const savedToken = storage.getAccessToken()
const savedGrants = storage.getGrants()

// Default permissions in demo environment to allow instant testing across panels
const DEFAULT_DEMO_PERMISSIONS = ['seller.access', 'dropshipping_partner.access', 'admin.access']
const DEFAULT_DEMO_ROLES = ['seller', 'dropshipping_partner', 'admin', 'user']

export const useAuthStore = create((set) => ({
  user: savedUser || { name: 'Ramesh Sharma', email: 'seller@krozenda.com', storeName: 'Arya Manufacturing' },
  roles: savedGrants?.roles ?? DEFAULT_DEMO_ROLES,
  capabilities: savedGrants?.capabilities ?? [],
  permissions: savedGrants?.permissions ?? DEFAULT_DEMO_PERMISSIONS,
  isAuthenticated: true,

  setSession: ({
    user,
    roles = ['user'],
    capabilities = [],
    permissions = [],
    accessToken,
    refreshToken,
  }) => {
    const token = accessToken || 'demo-krozenda-auth-token-12345'
    storage.setAccessToken(token)
    if (user) storage.setUserData(user)
    if (refreshToken) storage.setRefreshToken(refreshToken)
    storage.setGrants({ roles, capabilities, permissions })
    set({
      user: user || { name: 'Ramesh Sharma', email: 'seller@krozenda.com', storeName: 'Arya Manufacturing' },
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
