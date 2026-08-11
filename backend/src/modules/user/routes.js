import { Router } from 'express'
import { authenticate } from '../../middlewares/authenticate.js'
import { requirePermission } from '../../middlewares/requirePermission.js'
import { validate } from '../../middlewares/validate.js'
import { createUploader, handleUpload } from '../../middlewares/upload.js'
import { getDashboardSummary } from './controllers/dashboardController.js'
import { createReview, listProductReviews } from './controllers/reviewController.js'
import { createReviewSchema, listReviewsQuerySchema } from './validators/index.js'
import { USER_PERMISSIONS } from './constants.js'

// Mounted at /api/v1/users in routes/index.js.
const router = Router()

const reviewPhotoUploader = createUploader('reviews', { kind: 'image', maxSizeMb: 5 })

router.get(
  '/me/dashboard-summary',
  authenticate,
  requirePermission(USER_PERMISSIONS.ACCESS),
  getDashboardSummary,
)

router.post(
  '/reviews',
  authenticate,
  requirePermission(USER_PERMISSIONS.ACCESS),
  handleUpload(reviewPhotoUploader.array('photos', 4)),
  validate({ body: createReviewSchema }),
  createReview,
)

// Any authenticated buyer can read another buyer's review — see
// reviewService.listReviewsForProduct for why this isn't scoped to req.user.
router.get(
  '/reviews',
  authenticate,
  requirePermission(USER_PERMISSIONS.ACCESS),
  validate({ query: listReviewsQuerySchema }),
  listProductReviews,
)

export default router
