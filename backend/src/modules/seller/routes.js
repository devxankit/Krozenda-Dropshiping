import { Router } from 'express'

// Seller shares ~70% of its surface with dropshipping-partner (project
// context §14.4 item 2 on the frontend side) — that shared surface is
// GET /api/v1/vendor/dashboard-summary (modules/vendor-shared), not
// duplicated here. Add seller-only routes (e.g. seller-specific settings)
// to this router as they're built.
const router = Router()

export default router
