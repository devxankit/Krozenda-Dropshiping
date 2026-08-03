import { Router } from 'express'
import { authenticate } from '../../middlewares/authenticate.js'
import { requirePermission } from '../../middlewares/requirePermission.js'
import { getDashboardSummary } from './controllers/dashboardController.js'
import { USER_PERMISSIONS } from './constants.js'

// Mounted at /api/v1/users in routes/index.js.
const router = Router()

router.get(
  '/me/dashboard-summary',
  authenticate,
  requirePermission(USER_PERMISSIONS.ACCESS),
  getDashboardSummary,
)

export default router
