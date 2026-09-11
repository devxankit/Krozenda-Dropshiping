import { z } from 'zod'

const baseFields = {
  name: z.string().min(1, 'Name is required'),
  email: z.string().min(1, 'Email is required').email('That does not look like an email address'),
  roleId: z.string().min(1, 'Select a role'),
  mobileNumber: z.string().optional(),
  gender: z.union([z.enum(['male', 'female', 'other']), z.literal('')]).optional(),
  dob: z.string().optional(),
}

// Password is required on create, absent from the edit form entirely —
// editing a staff member's password goes through the dedicated
// "Change password" action instead (PATCH /admin/staff/:id/password).
export const staffCreateSchema = z
  .object({
    ...baseFields,
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

export const staffEditSchema = z.object(baseFields)

export const changePasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
