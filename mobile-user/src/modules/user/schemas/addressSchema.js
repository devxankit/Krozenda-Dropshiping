import { z } from 'zod'

// Mirrors backend/Controllers/addressController.js's serializeAddress().
export const addressSchema = z.object({
  id: z.string(),
  type: z.enum(['home', 'office', 'other']),
  fullName: z.string(),
  phone: z.string(),
  line1: z.string(),
  line2: z.string(),
  city: z.string(),
  state: z.string(),
  pincode: z.string(),
  country: z.string(),
  isDefault: z.boolean(),
})

export const addressListSchema = z.array(addressSchema)
