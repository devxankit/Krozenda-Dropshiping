import { z } from 'zod'

// Runtime contract shared by GET /seller/me, POST /seller/register, and
// POST /seller/kyc-documents — mirrors
// backend/src/modules/seller/controllers/index.js's serializeSeller().
export const kycDocumentSchema = z.object({
  url: z.string(),
  documentType: z.string(),
  uploadedAt: z.string(),
})

export const sellerProfileSchema = z.object({
  id: z.string(),
  storeName: z.string(),
  businessModel: z.string(),
  status: z.string(),
  kycDocuments: z.array(kycDocumentSchema),
})
