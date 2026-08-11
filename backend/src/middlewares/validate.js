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
      // Express 5 exposes req.query as a getter-only accessor (lazily
      // parsed from the URL) — a plain `req.query = ...` throws
      // "Cannot set property query of #<IncomingMessage> which has only a
      // getter". Redefine the property instead of assigning to it.
      if (query) {
        Object.defineProperty(req, 'query', {
          value: query.parse(req.query),
          writable: true,
          configurable: true,
          enumerable: true,
        })
      }
      next()
    } catch (error) {
      next(ApiError.unprocessable('Request validation failed.', error.issues ?? error.message))
    }
  }
}
