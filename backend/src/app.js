import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import { env } from './config/env.js'
import { apiRateLimiter } from './middlewares/rateLimiter.js'
import { notFound } from './middlewares/notFound.js'
import { errorHandler } from './middlewares/errorHandler.js'
import { UPLOADS_ROOT } from './middlewares/upload.js'
import { ApiResponse } from './lib/ApiResponse.js'
import routes from './routes/index.js'

export const app = express()

// helmet's default cross-origin-resource-policy is same-origin, which would
// block the frontend (different origin in dev) from loading images served
// below — relax it only for this static mount, not the whole app.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({ origin: env.clientUrl, credentials: true }))
app.use(compression())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(apiRateLimiter)

// Serves everything saved by middlewares/upload.js at a stable, public URL
// (see publicUrlFor()) — this is the shared location every client reads
// from, regardless of which user's browser originally uploaded the file.
app.use('/uploads', express.static(UPLOADS_ROOT))

if (env.isDev) {
  app.use(morgan('dev'))
}

app.get('/health', (_req, res) => {
  new ApiResponse(200, { uptimeSeconds: process.uptime() }, 'ok').send(res)
})

app.use('/api/v1', routes)

app.use(notFound)
app.use(errorHandler)
