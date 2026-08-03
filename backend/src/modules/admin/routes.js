import { Router } from 'express'
import { authenticate } from '../../middlewares/authenticate.js'
import { requirePermission } from '../../middlewares/requirePermission.js'
import { getDashboardSummary } from './controllers/dashboardController.js'
import { ADMIN_PERMISSIONS } from './constants.js'

// Mounted at /api/v1/admin in routes/index.js.
const router = Router()

router.get(
  '/dashboard-summary',
  authenticate,
  requirePermission(ADMIN_PERMISSIONS.ACCESS),
  getDashboardSummary,
)

export default router
