import { Order, ORDER_STATUS } from '../models/Order.js'
import { DEMO_CATALOGUE } from '../config/demoCatalogue.js'
import { generateOrderNumber } from '../utils/generateReference.js'
import { buildBreakdown, formatPKR } from '../utils/money.js'
import { ApiError } from '../utils/ApiError.js'

/**
 * Order service
 *
 * Owns everything about the *trusted* side of an order: what it contains and
 * how much it costs. The browser never decides an amount.
 */

/**
 * Turn a stored order into the API representation.
 *
 * Every amount is returned as integer paisa *and* as a formatted PKR string
 * so the frontend can show it without doing any currency maths of its own.
 */
export function serialiseOrder(order) {
  if (!order) return null

  const items = (order.items || []).map((item) => ({
    productCode: item.productCode,
    name: item.name,
    description: item.description ?? '',
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    unitPriceFormatted: formatPKR(item.unitPrice),
    lineTotal: item.lineTotal,
    lineTotalFormatted: formatPKR(item.lineTotal),
  }))

  return {
    id: String(order._id),
    orderNumber: order.orderNumber,
    status: order.status,
    currency: order.currency,
    quantity: order.items?.[0]?.quantity ?? 1,
    items,
    subtotal: order.subtotal,
    subtotalFormatted: formatPKR(order.subtotal),
    serviceFee: order.serviceFee,
    serviceFeeFormatted: formatPKR(order.serviceFee),
    totalAmount: order.totalAmount,
    totalAmountFormatted: formatPKR(order.totalAmount),
    customer: {
      name: order.customer?.name ?? '',
      email: order.customer?.email ?? '',
      mobile: order.customer?.mobile ?? '',
    },
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  }
}

/**
 * Create a fresh demo order from the server controlled catalogue.
 *
 * Each call creates a new, single use order. That is what makes it possible
 * to run the demo payment again and again without ever paying the same
 * order twice.
 *
 * @param {{quantity?: number, customer?: {name?: string, email?: string, mobile?: string}}} input
 */
export async function createDemoOrder({ quantity = 1, customer = {} } = {}) {
  const safeQuantity = Math.min(
    DEMO_CATALOGUE.maxQuantity,
    Math.max(1, Number(quantity) || 1),
  )

  const breakdown = buildBreakdown({
    unitPricePaisa: DEMO_CATALOGUE.unitPricePaisa,
    serviceFeePaisa: DEMO_CATALOGUE.serviceFeePaisa,
    quantity: safeQuantity,
  })

  const order = await Order.create({
    orderNumber: generateOrderNumber(),
    customer: {
      name: customer.name ?? '',
      email: customer.email ?? '',
      mobile: customer.mobile ?? '',
    },
    items: [
      {
        productCode: DEMO_CATALOGUE.productCode,
        name: DEMO_CATALOGUE.productName,
        description: DEMO_CATALOGUE.productDescription,
        quantity: breakdown.quantity,
        unitPrice: DEMO_CATALOGUE.unitPricePaisa,
        lineTotal: breakdown.subtotal,
      },
    ],
    subtotal: breakdown.subtotal,
    serviceFee: breakdown.serviceFee,
    totalAmount: breakdown.total,
    currency: DEMO_CATALOGUE.currency,
    status: ORDER_STATUS.PENDING,
    source: 'DEMO_CATALOGUE',
  })

  return order
}

/**
 * Find an order by its order number.
 *
 * @param {string} orderNumber
 */
export async function findOrderByNumber(orderNumber) {
  if (typeof orderNumber !== 'string' || !orderNumber.trim()) {
    throw ApiError.badRequest('VALIDATION_ERROR', 'An order number is required.')
  }

  const order = await Order.findOne({ orderNumber: orderNumber.trim() })

  if (!order) {
    throw ApiError.notFound(
      'ORDER_NOT_FOUND',
      `No order was found with the number "${orderNumber.trim()}". ` +
        'Call GET /api/orders/demo to create a demo order first.',
    )
  }

  return order
}

/**
 * Find an order by its Mongo id.
 */
export async function findOrderById(orderId) {
  return Order.findById(orderId)
}

export default { createDemoOrder, findOrderByNumber, findOrderById, serialiseOrder }
