// Express 5 forwards rejected promises to error-handling middleware on its
// own, but wrapping route handlers explicitly keeps every controller's
// intent obvious and is a no-op safety net if that ever changes.
export function asyncHandler(handler) {
  return function wrapped(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next)
  }
}
