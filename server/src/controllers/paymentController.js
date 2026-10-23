import { asyncHandler } from '../utils/asyncHandler.js'
import { createPayment, getPaymentStatus, finaliseMockTransaction } from '../services/paymentService.js'
import { env } from '../config/env.js'

/**
 * Payment controller
 *
 * Thin HTTP layer: it reads the validated input, calls the service and
 * shapes the response. It contains no business rules.
 */

/**
 * POST /api/payments/create
 */
export const postCreatePayment = asyncHandler(async (req, res) => {
  const body = req.validated?.body || {}

  const orderNumber = body.orderNumber || body.order?.orderNumber
  const customer = body.customer || {}

  const transaction = await createPayment({
    orderNumber,
    gateway: body.gateway,
    customer: {
      name: customer.fullName ?? customer.name,
      email: customer.email,
      mobile: customer.phone ?? customer.mobile,
    },
    quantity: body.quantity,
    simulatedOutcome: body.simulatedOutcome,
    requestId: req.id,
  })

  res.status(201).json({
    success: true,
    mode: env.PAYMENT_MODE.toUpperCase(),
    message:
      transaction.status === 'SUCCESS'
        ? 'Simulated payment completed'
        : transaction.status === 'PENDING'
          ? 'Simulated payment is still pending'
          : 'Simulated payment was not completed',
    data: transaction,
  })
})

/**
 * GET /api/payments/:transactionId/status
 */
export const getTransactionStatus = asyncHandler(async (req, res) => {
  const { transactionId } = req.validated?.params || {}

  const transaction = await getPaymentStatus(transactionId)

  res.status(200).json({
    success: true,
    mode: env.PAYMENT_MODE.toUpperCase(),
    data: transaction,
  })
})

/**
 * POST /api/payments/mock/:transactionId/outcome
 *
 * Development-only. It forces the outcome of a pending simulated
 * transaction. The route is only mounted when the test controls are enabled
 * on the server.
 */
export const postMockOutcome = asyncHandler(async (req, res) => {
  const { transactionId } = req.validated?.params || {}
  const { outcome } = req.validated?.body || {}

  const transaction = await finaliseMockTransaction(transactionId, outcome)

  res.status(200).json({
    success: true,
    mode: env.PAYMENT_MODE.toUpperCase(),
    message: 'Simulated transaction outcome updated.',
    data: transaction,
  })
})

export default { postCreatePayment, getTransactionStatus, postMockOutcome }
