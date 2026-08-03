import { Router } from 'express'
import authRoutes from '../modules/auth/routes.js'
import userRoutes from '../modules/user/routes.js'
import sellerRoutes from '../modules/seller/routes.js'
import dropshippingPartnerRoutes from '../modules/dropshipping-partner/routes.js'
import adminRoutes from '../modules/admin/routes.js'
import vendorSharedRoutes from '../modules/vendor-shared/routes.js'

// One mount point per module — mirrors frontend's one-lazy-chunk-per-module
// router. vendor-shared is mounted at its own top-level prefix (/vendor)
// rather than nested under /seller and /partner: the frontend calls a flat
// `/vendor/dashboard-summary` path from both surfaces, so there is nothing
// to nest here (see modules/vendor-shared/routes.js for the reasoning).
const router = Router()

router.use('/auth', authRoutes)
router.use('/users', userRoutes)
router.use('/seller', sellerRoutes)
router.use('/partner', dropshippingPartnerRoutes)
router.use('/admin', adminRoutes)
router.use('/vendor', vendorSharedRoutes)

export default router
