import { Transaction, TRANSACTION_STATUS, GATEWAY } from '../models/Transaction.js'
import { formatPKR } from '../utils/money.js'
import { ApiError } from '../utils/ApiError.js'

/**
 * Transaction service
 *
 * Reading and listing transactions. Creating them is the job of the payment
 * service.
 */

const GATEWAY_LABELS = {
  [GATEWAY.JAZZCASH]: 'JazzCash',
  [GATEWAY.EASYPAISA]: 'Easypaisa',
}

/**
 * Turn a stored transaction into the API representation.
 *
 * @param {object} transaction a mongoose document (or plain object)
 * @param {object} [options]
 * @param {object} [options.order] the related order, when it should be included
 */
export function serialiseTransaction(transaction, { order = null } = {}) {
  if (!transaction) return null

  const breakdown = transaction.breakdown || {}

  const payload = {
    id: String(transaction._id),
    transactionReference: transaction.transactionReference,
    orderId: transaction.orderId ? String(transaction.orderId) : null,
    orderNumber: transaction.orderNumber,
    gateway: transaction.gateway,
    gatewayName: GATEWAY_LABELS[transaction.gateway] || transaction.gateway,
    amount: transaction.amount,
    amountFormatted: formatPKR(transaction.amount),
    currency: transaction.currency,
    status: transaction.status,
    mode: transaction.mode,
    failureReason: transaction.failureReason ?? null,
    gatewayReference: transaction.gatewayReference ?? null,
    simulated: Boolean(transaction.simulated),
    breakdown: {
      subtotal: breakdown.subtotal ?? transaction.amount,
      subtotalFormatted: formatPKR(breakdown.subtotal ?? transaction.amount),
      serviceFee: breakdown.serviceFee ?? 0,
      serviceFeeFormatted: formatPKR(breakdown.serviceFee ?? 0),
      total: breakdown.total ?? transaction.amount,
      totalFormatted: formatPKR(breakdown.total ?? transaction.amount),
      quantity: breakdown.quantity ?? 1,
      unitPrice: breakdown.unitPrice ?? 0,
    },
    customer: {
      name: transaction.customer?.name ?? '',
      email: transaction.customer?.email ?? '',
      mobile: transaction.customer?.mobile ?? '',
    },
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
  }

  if (order) {
    payload.order = {
      id: String(order._id),
      orderNumber: order.orderNumber,
      status: order.status,
      currency: order.currency,
      quantity: order.items?.[0]?.quantity ?? 1,
      subtotal: order.subtotal,
      subtotalFormatted: formatPKR(order.subtotal),
      serviceFee: order.serviceFee,
      serviceFeeFormatted: formatPKR(order.serviceFee),
      totalAmount: order.totalAmount,
      totalAmountFormatted: formatPKR(order.totalAmount),
      items: (order.items || []).map((item) => ({
        productCode: item.productCode,
        name: item.name,
        description: item.description ?? '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitPriceFormatted: formatPKR(item.unitPrice),
        lineTotal: item.lineTotal,
        lineTotalFormatted: formatPKR(item.lineTotal),
      })),
      customer: {
        name: order.customer?.name ?? '',
        email: order.customer?.email ?? '',
        mobile: order.customer?.mobile ?? '',
      },
    }
  }

  return payload
}

/**
 * Find a transaction by its reference or by its Mongo id.
 *
 * @param {string} identifier
 */
export async function findTransaction(identifier) {
  if (typeof identifier !== 'string' || !identifier.trim()) {
    throw ApiError.badRequest('VALIDATION_ERROR', 'A transaction identifier is required.')
  }

  const value = identifier.trim()

  const query = value.match(/^[a-f\d]{24}$/i)
    ? { $or: [{ _id: value }, { transactionReference: value }] }
    : { transactionReference: value }

  const transaction = await Transaction.findOne(query)

  if (!transaction) {
    throw ApiError.notFound(
      'TRANSACTION_NOT_FOUND',
      `No transaction was found with the reference "${value}".`,
    )
  }

  return transaction
}

/**
 * List transactions with filtering and pagination.
 *
 * ⚠️ SECURITY NOTE
 * This endpoint has no authentication because the practice project has no
 * users. In production the query must be scoped to the authenticated
 * customer or to an authorised administrator — see server/README.md.
 *
 * @param {{page?: number, limit?: number, gateway?: string, status?: string, search?: string}} filters
 */
export async function listTransactions({ page = 1, limit = 20, gateway, status, search } = {}) {
  const filter = {}

  if (gateway && gateway !== 'all') filter.gateway = gateway
  if (status && status !== 'all') filter.status = status

  if (search && search.trim()) {
    const term = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const safeTerm = new RegExp(term, 'i')

    filter.$or = [{ transactionReference: safeTerm }, { orderNumber: safeTerm }]
  }

  const safePage = Math.max(1, Number(page) || 1)
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20))

  const [items, total] = await Promise.all([
    Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit),
    Transaction.countDocuments(filter),
  ])

  const totalPages = Math.max(1, Math.ceil(total / safeLimit))

  return {
    items: items.map((item) => serialiseTransaction(item)),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages,
      hasNextPage: safePage < totalPages,
      hasPreviousPage: safePage > 1,
    },
  }
}

/**
 * The statuses a transaction may have (used by the frontend filter list).
 */
export function getSupportedStatuses() {
  return Object.values(TRANSACTION_STATUS)
}

export default {
  serialiseTransaction,
  findTransaction,
  listTransactions,
  getSupportedStatuses,
}
