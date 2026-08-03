// Stateless JWT helpers. Access tokens carry roles/capabilities/permissions
// as claims so middlewares/requirePermission.js never has to hit the DB per
// request — this is what makes RBAC "data" rather than a hardcoded check:
// the data was resolved once at login and travels with the token.
//
// This is infrastructure, not a login flow — modules/auth/services owns
// issuing tokens on login/refresh; this file only signs/verifies them.

import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { ApiError } from './ApiError.js'

export function signAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      roles: user.roles ?? [],
      capabilities: user.capabilities ?? [],
      permissions: user.permissions ?? [],
    },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpiresIn },
  )
}

export function signRefreshToken(user) {
  return jwt.sign({ sub: String(user.id) }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn,
  })
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.jwt.accessSecret)
  } catch {
    throw ApiError.unauthorized('Invalid or expired access token.')
  }
}

export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, env.jwt.refreshSecret)
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token.')
  }
}
