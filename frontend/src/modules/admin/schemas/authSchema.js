import { z } from 'zod'

export const adminLoginSchema = z.object({
  email: z
    .string()
    .min(1, 'Enter your work email')
    .email('That does not look like an email address'),
  password: z.string().min(8, 'Passwords are at least 8 characters'),
})

export const adminTwoFactorSchema = z.object({
  code: z
    .string()
    .length(6, 'The code is 6 digits')
    .regex(/^\d{6}$/, 'The code is 6 digits'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Enter your work email').email('That does not look like an email address'),
})

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(12, 'Admin passwords are at least 12 characters')
      .regex(/[A-Z]/, 'Include at least one capital letter')
      .regex(/[0-9]/, 'Include at least one number'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Both passwords must match',
  })

// Runtime contract for POST /admin/auth/login and /admin/auth/verify-2fa.
export const adminSessionSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    image: z.string().nullable().optional(),
    mobileNumber: z.string().nullable().optional(),
    roleLabel: z.string(),
    // Null means this account has never chosen a UI language — see
    // lib/i18n/languageStore.js, which treats that differently from English.
    language: z.string().nullable().default(null),
  }),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
  accessToken: z.string(),
})

export const twoFactorChallengeSchema = z.object({
  challengeId: z.string(),
  maskedDestination: z.string(),
  expiresInSeconds: z.number(),
})
