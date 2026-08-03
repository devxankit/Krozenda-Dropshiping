import { Router } from 'express'
import { authenticate } from '../../middlewares/authenticate.js'
import { validate } from '../../middlewares/validate.js'
import { getSession, postRefreshToken } from './controllers/authController.js'
import { refreshTokenSchema } from './validators/refreshTokenSchema.js'

const router = Router()

router.get('/session', authenticate, getSession)
router.post('/refresh-token', validate({ body: refreshTokenSchema }), postRefreshToken)

export default router
