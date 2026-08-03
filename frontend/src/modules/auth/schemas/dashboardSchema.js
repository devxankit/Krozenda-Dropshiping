import { z } from 'zod'

// Runtime contract for GET /auth/session.
export const authSessionSchema = z.object({
  isAuthenticated: z.boolean(),
  sessionExpiresAt: z.string(),
})
