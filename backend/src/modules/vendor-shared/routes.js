import { Router } from 'express'
import { authenticate } from '../../middlewares/authenticate.js'
import { requirePermission } from '../../middlewares/requirePermission.js'
import { getDashboardSummary } from './controllers/dashboardController.js'
import { SELLER_PERMISSIONS } from '../seller/constants.js'
import { DROPSHIPPING_PARTNER_PERMISSIONS } from '../dropshipping-partner/constants.js'

// Mounted at /api/v1/vendor in routes/index.js. Both the seller and
// dropshipping-partner frontend surfaces call this exact path (see
// frontend/src/modules/vendor-shared/services/dashboardService.js), so
// there is one router here rather than one nested under /seller and a
// duplicate nested under /partner — the frontend does the nesting, the
// backend just needs to accept either role's permission.
const router = Router()

router.get(
  '/dashboard-summary',
  authenticate,
  requirePermission([SELLER_PERMISSIONS.ACCESS, DROPSHIPPING_PARTNER_PERMISSIONS.ACCESS], { mode: 'any' }),
  getDashboardSummary,
)

export default router
