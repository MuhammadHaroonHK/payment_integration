import { Router } from 'express'
import { validateRequest } from '../middleware/validateRequest.js'
import { paymentCreateLimiter } from '../middleware/rateLimit.js'
import {
  createPaymentSchema,
  mockOutcomeSchema,
  transactionIdentifierSchema,
} from '../validators/paymentValidator.js'
import {
  postCreatePayment,
  getTransactionStatus,
  postMockOutcome,
} from '../controllers/paymentController.js'
import { env } from '../config/env.js'

/**
 * Payment routes
 *
 * Mounted at /api/payments
 */
const router = Router()

/**
 * POST /api/payments/create
 */
router.post(
  '/create',
  paymentCreateLimiter,
  validateRequest(createPaymentSchema, 'body'),
  postCreatePayment,
)

/**
 * GET /api/payments/:transactionId/status
 */
router.get(
  '/:transactionId/status',
  validateRequest(transactionIdentifierSchema, 'params'),
  getTransactionStatus,
)

/**
 * POST /api/payments/mock/:transactionId/outcome
 *
 * Development-only mock control. The route is not registered at all unless
 * NODE_ENV=development, PAYMENT_MODE=mock and ENABLE_TEST_CONTROLS=true,
 * so it cannot be reached by accident in production.
 */
if (env.testControlsEnabled) {
  router.post(
    '/mock/:transactionId/outcome',
    validateRequest(transactionIdentifierSchema, 'params'),
    validateRequest(mockOutcomeSchema, 'body'),
    postMockOutcome,
  )
}

export default router
