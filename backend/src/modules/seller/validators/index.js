// Seller-specific zod request validators go here as endpoints are built.
import { z } from 'zod'
import { BUSINESS_MODEL } from '../../../config/constants.js'

export const registerSellerSchema = z.object({
  storeName: z.string().trim().min(1),
  businessModel: z.enum([BUSINESS_MODEL.MARKETPLACE, BUSINESS_MODEL.DROPSHIPPING]),
})

// multipart/form-data body (see routes.js) — documentType is optional free
// text describing the file (e.g. "PAN", "GST Certificate").
export const uploadKycDocumentsSchema = z.object({
  documentType: z.string().trim().min(1).optional().default('other'),
})
