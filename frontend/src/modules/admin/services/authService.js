// Layer rule: services/ is the ONLY place that imports the axios instance.

import { mutateResource } from './mockTransport'
import { ADMIN_PERMISSIONS, ADMIN_ROLE_PRESETS } from '../constants'
import { adminSessionSchema } from '../schemas/authSchema'

// Admin login is real (Models/Admin + protectAdmin on the backend), so it
// always hits the API even while other admin screens are still mocked.
// It resolves straight to a session.
export async function requestAdminLogin(body) {
  const { token, admin } = await mutateResource({
    path: '/admin/auth/login',
    body,
    live: true,
  })

  const isAdmin = admin.role === 'admin'

  return adminSessionSchema.parse({
    user: {
      id: admin.id,
      name: admin.name || 'Admin',
      email: admin.email,
      image: admin.image || null,
      mobileNumber: admin.mobileNumber || null,
      roleLabel: isAdmin ? 'Super Admin' : 'Staff',
      language: admin.language ?? null,
    },
    roles: [admin.role],
    // Admin bypasses every permission check backend-side regardless of
    // permissions[], so it gets the full set here too — staff get exactly
    // what was assigned to them plus panel access.
    permissions: isAdmin
      ? [...ADMIN_ROLE_PRESETS.super_admin]
      : [...new Set([...(admin.permissions || []), ADMIN_PERMISSIONS.ACCESS])],
    accessToken: token,
  })
}

export function requestPasswordReset(body) {
  return mutateResource({
    path: '/admin/auth/forgot-password',
    body,
    live: true,
    fixture: () => ({ sent: true }),
  })
}

export function submitPasswordReset(body) {
  return mutateResource({
    path: '/admin/auth/reset-password',
    body,
    live: true,
    fixture: () => ({ reset: true }),
  })
}
