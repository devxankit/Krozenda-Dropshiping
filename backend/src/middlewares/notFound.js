import { ApiError } from '../lib/ApiError.js'

// Mounted last, after every route — anything unmatched falls through to
// here rather than Express's default HTML 404 page.
export function notFound(req, _res, next) {
  next(ApiError.notFound(`No route for ${req.method} ${req.originalUrl}`))
}
