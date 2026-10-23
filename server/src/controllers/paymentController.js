import { asyncHandler } from '../utils/asyncHandler.js'
import {
  createPayment,
  completeGatewayPayment,
  getPaymentStatus,
  finaliseMockTransaction,
} from '../services/paymentService.js'
import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'
import { autoSubmitForm, escapeHtml } from '../utils/html.js'
import jazzcashGateway, { buildSecureHash } from '../services/gateways/jazzcashGateway.js'
import easypaisaGateway from '../services/gateways/easypaisaGateway.js'

/**
 * Payment controller
 *
 * Thin HTTP layer: it reads the validated input, calls the service and
 * shapes the response. It contains no business rules.
 *
 * The callback handlers are intentionally separate from the JSON API: their
 * "client" is the customer's browser on its way back from the gateway, so
 * they answer with a redirect (or a small HTML page) instead of JSON.
 */

/** Where the browser lands after a gateway redirect. */
function clientResultUrl(transaction) {
  return `${env.CLIENT_URL}/payment/result/${transaction.id}`
}

/** A safe, minimal HTML error page for a broken gateway callback. */
function sendCallbackError(res, error) {
  const status = Number(error?.statusCode) || 400
  const message = error?.message || 'The payment callback could not be processed.'

  res
    .status(status)
    .type('html')
    .send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Payment could not be confirmed</title>
  </head>
  <body style="font-family: system-ui, sans-serif; max-width: 34rem; margin: 4rem auto; padding: 0 1rem; line-height: 1.6;">
    <h1 style="font-size: 1.25rem;">Payment could not be confirmed</h1>
    <p>${escapeHtml(message)}</p>
    <p><a href="${escapeHtml(env.CLIENT_URL)}">Return to the store</a></p>
  </body>
</html>`)
}

/**
 * POST /api/payments/create
 */
export const postCreatePayment = asyncHandler(async (req, res) => {
  const body = req.validated?.body || {}

  const orderNumber = body.orderNumber || body.order?.orderNumber
  const customer = body.customer || {}

  const { transaction, redirect } = await createPayment({
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
    message: redirect
      ? 'Redirecting to the payment gateway'
      : transaction.status === 'SUCCESS'
        ? env.PAYMENT_MODE === 'mock'
          ? 'Simulated payment completed'
          : 'Payment completed'
        : transaction.status === 'PENDING'
          ? 'Payment is still pending'
          : 'Payment was not completed',
    data: transaction,
    /**
     * Only present for a real hosted checkout. The frontend POSTs these
     * fields to `redirect.url`, which takes the customer to the gateway.
     */
    redirect: redirect ?? null,
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

/* -------------------------------------------------------------------------- */
/* JazzCash                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * POST /api/payments/jazzcash/return
 *
 * JazzCash POSTs the signed result to the return URL. A valid signature is
 * required before the transaction can be finalised.
 */
export const handleJazzCashReturn = asyncHandler(async (req, res) => {
  const payload = { ...req.query, ...req.body }

  try {
    const outcome = await jazzcashGateway.verifyCallback(payload)

    const transaction = await completeGatewayPayment({
      gateway: 'JAZZCASH',
      gatewayTxnRef: outcome.gatewayTxnRef,
      outcome,
    })

    res.redirect(303, clientResultUrl(transaction))
  } catch (error) {
    logger.error(
      { code: error?.code, err: error?.message, txnRef: payload.pp_TxnRefNo },
      'jazzcash return rejected',
    )
    sendCallbackError(res, error)
  }
})

/**
 * POST /api/payments/jazzcash/ipn
 *
 * Optional server-to-server notification. It uses the same signature check
 * and answers with a signed acknowledgement, as JazzCash expects.
 */
export const postJazzCashIpn = asyncHandler(async (req, res) => {
  const payload = { ...req.query, ...req.body }

  try {
    const outcome = await jazzcashGateway.verifyCallback(payload)

    const transaction = await completeGatewayPayment({
      gateway: 'JAZZCASH',
      gatewayTxnRef: outcome.gatewayTxnRef,
      outcome,
    })

    const acknowledgement = {
      pp_ResponseCode: '000',
      pp_ResponseMessage: 'IPN received',
    }
    acknowledgement.pp_SecureHash = buildSecureHash(
      acknowledgement,
      env.JAZZCASH_INTEGRITY_SALT,
    )

    res.status(200).json({
      success: true,
      transactionId: transaction.id,
      ...acknowledgement,
    })
  } catch (error) {
    logger.error(
      { code: error?.code, err: error?.message, txnRef: payload.pp_TxnRefNo },
      'jazzcash IPN rejected',
    )

    res.status(Number(error?.statusCode) || 400).json({
      success: false,
      error: {
        code: error?.code || 'INVALID_SIGNATURE',
        message: error?.message || 'The IPN could not be processed.',
      },
    })
  }
})

/* -------------------------------------------------------------------------- */
/* Easypaisa                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * GET|POST /api/payments/easypaisa/return
 *
 * Two things can arrive here:
 *   1. `auth_token` — Easypaisa's first redirect. The customer must be sent on
 *      to the confirmation page with that token.
 *   2. the final `status` / `orderRefNumber` parameters — handled directly.
 */
export const handleEasypaisaReturn = asyncHandler(async (req, res) => {
  const query = { ...req.query, ...req.body }
  const gatewayTxnRef = String(query.tx ?? query.orderRefNum ?? query.orderRefNumber ?? '')
  const authToken = String(query.auth_token ?? '')

  if (authToken) {
    try {
      const redirect = easypaisaGateway.buildConfirmationRedirect(authToken, gatewayTxnRef)

      res.status(200).type('html').send(
        autoSubmitForm({
          action: redirect.url,
          fields: redirect.fields,
          title: 'Continue to Easypaisa',
          message: 'Confirming your payment with Easypaisa…',
          nonce: res.locals.cspNonce,
        }),
      )
      return
    } catch (error) {
      logger.error({ err: error.message }, 'easypaisa confirmation redirect failed')
      sendCallbackError(res, error)
      return
    }
  }

  try {
    const outcome = await easypaisaGateway.verifyCallback({ ...query, tx: gatewayTxnRef })

    const transaction = await completeGatewayPayment({
      gateway: 'EASYPAISA',
      gatewayTxnRef: outcome.gatewayTxnRef,
      outcome,
    })

    res.redirect(303, clientResultUrl(transaction))
  } catch (error) {
    logger.error(
      { code: error?.code, err: error?.message, txnRef: gatewayTxnRef },
      'easypaisa return rejected',
    )
    sendCallbackError(res, error)
  }
})

/**
 * GET|POST /api/payments/easypaisa/callback
 *
 * The final redirect target given to Easypaisa. Its parameters are unsigned,
 * so the adapter uses the inquiry API when credentials are configured.
 */
export const handleEasypaisaCallback = handleEasypaisaReturn

export default {
  postCreatePayment,
  getTransactionStatus,
  postMockOutcome,
  handleJazzCashReturn,
  postJazzCashIpn,
  handleEasypaisaReturn,
  handleEasypaisaCallback,
}
