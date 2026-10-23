/**
 * asyncHandler
 *
 * Wraps an async route handler so a rejected promise is forwarded to the
 * Express error handler instead of becoming an unhandled rejection.
 *
 * (Express 5 does this automatically, but the helper keeps the intent
 * explicit and keeps the code working on Express 4.)
 */
export function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next)
  }
}

export default asyncHandler
