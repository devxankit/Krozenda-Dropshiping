import { Router } from 'express'

// Dropshipping-partner shares ~70% of its surface with seller (project
// context §14.4 item 2 on the frontend side) — that shared surface is
// GET /api/v1/vendor/dashboard-summary (modules/vendor-shared), not
// duplicated here. Add partner-only routes as they're built.
const router = Router()

export default router
