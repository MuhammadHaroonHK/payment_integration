import { PAYMENT_CONFIG } from '../config/paymentConfig'
import { getGatewayById } from '../data/gateways'
import {
  TRANSACTION_STATUS,
  generateSimulatedGatewayRef,
  generateTransactionId,
  generateTransactionRef,
} from '../utils/transactionHelpers'
import { appendTransaction, findTransaction, readTransactions } from './transactionStore'

/**
 * Mock payment service.
 *
 * ⚠️ NO REAL PAYMENT IS EVER PROCESSED HERE.
 * This module only imitates the shape of a gateway response so the UI can be
 * built and tested without touching JazzCash or Easypaisa.
 *
 * The real implementation of a payment gateway lives on the backend. When the
 * project switches to backend mode (`VITE_PAYMENT_MODE=backend`) the calls in
 * `paymentApi.js` go to the API instead of this file, and no UI code changes.
 */

/**
 * The four outcomes a simulated gateway call can produce.
 */
export const SIMULATED_OUTCOMES = [
  {
    id: 'success',
    label: 'Success',
    description: 'The simulated payment is approved and completed.',
    status: TRANSACTION_STATUS.SUCCESS,
    reason: '',
  },
  {
    id: 'failure',
    label: 'Failure',
    description: 'The simulated payment is declined by the gateway.',
    status: TRANSACTION_STATUS.FAILED,
    reason: 'Simulated decline — insufficient wallet balance.',
  },
  {
    id: 'cancelled',
    label: 'Cancelled',
    description: 'The customer aborts the simulated payment.',
    status: TRANSACTION_STATUS.CANCELLED,
    reason: 'Simulated cancellation — the customer aborted the demo payment.',
  },
  {
    id: 'pending',
    label: 'Pending',
    description: 'The simulated payment has not reached a final state.',
    status: TRANSACTION_STATUS.PENDING,
    reason: 'Simulated pending state — the transaction has not reached a final state.',
  },
]

export const DEFAULT_OUTCOME = 'success'

export function getOutcomeById(id) {
  return SIMULATED_OUTCOMES.find((outcome) => outcome.id === id) || SIMULATED_OUTCOMES[0]
}

/** Wait for a given number of milliseconds. */
function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * Create a simulated payment.
 *
 * @param {{
 *   order: object,
 *   totals: {subtotal:number, serviceFee:number, total:number, quantity:number},
 *   customer: {fullName:string,email:string,phone:string},
 *   gateway: string,
 *   simulatedOutcome?: string
 * }} payload
 * @returns {Promise<object>} a transaction record shaped like the proposed API response
 */
export async function createMockPayment(payload = {}) {
  const {
    order = {},
    totals = {},
    customer = {},
    gateway,
    simulatedOutcome = DEFAULT_OUTCOME,
  } = payload

  const outcome = getOutcomeById(simulatedOutcome)
  const gatewayMeta = getGatewayById(gateway)

  if (!gatewayMeta) {
    throw new Error('A payment method must be selected before creating a payment.')
  }
  if (!customer.fullName || !customer.email || !customer.phone) {
    throw new Error('Customer details are required before creating a payment.')
  }

  // Simulate gateway latency so the loading state is visible and testable.
  await wait(PAYMENT_CONFIG.simulateDelayMs)

  const transaction = {
    id: generateTransactionId(),
    transactionRef: generateTransactionRef(gatewayMeta.codePrefix),
    orderNumber: order.orderNumber || 'PL-DEMO',
    gateway: gatewayMeta.id,
    gatewayName: gatewayMeta.name,
    amount: Number(totals.total) || 0,
    currency: order.currency || PAYMENT_CONFIG.currency,
    status: outcome.status,
    reason: outcome.reason,
    simulated: true,
    // The provider's own id. Clearly marked as simulated, exactly like the
    // reference the server generates.
    gatewayReference: generateSimulatedGatewayRef(gatewayMeta.codePrefix),
    customerName: customer.fullName,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    // Snapshots so the result page can be shown on its own (deep link,
    // refresh, another browser tab) without relying on live UI state.
    order: { ...order },
    totals: { ...totals },
    customer: { ...customer },
    createdAt: new Date().toISOString(),
  }

  appendTransaction(transaction)

  return { ...transaction }
}

/**
 * Return the status of a simulated transaction.
 */
export async function getMockPaymentStatus(transactionId) {
  await wait(400)
  const transaction = findTransaction(transactionId)
  if (!transaction) {
    const error = new Error('Transaction not found.')
    error.code = 'NOT_FOUND'
    throw error
  }
  return { ...transaction }
}

/**
 * Return every demo transaction (newest first).
 */
export async function getMockTransactions() {
  await wait(300)
  return readTransactions().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export default {
  SIMULATED_OUTCOMES,
  DEFAULT_OUTCOME,
  createMockPayment,
  getMockPaymentStatus,
  getMockTransactions,
}
