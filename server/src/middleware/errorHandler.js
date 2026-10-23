import mongoose from 'mongoose'
import { env } from '../config/env.js'
import { ApiError } from '../utils/ApiError.js'
import { logger } from '../utils/logger.js'

/**
 * errorHandler
 *
 * The single place where an error becomes an HTTP response.
 *
 * Rules:
 *   - the response always uses the standard error shape
 *   - stack traces are only included outside production
 *   - internal details never leak into a production response
 */
export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error)
    return
  }

  let apiError = error

  /* --------------------------- mongoose / mongo errors --------------------------- */

  if (error instanceof mongoose.Error.ValidationError) {
    const details = Object.values(error.errors).map((item) => ({
      field: item.path,
      message: item.message,
    }))

    apiError = new ApiError(400, 'VALIDATION_ERROR', 'The record could not be saved.', details)
  } else if (error instanceof mongoose.Error.CastError) {
    apiError = new ApiError(400, 'VALIDATION_ERROR', `"${error.value}" is not a valid ${error.path}.`)
  } else if (error?.code === 11000) {
    // Duplicate key — the unique index did its job.
    const field = Object.keys(error.keyPattern || {}).join(', ') || 'field'

    apiError = new ApiError(
      409,
      field === 'orderId' ? 'DUPLICATE_PAYMENT' : 'VALIDATION_ERROR',
      field === 'orderId'
        ? 'This order already has a successful payment.'
        : `A record with the same ${field} already exists.`,
    )
  } else if (error?.name === 'MongoNetworkError' || error?.name === 'MongoServerSelectionError') {
    apiError = new ApiError(503, 'DATABASE_ERROR', 'The database is currently unavailable.')
  }

  /* ------------------------------ generic fallback ------------------------------ */

  if (!(apiError instanceof ApiError)) {
    apiError = new ApiError(
      500,
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred while processing the request.',
    )
  }

  const status = apiError.statusCode || 500

  if (status >= 500) {
    logger.error(
      { requestId: req.id, code: apiError.code, err: error?.message, stack: error?.stack },
      'request failed',
    )
  } else {
    logger.warn(
      { requestId: req.id, code: apiError.code, status, message: apiError.message },
      'request rejected',
    )
  }

  const body = {
    success: false,
    error: {
      code: apiError.code,
      message: apiError.message,
    },
  }

  if (apiError.details) body.error.details = apiError.details

  if (!env.isProduction && error?.stack) {
    body.error.stack = error.stack.split('\n')
  }

  res.status(status).json(body)
}

export default errorHandler
