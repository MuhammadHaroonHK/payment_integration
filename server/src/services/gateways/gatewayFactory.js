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
 *   createPayment({ amount, currency, order, customer, transactionReference,
 *                   gatewayTxnRef })
 *     -> { status, gatewayTxnRef, gatewayReference, failureReason, message,
 *          redirect? }
 *   verifyCallback(payload)  (real adapters only)
 *   getStatus(gatewayTxnRef) (real adapters only)
 *   describe()
 */

/** Every gateway name PayLab understands. */
export const SUPPORTED_GATEWAYS = Object.values(GATEWAY)

/** The canonical name of each gateway. */
const CANONICAL_NAMES = {
  JAZZCASH: GATEWAY.JAZZCASH,
  EASYPAISA: GATEWAY.EASYPAISA,
}

/** The real adapter for each gateway. */
const LIVE_ADAPTERS = {
  [GATEWAY.JAZZCASH]: jazzcashGateway,
  [GATEWAY.EASYPAISA]: easypaisaGateway,
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
 * Whether the real adapter of a gateway has its credentials configured.
 *
 * @param {string} gateway canonical gateway name
 */
export function isGatewayConfigured(gateway) {
  const name = assertGateway(gateway)

  if (env.PAYMENT_MODE === 'mock') return true
  return LIVE_ADAPTERS[name]?.isConfigured() ?? false
}

/**
 * Get the adapter that handles the given gateway.
 *
 * In mock mode both gateways are handled by the simulator, so the UI, the
 * service layer and the database code stay identical for both payment
 * methods.
 *
 * In live mode the provider specific adapter is returned.
 *
 * @param {string} gateway canonical gateway name
 */
export function getGatewayAdapter(gateway) {
  const name = assertGateway(gateway)

  if (env.PAYMENT_MODE === 'mock') {
    return mockGateway
  }

  const adapter = LIVE_ADAPTERS[name]

  if (!adapter) {
    throw new ApiError(400, 'INVALID_GATEWAY', `"${gateway}" is not a supported payment gateway.`)
  }

  return adapter
}

/**
 * A safe description of the active payment setup (health endpoint).
 *
 * Only names, modes and booleans — never a credential.
 */
export function describePaymentSetup() {
  return {
    mode: env.PAYMENT_MODE.toUpperCase(),
    simulated: env.PAYMENT_MODE === 'mock',
    testControlsEnabled: env.testControlsEnabled,
    /** Where the gateway sends the customer back. Public by definition. */
    callbackBaseUrl: env.PUBLIC_BASE_URL,
    gateways: SUPPORTED_GATEWAYS.map((gateway) => {
      if (env.PAYMENT_MODE === 'mock') {
        return {
          gateway,
          provider: 'MOCK',
          displayName:
            gateway === GATEWAY.JAZZCASH ? 'JazzCash (simulated)' : 'Easypaisa (simulated)',
          simulated: true,
          implemented: true,
          configured: true,
          environment: null,
          flow: 'MOCK',
          supportedOutcomes: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'],
        }
      }

      return {
        gateway,
        provider: gateway,
        ...LIVE_ADAPTERS[gateway].describe(),
      }
    }),
    note:
      env.PAYMENT_MODE === 'mock'
        ? 'Simulated responses only. No real payment provider is contacted.'
        : 'Real hosted-checkout adapters are active. Transactions are only finalised after the gateway callback is verified.',
  }
}

export default {
  SUPPORTED_GATEWAYS,
  normaliseGateway,
  assertGateway,
  getGatewayAdapter,
  isGatewayConfigured,
  describePaymentSetup,
}
