// Single place every thrown/rejected error ends up. Normalises both known
// ApiErrors and unexpected exceptions into one response shape — this is the
// server-side half of the contract frontend/src/lib/axios.js's
// normaliseError() already expects: { code, message, details }.
import { ApiError } from '../lib/ApiError.js'
import { logger } from '../lib/logger.js'
import { env } from '../config/env.js'

// Express recognises error middleware by arity (4 params) — `_next` must
// stay in the signature even though it's unused.
export function errorHandler(error, req, res, _next) {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      success: false,
      code: error.code,
      message: error.message,
      details: error.details,
    })
  }

  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, error)

  return res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: env.isDev ? error.message : 'Something went wrong. Please try again.',
    details: null,
  })
}
