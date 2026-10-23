import { ApiError } from '../utils/ApiError.js'

/**
 * validateRequest
 *
 * Runs a Zod schema against part of the request and replaces the value with
 * the parsed result.
 *
 * The parsed output is stored on `req.validated` instead of overwriting
 * `req.body` / `req.query` / `req.params`, because in Express 5 `req.query`
 * is a read-only getter.
 *
 * Usage:
 *   router.post('/create', validateRequest(createPaymentSchema, 'body'), handler)
 */
export function validateRequest(schema, source = 'body') {
  return function validate(req, res, next) {
    const result = schema.safeParse(req[source] ?? {})

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || '(root)',
        message: issue.message,
      }))

      next(
        new ApiError(400, 'VALIDATION_ERROR', 'The request payload is invalid.', details),
      )
      return
    }

    req.validated = req.validated || {}
    req.validated[source] = result.data

    next()
  }
}

export default validateRequest
