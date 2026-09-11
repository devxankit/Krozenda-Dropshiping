// Layer rule: services/ is the ONLY place that imports the axios instance.

import { mutateResource } from './mockTransport'
import { env } from '../../../config/env'
import { ADMIN_PERMISSIONS, ADMIN_ROLE_PRESETS } from '../constants'
import { adminSessionSchema } from '../schemas/authSchema'

// While mocks are on, any well-formed credentials pass the password step so
// the panel is walkable, and the code `000000` is reserved to exercise the
// rejection state. Both behaviours vanish the moment VITE_USE_MOCKS=false.
const RESERVED_FAILING_CODE = '000000'

// Admin login is real (Models/Admin + protectAdmin on the backend), so it
// always hits the API even while other admin screens are still mocked.
// Real OTP delivery isn't wired up yet, so this resolves straight to a
// session instead of the mocked 2FA challenge below.
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
      roleLabel: isAdmin ? 'Super Admin' : 'Staff',
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

export async function verifyAdminTwoFactor(body) {
  if (env.useMocks && body.code === RESERVED_FAILING_CODE) {
    throw {
      status: 401,
      code: 'INVALID_CODE',
      message: 'That code is not valid. You have 2 attempts left before this account is locked.',
      details: null,
    }
  }

  return mutateResource({
    path: '/admin/auth/verify-2fa',
    body,
    schema: adminSessionSchema,
    fixture: () => ({
      user: {
        id: 'usr_admin_1',
        name: 'Priya Sharma',
        email: 'priya.sharma@krozenda.in',
        roleLabel: 'Super Admin',
      },
      roles: ['super_admin'],
      permissions: [...ADMIN_ROLE_PRESETS.super_admin],
      accessToken: `demo-krozenda-admin-token-${Date.now()}`,
    }),
  })
}

export function requestPasswordReset(body) {
  return mutateResource({
    path: '/admin/auth/forgot-password',
    body,
    fixture: () => ({ sent: true }),
  })
}

export function submitPasswordReset(body) {
  return mutateResource({
    path: '/admin/auth/reset-password',
    body,
    fixture: () => ({ reset: true }),
  })
}
