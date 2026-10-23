import rateLimit from 'express-rate-limit'
import { env } from '../config/env.js'
import { ApiError } from '../utils/ApiError.js'

/**
 * Rate limiting.
 *
 * The limits are configurable through the environment so they can be tuned
 * without touching the code.
 */

/**
 * Build a rate limiter.
 *
 * @param {{windowMs?: number, limit?: number, message?: string}} [options]
 */
export function createRateLimiter({
  windowMs = env.RATE_LIMIT_WINDOW_MS,
  limit = env.RATE_LIMIT_MAX,
  message = 'Too many requests. Please wait a moment and try again.',
} = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res, next) => {
      next(new ApiError(429, 'RATE_LIMIT_EXCEEDED', message))
    },
  })
}

/**
 * Limiter for the payment creation endpoint.
 *
 * Creating a payment writes to the database and calls a provider, so it is
 * the most expensive operation on the API.
 */
export const paymentCreateLimiter = createRateLimiter({
  message: 'Too many payment requests. Please wait a minute and try again.',
})

/**
 * Limiter for the demo order endpoint, which creates a new document every
 * time it is called.
 */
export const demoOrderLimiter = createRateLimiter({
  limit: Math.max(env.RATE_LIMIT_MAX, 60),
  message: 'Too many demo orders were requested. Please slow down.',
})

export default { createRateLimiter, paymentCreateLimiter, demoOrderLimiter }
