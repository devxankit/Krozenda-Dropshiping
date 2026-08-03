import { ApiError } from '../lib/ApiError.js'

// Runtime contract for incoming requests — the mirror of frontend's zod
// schemas/ folder, which validates outgoing API *responses*. Pass zod
// schemas for whichever parts of the request a route accepts:
//   validate({ body: createSellerSchema })
export function validate({ body, params, query } = {}) {
  return function validateMiddleware(req, _res, next) {
    try {
      if (body) req.body = body.parse(req.body)
      if (params) req.params = params.parse(req.params)
      if (query) req.query = query.parse(req.query)
      next()
    } catch (error) {
      next(ApiError.unprocessable('Request validation failed.', error.issues ?? error.message))
    }
  }
}
