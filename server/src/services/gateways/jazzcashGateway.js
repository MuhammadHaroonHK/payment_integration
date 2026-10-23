import { ApiError } from '../../utils/ApiError.js'
import { GATEWAY, TRANSACTION_STATUS } from '../../models/Transaction.js'

/**
 * jazzcashGateway
 *
 * ⚠️ THIS ADAPTER IS NOT IMPLEMENTED AND CANNOT PROCESS PAYMENTS.
 *
 * It exists so the rest of the application can be written against a stable
 * provider interface, and so the "real" mode can be enabled later without
 * touching a single page or service.
 *
 * Nothing in this file invents an endpoint URL, a signature, a payload format
 * or a verification rule. Those details only exist in JazzCash's official
 * merchant integration documentation, which is not available here.
 *
 * If the server is started with PAYMENT_MODE=live, this adapter throws
 * GATEWAY_NOT_CONFIGURED instead of silently simulating a payment.
 */

/**
 * What is still required before this adapter can be completed.
 *
 * Everything below has to come from JazzCash's official merchant
 * documentation and from an authorised merchant account.
 */
export const REQUIRED_INTEGRATION_DETAILS = {
  provider: 'JazzCash',
  documentation: [
    'Official JazzCash merchant / integration documentation (merchant portal access required).',
    'The documented payment-session creation endpoint, its exact path, HTTP method and version.',
    'The documented request field names, their formats and which of them are mandatory.',
    'The documented response field names and the status / error code table.',
    'The documented redirect (hosted checkout) URL and the full return parameter list.',
    'The documented server-to-server transaction verification endpoint and its payload.',
    'The documented signature / hash algorithm, the fields it covers and the secret key used to compute it.',
    'The documented webhook / callback endpoint contract and its signature verification rules.',
    'The documented status values and which of them mean "final".',
  ],
  credentials: [
    'Merchant ID (username) issued by JazzCash.',
    'Password / secret issued by JazzCash (server side only).',
    'Integrity salt / signing key issued by JazzCash (server side only).',
    'The sandbox base URL and the production base URL.',
    'A verified merchant return URL and server notification URL.',
  ],
  rules: [
    'Every credential must stay on the server. VITE_ variables are public and are inlined into the browser bundle.',
    'The amount sent to the gateway must be the amount the server calculated, never a value received from the browser.',
    'A transaction may only be marked SUCCESS after the server has verified the gateway response or callback.',
    'The verification must use a constant-time comparison for the signature.',
  ],
}

/**
 * Create a JazzCash payment.
 *
 * @throws {ApiError} always — GATEWAY_NOT_CONFIGURED
 */
export async function createPayment() {
  throw new ApiError(
    501,
    'GATEWAY_NOT_CONFIGURED',
    'The JazzCash adapter is not configured. This project runs on the local mock gateway; ' +
      'a real JazzCash integration needs the official merchant documentation and authorised credentials.',
  )
}

/**
 * Read the status of a JazzCash payment.
 *
 * @throws {ApiError} always — GATEWAY_NOT_CONFIGURED
 */
export async function getStatus() {
  throw new ApiError(
    501,
    'GATEWAY_NOT_CONFIGURED',
    'The JazzCash adapter is not configured, so transaction status cannot be verified.',
  )
}

/**
 * Describe the provider.
 */
export function describe() {
  return {
    name: GATEWAY.JAZZCASH,
    displayName: 'JazzCash',
    simulated: false,
    implemented: false,
    supports: [GATEWAY.JAZZCASH],
    supportedOutcomes: [],
    note:
      'Not implemented. Requires the official JazzCash merchant documentation and authorised ' +
      'credentials. See REQUIRED_INTEGRATION_DETAILS.',
    requiredIntegrationDetails: REQUIRED_INTEGRATION_DETAILS,
  }
}

export const supportedOutcomes = [TRANSACTION_STATUS.SUCCESS]

export default { createPayment, getStatus, describe, REQUIRED_INTEGRATION_DETAILS }
