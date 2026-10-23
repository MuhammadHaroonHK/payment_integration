/**
 * apiAdapters
 *
 * The bridge between the PayLab backend contract and the shapes the React
 * components expect.
 *
 * The backend speaks in its own, deliberately strict vocabulary:
 *   - an envelope:      { success, mode, message, data }
 *   - canonical names:  transactionReference, failureReason, JAZZCASH
 *   - money in paisa:   465000 means PKR 4,650
 *
 * The UI works with:
 *   - a bare transaction object
 *   - transactionRef, reason, jazzcash
 *   - money in rupees:  4650 means PKR 4,650
 *
 * All of that translation lives here, in the service layer, so no component
 * has to know about it. The components were not changed.
 */

/** Convert paisa (integer) to rupees (number). */
export function toRupees(paisa) {
  const value = Number(paisa)
  if (!Number.isFinite(value)) return 0
  return Math.round(value) / 100
}

/** Convert rupees to paisa (integer). */
export function toPaisa(rupees) {
  const value = Number(rupees)
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100)
}

/** Gateway names used by the UI. */
const FRONTEND_GATEWAY_IDS = {
  JAZZCASH: 'jazzcash',
  EASYPAISA: 'easypaisa',
}

/**
 * Map a canonical gateway name to the id the UI uses.
 */
export function toFrontendGateway(gateway) {
  return FRONTEND_GATEWAY_IDS[String(gateway || '').toUpperCase()] ?? gateway
}

/**
 * Map the UI's simulated outcome id to the status the API expects.
 *
 * The UI uses lowercase ids ("success"), the API uses the canonical status
 * names ("SUCCESS").
 */
const BACKEND_OUTCOMES = {
  success: 'SUCCESS',
  failure: 'FAILED',
  cancelled: 'CANCELLED',
  pending: 'PENDING',
}

export function toBackendOutcome(outcome) {
  if (!outcome) return undefined
  return BACKEND_OUTCOMES[String(outcome).toLowerCase()] ?? undefined
}

/**
 * Unwrap the API envelope.
 *
 * The backend always answers with `{ success, data }`. The transaction
 * history endpoint additionally repeats the list at the top level, so both
 * shapes are handled.
 */
export function unwrap(response) {
  const body = response?.data ?? response ?? {}

  if (body.data !== undefined) return body.data
  return body
}

/**
 * Map a backend order to the order shape the UI expects.
 *
 * @param {object} order
 * @returns {object|null}
 */
export function toFrontendOrder(order) {
  if (!order) return null

  const item = order.items?.[0] || {}

  return {
    orderNumber: order.orderNumber,
    productCode: item.productCode || 'PAYLAB-FE-04',
    productName: item.name || 'Frontend Engineering Practice — Module 04',
    productDescription:
      item.description || 'Checkout flow, form validation and result states',
    unitPrice: toRupees(item.unitPrice),
    quantity: order.quantity ?? item.quantity ?? 1,
    serviceFee: toRupees(order.serviceFee),
    currency: order.currency || 'PKR',
  }
}

/**
 * Map a backend money breakdown to the totals shape the UI expects.
 */
export function toFrontendTotals(breakdown, fallbackTotal = 0) {
  if (!breakdown) {
    return { quantity: 1, unitPrice: 0, subtotal: 0, serviceFee: 0, total: toRupees(fallbackTotal) }
  }

  return {
    quantity: breakdown.quantity ?? 1,
    unitPrice: toRupees(breakdown.unitPrice ?? 0),
    subtotal: toRupees(breakdown.subtotal),
    serviceFee: toRupees(breakdown.serviceFee),
    total: toRupees(breakdown.total),
  }
}

/**
 * Map a backend transaction to the transaction shape the UI expects.
 *
 * @param {object} transaction
 * @returns {object|null}
 */
export function toFrontendTransaction(transaction) {
  if (!transaction) return null

  const customer = transaction.customer || {}

  return {
    id: transaction.id,
    transactionRef: transaction.transactionReference,
    orderNumber: transaction.orderNumber,
    gateway: toFrontendGateway(transaction.gateway),
    gatewayName: transaction.gatewayName,
    amount: toRupees(transaction.amount),
    currency: transaction.currency || 'PKR',
    status: transaction.status,
    reason: transaction.failureReason || '',
    mode: transaction.mode,
    simulated: transaction.simulated !== false,
    gatewayVerified: Boolean(transaction.gatewayVerified),
    gatewayEnvironment: transaction.gatewayEnvironment ?? null,
    // The provider's own transaction id. This is the field a real integration
    // uses for reconciliation, refunds and support tickets, so it must not be
    // dropped on the way to the UI.
    gatewayReference: transaction.gatewayReference || '',
    customerName: customer.name || '',
    customerEmail: customer.email || '',
    customerPhone: customer.mobile || '',
    // Snapshots so the result page can describe the transaction on its own.
    order: toFrontendOrder(transaction.order),
    totals: toFrontendTotals(transaction.breakdown, transaction.amount),
    customer: {
      fullName: customer.name || '',
      email: customer.email || '',
      phone: customer.mobile || '',
    },
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
  }
}

/**
 * Map a list of backend transactions.
 */
export function toFrontendTransactions(transactions) {
  if (!Array.isArray(transactions)) return []
  return transactions.map(toFrontendTransaction)
}
