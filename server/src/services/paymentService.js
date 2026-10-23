import { Order, ORDER_STATUS } from '../models/Order.js'
import {
  Transaction,
  TRANSACTION_STATUS,
  TRANSACTION_MODE,
  GATEWAY,
} from '../models/Transaction.js'
import { DEMO_CATALOGUE } from '../config/demoCatalogue.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/ApiError.js'
import { buildBreakdown } from '../utils/money.js'
import {
  generateTransactionReference,
  generateGatewayTxnRef,
} from '../utils/generateReference.js'
import { logger } from '../utils/logger.js'
import { assertGateway, getGatewayAdapter } from './gateways/gatewayFactory.js'
import { serialiseTransaction, findTransaction } from './transactionService.js'
import { resolveMockOutcome } from './gateways/mockGateway.js'

/**
 * Payment service
 *
 * The heart of the backend. It owns every rule that keeps a payment honest:
 *
 *   1. the gateway name must be a known gateway
 *   2. the order must exist and must be payable
 *   3. the payable amount is calculated from server side data only
 *   4. an order can only be processed by one request at a time
 *   5. an order that already has a successful payment is never paid again
 *   6. the transaction and the order are updated together
 *   7. in live mode a transaction stays PENDING until the gateway callback has
 *      been verified — the browser never decides the outcome
 */

const isLiveMode = env.PAYMENT_MODE === 'live'

/**
 * Make sure the development-only outcome control is allowed right now.
 *
 * @param {string|undefined} requestedOutcome
 */
function assertTestControlAllowed(requestedOutcome) {
  if (requestedOutcome === undefined || requestedOutcome === null) return null

  if (!env.testControlsEnabled) {
    throw new ApiError(
      400,
      'TEST_CONTROLS_DISABLED',
      'Forcing a transaction outcome is only available in development with ' +
        'NODE_ENV=development, PAYMENT_MODE=mock and ENABLE_TEST_CONTROLS=true.',
    )
  }

  return requestedOutcome
}

/** The environment a live transaction runs against. */
function environmentFor(gateway) {
  if (!isLiveMode) return null

  return gateway === GATEWAY.JAZZCASH
    ? env.JAZZCASH_ENVIRONMENT
    : env.EASYPAISA_ENVIRONMENT
}

/**
 * Create (and, in live mode, initiate) a payment.
 *
 * @param {{
 *   orderNumber: string,
 *   gateway: string,
 *   customer?: {name?: string, email?: string, mobile?: string},
 *   quantity?: number,
 *   simulatedOutcome?: string,
 *   requestId?: string
 * }} input
 * @returns {Promise<{transaction: object, redirect: object|null}>}
 */
export async function createPayment({
  orderNumber,
  gateway,
  customer = {},
  quantity,
  simulatedOutcome,
  requestId,
} = {}) {
  // ── 1. Validate the gateway ───────────────────────────────────────────────
  const gatewayName = assertGateway(gateway)

  // ── 2. The outcome may only be forced when the test controls are on ─────
  const requestedOutcome = assertTestControlAllowed(simulatedOutcome)

  // ── 3. Resolve the order (it must exist) ─────────────────────────────────
  const orderNumberValue = String(orderNumber || '').trim()

  if (!orderNumberValue) {
    throw ApiError.badRequest('VALIDATION_ERROR', 'An order number is required.')
  }

  const order = await Order.findOne({ orderNumber: orderNumberValue })

  if (!order) {
    throw ApiError.notFound(
      'ORDER_NOT_FOUND',
      `No order was found with the number "${orderNumberValue}". ` +
        'Call GET /api/orders/demo to create a demo order first.',
    )
  }

  // ── 4. The order must be payable ────────────────────────────────────────
  if (order.status === ORDER_STATUS.PAID) {
    throw ApiError.conflict(
      'DUPLICATE_PAYMENT',
      'This order has already been paid successfully.',
    )
  }

  if (order.status !== ORDER_STATUS.PENDING) {
    throw ApiError.conflict(
      'INVALID_STATUS_TRANSITION',
      `This order is ${order.status} and can no longer be paid.`,
    )
  }

  // ── 5. An order may only have one successful payment ────────────────────
  const existingSuccess = await Transaction.findOne({
    orderId: order._id,
    status: TRANSACTION_STATUS.SUCCESS,
  })

  if (existingSuccess) {
    throw ApiError.conflict(
      'DUPLICATE_PAYMENT',
      'This order already has a successful payment.',
    )
  }

  // ── 6. Calculate the payable amount from server side data only ─────────
  // The client may choose a quantity, but the unit price and the service fee
  // always come from the stored order. Any total sent by the browser is
  // ignored.
  const item = order.items[0]
  const safeQuantity = Math.min(
    DEMO_CATALOGUE.maxQuantity,
    Math.max(1, Number(quantity ?? item.quantity) || 1),
  )

  const breakdown = buildBreakdown({
    unitPricePaisa: item.unitPrice,
    serviceFeePaisa: order.serviceFee,
    quantity: safeQuantity,
  })

  if (breakdown.total <= 0) {
    throw ApiError.badRequest('VALIDATION_ERROR', 'The payable amount must be greater than zero.')
  }

  // ── 7. Claim the order (atomic, so two requests cannot both charge it) ──
  const claimed = await Order.findOneAndUpdate(
    {
      _id: order._id,
      status: ORDER_STATUS.PENDING,
      paymentInProgress: { $ne: true },
    },
    {
      $set: {
        paymentInProgress: true,
        subtotal: breakdown.subtotal,
        serviceFee: breakdown.serviceFee,
        totalAmount: breakdown.total,
        'items.0.quantity': breakdown.quantity,
        'items.0.lineTotal': breakdown.subtotal,
        customer: {
          name: customer.name ?? order.customer?.name ?? '',
          email: customer.email ?? order.customer?.email ?? '',
          mobile: customer.mobile ?? order.customer?.mobile ?? '',
        },
      },
    },
    { returnDocument: 'after' },
  )

  if (!claimed) {
    const current = await Order.findById(order._id)

    if (current?.status === ORDER_STATUS.PAID) {
      throw ApiError.conflict('DUPLICATE_PAYMENT', 'This order has already been paid successfully.')
    }

    throw ApiError.conflict(
      'DUPLICATE_PAYMENT',
      'Another payment for this order is already being processed.',
    )
  }

  // ── 8. Create the pending transaction ───────────────────────────────────
  const transactionReference = generateTransactionReference()
  const gatewayTxnRef = isLiveMode ? generateGatewayTxnRef(gatewayName) : null

  const transaction = await Transaction.create({
    transactionReference,
    orderId: claimed._id,
    orderNumber: claimed.orderNumber,
    gateway: gatewayName,
    amount: breakdown.total,
    currency: claimed.currency,
    status: TRANSACTION_STATUS.PENDING,
    mode: isLiveMode ? TRANSACTION_MODE.LIVE : TRANSACTION_MODE.MOCK,
    simulated: !isLiveMode,
    gatewayTxnRef,
    gatewayEnvironment: environmentFor(gatewayName),
    breakdown: {
      subtotal: breakdown.subtotal,
      serviceFee: breakdown.serviceFee,
      total: breakdown.total,
      quantity: breakdown.quantity,
      unitPrice: item.unitPrice,
    },
    customer: {
      name: claimed.customer?.name ?? '',
      email: claimed.customer?.email ?? '',
      mobile: claimed.customer?.mobile ?? '',
    },
  })

  // ── 9. Hand the payment to the provider adapter ─────────────────────────
  try {
    const adapter = getGatewayAdapter(gatewayName)

    const result = await adapter.createPayment({
      amount: breakdown.total,
      currency: claimed.currency,
      order: { orderNumber: claimed.orderNumber, id: String(claimed._id) },
      customer: claimed.customer,
      gateway: gatewayName,
      transactionReference,
      gatewayTxnRef,
      // Only the mock provider understands a forced outcome, and it is only
      // ever set when the development test controls are enabled.
      outcome: requestedOutcome,
    })

    // ── 9a. Hosted checkout: the customer still has to pay at the gateway ──
    if (result.redirect) {
      const updated = await Transaction.findOneAndUpdate(
        { _id: transaction._id },
        {
          $set: {
            status: TRANSACTION_STATUS.PENDING,
            gatewayTxnRef: result.gatewayTxnRef ?? gatewayTxnRef,
            gatewayReference: result.gatewayReference ?? null,
          },
        },
        { returnDocument: 'after' },
      )

      logger.info(
        {
          requestId,
          transactionReference: updated.transactionReference,
          orderNumber: updated.orderNumber,
          gateway: gatewayName,
          status: TRANSACTION_STATUS.PENDING,
          amountPaisa: breakdown.total,
          mode: updated.mode,
          environment: updated.gatewayEnvironment,
        },
        'payment initiated at gateway',
      )

      return {
        transaction: serialiseTransaction(updated, { order: claimed }),
        redirect: result.redirect,
      }
    }

    // ── 9b. The provider answered immediately (mock mode) ─────────────────
    const finalStatus = Object.values(TRANSACTION_STATUS).includes(result.status)
      ? result.status
      : TRANSACTION_STATUS.FAILED

    const updated = await Transaction.findOneAndUpdate(
      { _id: transaction._id },
      {
        $set: {
          status: finalStatus,
          failureReason: finalStatus === TRANSACTION_STATUS.SUCCESS ? null : result.failureReason,
          gatewayReference: result.gatewayReference ?? null,
          gatewayTxnRef: result.gatewayTxnRef ?? gatewayTxnRef,
        },
      },
      { returnDocument: 'after' },
    )

    // ── 10. Keep the order status consistent with the transaction ─────────
    await applyOrderStatus(claimed._id, finalStatus)

    logger.info(
      {
        requestId,
        transactionReference: updated.transactionReference,
        orderNumber: updated.orderNumber,
        gateway: gatewayName,
        status: finalStatus,
        amountPaisa: breakdown.total,
        mode: updated.mode,
      },
      'payment processed',
    )

    return {
      transaction: serialiseTransaction(updated, { order: claimed }),
      redirect: null,
    }
  } catch (error) {
    // The provider failed. The transaction must not stay "pending" forever
    // and the order must be released so the customer can try again.
    await Transaction.updateOne(
      { _id: transaction._id },
      {
        $set: {
          status: TRANSACTION_STATUS.FAILED,
          failureReason: 'The payment provider could not process this transaction.',
        },
      },
    )

    await Order.updateOne(
      { _id: claimed._id },
      { $set: { paymentInProgress: false, status: ORDER_STATUS.PENDING } },
    )

    logger.error(
      { requestId, orderNumber: claimed.orderNumber, code: error.code, err: error.message },
      'payment failed',
    )

    throw error
  }
}

/**
 * Move an order to the status that matches the transaction outcome.
 *
 *   SUCCESS   -> PAID       (final)
 *   FAILED    -> PENDING    (the customer may try again)
 *   CANCELLED -> CANCELLED  (final)
 *   PENDING   -> PENDING    (not final, still waiting for the provider)
 */
async function applyOrderStatus(orderId, transactionStatus) {
  const statusByTransaction = {
    [TRANSACTION_STATUS.SUCCESS]: ORDER_STATUS.PAID,
    [TRANSACTION_STATUS.FAILED]: ORDER_STATUS.PENDING,
    [TRANSACTION_STATUS.CANCELLED]: ORDER_STATUS.CANCELLED,
    [TRANSACTION_STATUS.PENDING]: ORDER_STATUS.PENDING,
  }

  await Order.updateOne(
    { _id: orderId },
    {
      $set: {
        status: statusByTransaction[transactionStatus] ?? ORDER_STATUS.PENDING,
        paymentInProgress: false,
      },
    },
  )
}

/**
 * Apply a verified gateway callback to a live transaction.
 *
 * The lookup uses the reference PayLab sent to the provider, and the amount is
 * checked against the stored amount before anything is finalised. A callback
 * that arrives twice is harmless: a final transaction is never changed again.
 *
 * @param {{
 *   gateway: string,
 *   gatewayTxnRef: string,
 *   outcome: {
 *     status: string,
 *     gatewayReference?: string|null,
 *     failureReason?: string|null,
 *     amountPaisa?: number|null,
 *     verified?: boolean
 *   }
 * }} input
 * @returns {Promise<object>} the serialised transaction
 */
export async function completeGatewayPayment({ gateway, gatewayTxnRef, outcome }) {
  const gatewayName = assertGateway(gateway)
  const reference = String(gatewayTxnRef || '').trim()

  if (!reference) {
    throw ApiError.badRequest('VALIDATION_ERROR', 'The gateway transaction reference is missing.')
  }

  const transaction = await Transaction.findOne({
    gateway: gatewayName,
    gatewayTxnRef: reference,
  })

  if (!transaction) {
    throw ApiError.notFound(
      'TRANSACTION_NOT_FOUND',
      'No transaction matches this gateway reference.',
    )
  }

  // A final transaction is never changed by a later callback.
  if (transaction.status !== TRANSACTION_STATUS.PENDING) {
    return getPaymentStatus(String(transaction._id))
  }

  if (
    outcome?.amountPaisa !== undefined &&
    outcome?.amountPaisa !== null &&
    Number(outcome.amountPaisa) !== transaction.amount
  ) {
    logger.error(
      {
        transactionReference: transaction.transactionReference,
        expectedAmountPaisa: transaction.amount,
        receivedAmountPaisa: outcome.amountPaisa,
      },
      'gateway callback amount mismatch',
    )

    throw new ApiError(
      400,
      'AMOUNT_MISMATCH',
      'The amount reported by the gateway does not match the stored amount. ' +
        'The transaction was not finalised.',
    )
  }

  const status = Object.values(TRANSACTION_STATUS).includes(outcome?.status)
    ? outcome.status
    : TRANSACTION_STATUS.PENDING

  // Some gateways send an intermediate "pending" notification. Keep the
  // transaction open but store what is known so far.
  if (status === TRANSACTION_STATUS.PENDING) {
    const updated = await Transaction.findOneAndUpdate(
      { _id: transaction._id, status: TRANSACTION_STATUS.PENDING },
      {
        $set: {
          gatewayReference: outcome?.gatewayReference ?? transaction.gatewayReference ?? null,
          gatewayVerified: Boolean(outcome?.verified),
        },
      },
      { returnDocument: 'after' },
    )

    return getPaymentStatus(String((updated ?? transaction)._id))
  }

  const updated = await Transaction.findOneAndUpdate(
    { _id: transaction._id, status: TRANSACTION_STATUS.PENDING },
    {
      $set: {
        status,
        failureReason:
          status === TRANSACTION_STATUS.SUCCESS ? null : outcome?.failureReason || null,
        gatewayReference: outcome?.gatewayReference ?? transaction.gatewayReference ?? null,
        gatewayVerified: Boolean(outcome?.verified),
      },
    },
    { returnDocument: 'after' },
  )

  // Another request finalised it in the meantime.
  if (!updated) {
    return getPaymentStatus(String(transaction._id))
  }

  await applyOrderStatus(updated.orderId, status)

  logger.info(
    {
      transactionReference: updated.transactionReference,
      gateway: gatewayName,
      status,
      gatewayVerified: Boolean(updated.gatewayVerified),
    },
    'gateway callback applied',
  )

  return getPaymentStatus(String(updated._id))
}

/**
 * Read the status of a transaction.
 *
 * @param {string} identifier transaction reference or Mongo id
 */
export async function getPaymentStatus(identifier) {
  const transaction = await findTransaction(identifier)
  const order = await Order.findById(transaction.orderId)

  return serialiseTransaction(transaction, { order })
}

/**
 * Development-only: force the outcome of a pending simulated transaction.
 *
 * This is the documented mock-only test action. It exists so a PENDING
 * transaction can be moved to a final state without pretending that a real
 * gateway callback was received.
 *
 * @param {string} identifier transaction reference or Mongo id
 * @param {string} outcome SUCCESS / FAILED / CANCELLED / PENDING
 */
export async function finaliseMockTransaction(identifier, outcome) {
  if (!env.testControlsEnabled) {
    throw new ApiError(
      403,
      'TEST_CONTROLS_DISABLED',
      'The mock outcome controls are disabled. Start the server with NODE_ENV=development, ' +
        'PAYMENT_MODE=mock and ENABLE_TEST_CONTROLS=true to use them.',
    )
  }

  const transaction = await findTransaction(identifier)

  if (transaction.status !== TRANSACTION_STATUS.PENDING) {
    throw ApiError.conflict(
      'INVALID_STATUS_TRANSITION',
      `This transaction is already ${transaction.status} and can no longer change its outcome.`,
    )
  }

  const { status, failureReason } = resolveMockOutcome(outcome)

  const updated = await Transaction.findOneAndUpdate(
    { _id: transaction._id, status: TRANSACTION_STATUS.PENDING },
    {
      $set: {
        status,
        failureReason: status === TRANSACTION_STATUS.SUCCESS ? null : failureReason,
      },
    },
    { returnDocument: 'after' },
  )

  if (!updated) {
    throw ApiError.conflict(
      'INVALID_STATUS_TRANSITION',
      'This transaction was already finalised by another request.',
    )
  }

  await applyOrderStatus(updated.orderId, status)

  logger.info(
    { transactionReference: updated.transactionReference, status, forced: true },
    'mock transaction outcome forced',
  )

  const order = await Order.findById(updated.orderId)
  return serialiseTransaction(updated, { order })
}

/**
 * Whether the development-only outcome controls are currently usable.
 */
export function areTestControlsEnabled() {
  return env.testControlsEnabled
}

export default {
  createPayment,
  completeGatewayPayment,
  getPaymentStatus,
  finaliseMockTransaction,
  areTestControlsEnabled,
}
