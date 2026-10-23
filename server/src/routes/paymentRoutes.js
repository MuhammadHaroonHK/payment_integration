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
  handleJazzCashReturn,
  postJazzCashIpn,
  handleEasypaisaReturn,
  handleEasypaisaCallback,
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

/* ------------------------------ JazzCash ------------------------------- */

/**
 * JazzCash posts the signed result here. It is registered before the generic
 * `/:transactionId/status` route and is never rate limited: the gateway has to
 * be able to deliver the callback.
 */
router.get('/jazzcash/return', handleJazzCashReturn)
router.post('/jazzcash/return', handleJazzCashReturn)

/** Optional server-to-server notification. */
router.post('/jazzcash/ipn', postJazzCashIpn)

/* ------------------------------ Easypaisa ------------------------------ */

/**
 * Easypaisa's two redirects:
 *   /return    -> auth_token (then the confirmation page)
 *   /callback  -> final status
 */
router.get('/easypaisa/return', handleEasypaisaReturn)
router.post('/easypaisa/return', handleEasypaisaReturn)
router.get('/easypaisa/callback', handleEasypaisaCallback)
router.post('/easypaisa/callback', handleEasypaisaCallback)

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
