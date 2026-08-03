import { create } from 'zustand'
import { storage } from './storage'

const savedUser = storage.getUserData()
const savedToken = storage.getAccessToken()

export const useAuthStore = create((set) => ({
  user: savedUser || (savedToken ? { name: 'Rahul Sharma', phone: '+91 98765 43210' } : null),
  roles: ['user'],
  capabilities: [],
  permissions: [],
  isAuthenticated: Boolean(savedToken || savedUser),

  setSession: ({ user, roles = ['user'], capabilities = [], permissions = [], accessToken, refreshToken }) => {
    const token = accessToken || 'demo-krozenda-auth-token-12345'
    storage.setAccessToken(token)
    if (user) storage.setUserData(user)
    if (refreshToken) storage.setRefreshToken(refreshToken)
    set({ user: user || { name: 'Rahul Sharma', phone: '+91 98765 43210' }, roles, capabilities, permissions, isAuthenticated: true })
  },

  clearSession: () => {
    storage.clearTokens()
    set({ user: null, roles: [], capabilities: [], permissions: [], isAuthenticated: false })
  },
}))

export const hasPermission = (permissionKey) => useAuthStore.getState().permissions.includes(permissionKey)
export const hasRole = (roleId) => useAuthStore.getState().roles.includes(roleId)
