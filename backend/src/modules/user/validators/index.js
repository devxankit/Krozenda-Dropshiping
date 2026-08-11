// GET /me/dashboard-summary takes no body/query to validate.
import { z } from 'zod'

// Body arrives as multipart/form-data (see routes.js — multer runs before
// this validator), so every field is a string on the wire; coerce the
// numeric one rather than requiring the client to send JSON types.
export const createReviewSchema = z.object({
  productId: z.string().trim().min(1),
  productName: z.string().trim().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  reviewText: z.string().trim().max(500).optional().default(''),
})

export const listReviewsQuerySchema = z.object({
  productId: z.string().trim().min(1),
})
