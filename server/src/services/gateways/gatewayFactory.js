import { env } from '../../config/env.js'
import { ApiError } from '../../utils/ApiError.js'
import { GATEWAY } from '../../models/Transaction.js'
import mockGateway from './mockGateway.js'
import jazzcashGateway from './jazzcashGateway.js'
import easypaisaGateway from './easypaisaGateway.js'

/**
 * gatewayFactory
 *
 * The single place that decides which provider handles a payment.
 *
 * The rest of the application only ever talks to the adapter interface, so it
 * never contains provider specific code:
 *
 *   createPayment({ amount, currency, order, customer, outcome })
 *   getStatus(gatewayReference, currentStatus)
 *   describe()
 */

/** Every gateway name PayLab understands. */
export const SUPPORTED_GATEWAYS = Object.values(GATEWAY)

/** The canonical name of each gateway. */
const CANONICAL_NAMES = {
  JAZZCASH: GATEWAY.JAZZCASH,
  EASYPAISA: GATEWAY.EASYPAISA,
}

/**
 * Normalise a gateway name coming from the client.
 *
 * The PayLab frontend uses lowercase ids ("jazzcash"), while the API
 * contract uses the canonical uppercase names ("JAZZCASH"). Both are
 * accepted; anything else is rejected.
 *
 * @param {string} value
 * @returns {string|null} the canonical name or null when unknown
 */
export function normaliseGateway(value) {
  if (typeof value !== 'string') return null

  const cleaned = value.trim().toUpperCase().replace(/[\s_-]/g, '')
  return CANONICAL_NAMES[cleaned] ?? null
}

/**
 * Normalise a gateway name or throw a clear error.
 *
 * @param {string} value
 * @returns {string} the canonical gateway name
 * @throws {ApiError} 400 INVALID_GATEWAY
 */
export function assertGateway(value) {
  const gateway = normaliseGateway(value)

  if (!gateway) {
    throw new ApiError(
      400,
      'INVALID_GATEWAY',
      `"${value}" is not a supported payment gateway. Supported gateways: ${SUPPORTED_GATEWAYS.join(', ')}.`,
    )
  }

  return gateway
}

/**
 * Get the adapter that handles the given gateway.
 *
 * In mock mode both gateways are handled by the simulator, so the UI, the
 * service layer and the database code stay identical for both payment
 * methods.
 *
 * In live mode the provider specific adapter is returned — and that adapter
 * refuses to work until it has been implemented with the official
 * documentation.
 *
 * @param {string} gateway canonical gateway name
 */
export function getGatewayAdapter(gateway) {
  const name = assertGateway(gateway)

  if (env.PAYMENT_MODE === 'mock') {
    return mockGateway
  }

  if (name === GATEWAY.JAZZCASH) return jazzcashGateway
  if (name === GATEWAY.EASYPAISA) return easypaisaGateway

  throw new ApiError(400, 'INVALID_GATEWAY', `"${gateway}" is not a supported payment gateway.`)
}

/**
 * A safe description of the active payment setup (health endpoint).
 */
export function describePaymentSetup() {
  return {
    mode: env.PAYMENT_MODE.toUpperCase(),
    simulated: env.PAYMENT_MODE === 'mock',
    testControlsEnabled: env.testControlsEnabled,
    gateways: SUPPORTED_GATEWAYS.map((gateway) => ({
      gateway,
      provider: env.PAYMENT_MODE === 'mock' ? 'MOCK' : gateway,
      displayName:
        env.PAYMENT_MODE === 'mock'
          ? gateway === GATEWAY.JAZZCASH
            ? 'JazzCash (simulated)'
            : 'Easypaisa (simulated)'
          : gateway,
      simulated: env.PAYMENT_MODE === 'mock',
      implemented: env.PAYMENT_MODE === 'mock',
      supportedOutcomes:
        env.PAYMENT_MODE === 'mock'
          ? ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED']
          : [],
    })),
    note:
      env.PAYMENT_MODE === 'mock'
        ? 'Simulated responses only. No real payment provider is contacted.'
        : 'A real provider adapter is required before live payments are possible.',
  }
}

export default {
  SUPPORTED_GATEWAYS,
  normaliseGateway,
  assertGateway,
  getGatewayAdapter,
  describePaymentSetup,
}
