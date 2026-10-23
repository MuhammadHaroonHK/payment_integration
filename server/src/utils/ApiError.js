/**
 * ApiError
 *
 * An error that carries an HTTP status code and a machine readable error
 * code. The central error handler turns these into the standard response
 * shape:
 *
 *   { "success": false, "error": { "code": "...", "message": "..." } }
 */
export class ApiError extends Error {
  /**
   * @param {number} statusCode HTTP status code
   * @param {string} code machine readable error code
   * @param {string} message safe, user facing message
   * @param {any} [details] optional extra details (e.g. field errors)
   */
  constructor(statusCode, code, message, details = undefined) {
    super(message)

    this.name = 'ApiError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
    this.isOperational = true

    Error.captureStackTrace?.(this, ApiError)
  }

  /* --------------------------- convenience factories --------------------------- */

  static badRequest(code, message, details) {
    return new ApiError(400, code, message, details)
  }

  static notFound(code, message, details) {
    return new ApiError(404, code, message, details)
  }

  static conflict(code, message, details) {
    return new ApiError(409, code, message, details)
  }

  static tooManyRequests(code, message, details) {
    return new ApiError(429, code, message, details)
  }

  static notImplemented(code, message, details) {
    return new ApiError(501, code, message, details)
  }

  static internal(message = 'An unexpected error occurred.', details) {
    return new ApiError(500, 'INTERNAL_SERVER_ERROR', message, details)
  }
}

export default ApiError
