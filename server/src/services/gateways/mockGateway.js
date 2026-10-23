import { env } from '../../config/env.js'
import { ApiError } from '../../utils/ApiError.js'
import { GATEWAY, TRANSACTION_STATUS } from '../../models/Transaction.js'
import { generateSimulatedGatewayReference } from '../../utils/generateReference.js'

/**
 * mockGateway
 *
 * The only working payment provider in this version of PayLab.
 *
 * ⚠️ NOTHING REAL HAPPENS HERE.
 * The gateway simulates the round trip of a mobile wallet payment and
 * returns a clearly labelled result. No JazzCash or Easypaisa service is
 * contacted, no money moves and the returned references are prefixed with
 * "SIM-MOCK-" so they can never be mistaken for an official gateway id.
 *
 * The adapter interface (every provider implements the same three functions):
 *
 *   createPayment({ amount, currency, order, customer, outcome })
 *     -> { status, gatewayReference, failureReason, message }
 *   getStatus(gatewayReference)
 *     -> { status, gatewayReference, failureReason }
 *   describe()
 *     -> { name, displayName, simulated, mode }
 */

/** The reasons the simulator can report. They are obviously simulated. */
export const MOCK_REASONS = {
  [TRANSACTION_STATUS.FAILED]: 'Simulated decline — insufficient wallet balance.',
  [TRANSACTION_STATUS.CANCELLED]: 'Simulated cancellation — the customer aborted the demo payment.',
  [TRANSACTION_STATUS.PENDING]:
    'Simulated pending state — the transaction has not reached a final state.',
}

/**
 * How long the simulated gateway call takes. A little latency makes the
 * loading state of the frontend visible and realistic.
 */
const SIMULATED_LATENCY_MS = env.MOCK_GATEWAY_DELAY_MS

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * Decide the outcome of a simulated payment.
 *
 * @param {string} outcome one of SUCCESS / FAILED / CANCELLED / PENDING
 * @returns {{status: string, failureReason: string|null}}
 */
export function resolveMockOutcome(outcome) {
  const status = Object.values(TRANSACTION_STATUS).includes(outcome)
    ? outcome
    : TRANSACTION_STATUS.SUCCESS

  return {
    status,
    failureReason: MOCK_REASONS[status] ?? null,
  }
}

/**
 * Simulate a payment.
 *
 * @param {{
 *   amount: number,
 *   currency: string,
 *   order: object,
 *   customer: object,
 *   gateway: string,
 *   outcome: string
 * }} input
 */
export async function createPayment({ amount, currency, order, customer, gateway, outcome }) {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'The payment amount is invalid.')
  }

  if (amount === 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'The payable amount must be greater than zero.')
  }

  // Simulated gateway round trip.
  await wait(SIMULATED_LATENCY_MS)

  const { status, failureReason } = resolveMockOutcome(outcome)

  return {
    status,
    gatewayReference: generateSimulatedGatewayReference(gateway),
    failureReason,
    message:
      status === TRANSACTION_STATUS.SUCCESS
        ? 'Simulated payment completed'
        : status === TRANSACTION_STATUS.PENDING
          ? 'Simulated payment is still pending'
          : 'Simulated payment was not completed',
    simulated: true,
    mode: 'MOCK',
    currency,
    amount,
    orderNumber: order?.orderNumber,
    customerName: customer?.name,
  }
}

/**
 * Read the status of a simulated transaction.
 *
 * The simulator has no server side state of its own — the transaction is
 * stored in MongoDB — so this only reports what the caller already knows.
 */
export async function getStatus(gatewayReference, currentStatus = TRANSACTION_STATUS.PENDING) {
  await wait(Math.min(SIMULATED_LATENCY_MS, 200))

  return {
    status: currentStatus,
    gatewayReference,
    failureReason: MOCK_REASONS[currentStatus] ?? null,
    simulated: true,
  }
}

/**
 * Describe the provider (used by the health endpoint).
 */
export function describe() {
  return {
    name: 'MOCK',
    displayName: 'PayLab Mock Gateway',
    simulated: true,
    supports: [...Object.values(GATEWAY)],
    supportedOutcomes: [...Object.values(TRANSACTION_STATUS)],
    note: 'Simulated responses only. No real payment provider is contacted.',
  }
}

export default { createPayment, getStatus, describe, resolveMockOutcome, MOCK_REASONS }
