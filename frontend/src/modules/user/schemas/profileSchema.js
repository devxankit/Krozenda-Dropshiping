import { z } from 'zod'

// Mirrors backend/Controllers/userAuthController.js's serializeCustomer().
export const profileSchema = z.object({
  id: z.string(),
  name: z.string(),
  mobileNumber: z.string(),
  email: z.string(),
  gender: z.string().nullable(),
  dob: z.string().nullable(),
  role: z.string(),
  image: z.string().nullable(),
  walletBalance: z.number(),
  createdAt: z.string(),
})
