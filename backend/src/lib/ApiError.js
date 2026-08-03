// Thrown from services/controllers, caught by middlewares/errorHandler.js.
// Mirrors the normalised error shape the frontend's axios interceptor
// expects: { status, code, message, details }.
export class ApiError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }

  static badRequest(message, details) {
    return new ApiError(400, 'BAD_REQUEST', message, details)
  }

  static unauthorized(message = 'Authentication required.') {
    return new ApiError(401, 'UNAUTHORIZED', message)
  }

  static forbidden(message = 'You do not have permission to perform this action.') {
    return new ApiError(403, 'FORBIDDEN', message)
  }

  static notFound(message = 'Resource not found.') {
    return new ApiError(404, 'NOT_FOUND', message)
  }

  static unprocessable(message, details) {
    return new ApiError(422, 'UNPROCESSABLE_ENTITY', message, details)
  }

  static internal(message = 'Something went wrong. Please try again.') {
    return new ApiError(500, 'INTERNAL_ERROR', message)
  }
}
