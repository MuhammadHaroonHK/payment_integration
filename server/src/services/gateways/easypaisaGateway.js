import { ApiError } from '../../utils/ApiError.js'
import { GATEWAY, TRANSACTION_STATUS } from '../../models/Transaction.js'

/**
 * easypaisaGateway
 *
 * ⚠️ THIS ADAPTER IS NOT IMPLEMENTED AND CANNOT PROCESS PAYMENTS.
 *
 * It follows exactly the same approach as the JazzCash adapter: the provider
 * interface is complete and stable, but the provider specific parts are
 * deliberately left empty because Easypaisa's official merchant / staging
 * documentation and credentials are not available here.
 *
 * Nothing in this file invents an endpoint URL, an authentication scheme, a
 * signing rule or a callback format.
 */

/**
 * What is still required before this adapter can be completed.
 */
export const REQUIRED_INTEGRATION_DETAILS = {
  provider: 'Easypaisa',
  documentation: [
    'Official Easypaisa merchant / staging documentation (merchant registration required).',
    'The documented payment initiation endpoint, its exact path, HTTP method and version.',
    'The documented request field names, their formats and the mandatory ones.',
    'The documented response field names and the status / error code table.',
    'The documented hosted checkout (mobile web) URL and the full return parameter list.',
    'The documented server-to-server transaction verification endpoint and its payload.',
    'The documented signature / hash algorithm, the fields it covers and the shared secret used to compute it.',
    'The documented webhook / callback contract and its verification rules.',
    'The documented status values and which of them mean "final".',
  ],
  credentials: [
    'Easypaisa merchant / store account id.',
    'The Easypaisa username issued with the merchant account.',
    'The Easypaisa password issued with the merchant account (server side only).',
    'The Easypaisa integrity salt used for signing (server side only).',
    'The sandbox / staging base URL and the production base URL.',
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
 * Create an Easypaisa payment.
 *
 * @throws {ApiError} always — GATEWAY_NOT_CONFIGURED
 */
export async function createPayment() {
  throw new ApiError(
    501,
    'GATEWAY_NOT_CONFIGURED',
    'The Easypaisa adapter is not configured. This project runs on the local mock gateway; ' +
      'a real Easypaisa integration needs the official merchant documentation and authorised credentials.',
  )
}

/**
 * Read the status of an Easypaisa payment.
 *
 * @throws {ApiError} always — GATEWAY_NOT_CONFIGURED
 */
export async function getStatus() {
  throw new ApiError(
    501,
    'GATEWAY_NOT_CONFIGURED',
    'The Easypaisa adapter is not configured, so transaction status cannot be verified.',
  )
}

/**
 * Describe the provider.
 */
export function describe() {
  return {
    name: GATEWAY.EASYPAISA,
    displayName: 'Easypaisa',
    simulated: false,
    implemented: false,
    supports: [GATEWAY.EASYPAISA],
    supportedOutcomes: [],
    note:
      'Not implemented. Requires the official Easypaisa merchant documentation and authorised ' +
      'credentials. See REQUIRED_INTEGRATION_DETAILS.',
    requiredIntegrationDetails: REQUIRED_INTEGRATION_DETAILS,
  }
}

export const supportedOutcomes = [TRANSACTION_STATUS.SUCCESS]

export default { createPayment, getStatus, describe, REQUIRED_INTEGRATION_DETAILS }
