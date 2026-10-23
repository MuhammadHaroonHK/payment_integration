import { PAYMENT_CONFIG } from '../config/paymentConfig'
import apiClient from './apiClient'
import {
  createMockPayment,
  getMockPaymentStatus,
  getMockTransactions,
} from './mockPaymentService'
import {
  toBackendOutcome,
  toFrontendOrder,
  toFrontendTransaction,
  toFrontendTransactions,
  unwrap,
} from './apiAdapters'

/**
 * Payment API layer.
 *
 * This is the ONLY module the UI is allowed to use for payment operations.
 * It decides at runtime whether the call is handled by the local simulator or
 * by the real backend, based on `VITE_PAYMENT_MODE` in `.env`.
 *
 *   VITE_PAYMENT_MODE=mock     -> local simulation (default, no server needed)
 *   VITE_PAYMENT_MODE=backend  -> real HTTP calls to VITE_API_BASE_URL
 *
 * Backend endpoints:
 *   POST /api/payments/create
 *   GET  /api/payments/:transactionId/status
 *   GET  /api/payments/transactions
 *   GET  /api/orders/demo
 *
 * The backend answers with its own envelope and vocabulary; `apiAdapters.js`
 * translates it into the shapes the components expect. No component needed to
 * change.
 */

/**
 * Create a payment.
 *
 * Returns the transaction and, in live mode, the redirect the browser has to
 * perform to reach the gateway's hosted checkout page:
 *
 *   { transaction, redirect: { url, method, fields } | null }
 *
 * In mock mode there is never a redirect — the simulator answers immediately.
 *
 * @param {object} payload
 * @param {object} payload.order     order details (order number, product, unit price...)
 * @param {object} payload.totals    calculated amounts (subtotal, service fee, total)
 * @param {object} payload.customer  customer details (name, email, mobile)
 * @param {string} payload.gateway   'jazzcash' | 'easypaisa'
 * @param {string} [payload.simulatedOutcome] only used by the mock service
 * @returns {Promise<{transaction: object, redirect: object|null}>}
 */
export async function createPayment(payload) {
  if (PAYMENT_CONFIG.isMock) {
    const transaction = await createMockPayment(payload)
    return { transaction, redirect: null }
  }

  const response = await apiClient.post('/payments/create', {
    orderNumber: payload.order?.orderNumber,
    gateway: payload.gateway,
    customer: payload.customer,
    quantity: payload.totals?.quantity ?? payload.order?.quantity,
    // The backend only accepts this when its development test controls are
    // enabled. The page decides whether to send it at all.
    simulatedOutcome: toBackendOutcome(payload.simulatedOutcome),
  })

  const body = response?.data ?? {}

  return {
    transaction: toFrontendTransaction(unwrap(response)),
    redirect: body.redirect ?? null,
  }
}

/**
 * Check the status of a payment.
 *
 * @param {string} transactionId
 * @returns {Promise<object>} the transaction record
 */
export async function getPaymentStatus(transactionId) {
  if (PAYMENT_CONFIG.isMock) {
    return getMockPaymentStatus(transactionId)
  }

  const response = await apiClient.get(`/payments/${transactionId}/status`)

  return toFrontendTransaction(unwrap(response))
}

/**
 * Fetch the transaction history.
 *
 * @param {{gateway?: string, status?: string, search?: string, page?: number, limit?: number}} [filters]
 * @returns {Promise<Array<object>>}
 */
export async function getTransactionHistory(filters = {}) {
  if (PAYMENT_CONFIG.isMock) {
    return getMockTransactions()
  }

  const response = await apiClient.get('/payments/transactions', { params: filters })
  const data = unwrap(response)

  return toFrontendTransactions(data?.transactions)
}

/**
 * Fetch the full record of one transaction.
 *
 * The history list only carries what the table needs. This call returns the
 * complete record, including the order it paid for, so the details dialog can
 * show everything the server knows.
 *
 * @param {string} transactionId
 * @returns {Promise<object>} the transaction record
 */
export async function getTransactionDetails(transactionId) {
  if (PAYMENT_CONFIG.isMock) {
    return getMockPaymentStatus(transactionId)
  }

  const response = await apiClient.get(`/payments/transactions/${transactionId}`)

  return toFrontendTransaction(unwrap(response))
}

/**
 * Fetch the server controlled demo order.
 *
 * The backend creates a fresh, single use order from its own catalogue, so
 * the price the customer sees can never be changed in the browser.
 *
 * It also reports whether the server is running the simulator or the real
 * gateways, and which gateways have credentials. That is what lets the UI say
 * "you will be redirected to JazzCash" and disable an unconfigured method.
 *
 * @returns {Promise<{
 *   order: object,
 *   testControlsEnabled: boolean,
 *   mode: 'MOCK'|'LIVE',
 *   gatewayCapabilities: {jazzcash: boolean, easypaisa: boolean}
 * }>}
 */
export async function getDemoOrder(quantity = 1) {
  if (PAYMENT_CONFIG.isMock) {
    return {
      order: null,
      testControlsEnabled: true,
      mode: 'MOCK',
      gatewayCapabilities: { jazzcash: true, easypaisa: true },
    }
  }

  const response = await apiClient.get('/orders/demo', { params: { quantity } })
  const body = response?.data ?? {}
  const gateways = body.capabilities?.gateways ?? {}

  return {
    order: toFrontendOrder(body.data),
    testControlsEnabled: Boolean(body.capabilities?.testControlsEnabled),
    mode: body.capabilities?.mode === 'LIVE' ? 'LIVE' : 'MOCK',
    gatewayCapabilities: {
      jazzcash: gateways.jazzcash !== false,
      easypaisa: gateways.easypaisa !== false,
    },
  }
}

export default {
  createPayment,
  getPaymentStatus,
  getTransactionDetails,
  getTransactionHistory,
  getDemoOrder,
}
