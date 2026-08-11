import { Router } from 'express'
import { authenticate } from '../../middlewares/authenticate.js'
import { requirePermission } from '../../middlewares/requirePermission.js'
import { validate } from '../../middlewares/validate.js'
import { createUploader, handleUpload } from '../../middlewares/upload.js'
import { registerSeller, getMySellerProfile, uploadKycDocuments } from './controllers/index.js'
import { registerSellerSchema, uploadKycDocumentsSchema } from './validators/index.js'
import { SELLER_PERMISSIONS } from './constants.js'

// Seller shares ~70% of its surface with dropshipping-partner (project
// context §14.4 item 2 on the frontend side) — that shared surface is
// GET /api/v1/vendor/dashboard-summary (modules/vendor-shared), not
// duplicated here. Add seller-only routes (e.g. seller-specific settings)
// to this router as they're built.
const router = Router()

const kycDocumentUploader = createUploader('kyc', { kind: 'document', maxSizeMb: 8 })

router.post(
  '/register',
  authenticate,
  requirePermission(SELLER_PERMISSIONS.ACCESS),
  validate({ body: registerSellerSchema }),
  registerSeller,
)

router.get('/me', authenticate, requirePermission(SELLER_PERMISSIONS.ACCESS), getMySellerProfile)

router.post(
  '/kyc-documents',
  authenticate,
  requirePermission(SELLER_PERMISSIONS.ACCESS),
  handleUpload(kycDocumentUploader.array('documents', 5)),
  validate({ body: uploadKycDocumentsSchema }),
  uploadKycDocuments,
)

export default router
