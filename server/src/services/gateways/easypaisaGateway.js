import crypto from 'node:crypto'
import { env } from '../../config/env.js'
import { ApiError } from '../../utils/ApiError.js'
import { logger } from '../../utils/logger.js'
import { GATEWAY, TRANSACTION_STATUS } from '../../models/Transaction.js'
import { formatPktExpiry, addHours } from '../../utils/pkTime.js'

/**
 * easypaisaGateway
 *
 * Real Easypaisa integration using the **Easypay hosted checkout**:
 *
 *   1. the server builds a hashed request (`merchantHashedReq`, AES/ECB with
 *      the merchant hash key) and returns the form fields,
 *   2. the browser POSTs them to the Easypay page and the customer pays,
 *   3. Easypaisa sends the customer back with an `auth_token`,
 *   4. the server posts that token to the confirmation page,
 *   5. Easypaisa redirects to our callback with `status`, `desc` and
 *      `orderRefNumber`,
 *   6. when REST API credentials are configured, the server confirms the real
 *      state with the inquiry API before trusting the result.
 *
 * The store id and hash key come from `server/.env`. The hash key is used only
 * on the server to build `merchantHashedReq`; it never reaches the browser.
 */

const HOSTS = {
  sandbox: 'https://easypaystg.easypaisa.com.pk',
  production: 'https://easypay.easypaisa.com.pk',
}

const PATHS = {
  checkout: '/easypay/Index.jsf',
  confirm: '/easypay/Confirm.jsf',
  inquiry: '/easypay-service/rest/v4/inquire-transaction',
}

/** The fields Easypaisa includes in `merchantHashedReq`, in its order. */
export const HASH_FIELDS = [
  'amount',
  'autoRedirect',
  'emailAddr',
  'expiryDate',
  'mobileNum',
  'orderRefNum',
  'paymentMethod',
  'postBackURL',
  'storeId',
]

/** Final statuses the redirect may carry. */
const PENDING_STATUS_CODES = new Set(['0001'])

export const REQUIRED_ENV = ['EASYPAISA_STORE_ID', 'EASYPAISA_HASH_KEY']

/** REST credentials are optional, but they enable server-side verification. */
export const INQUIRY_ENV = [
  'EASYPAISA_USERNAME',
  'EASYPAISA_PASSWORD',
  'EASYPAISA_ACCOUNT_NUMBER',
]

function getConfig() {
  const environment = env.EASYPAISA_ENVIRONMENT
  const baseUrl = HOSTS[environment]

  return {
    environment,
    baseUrl,
    storeId: env.EASYPAISA_STORE_ID.trim(),
    hashKey: env.EASYPAISA_HASH_KEY,
    username: env.EASYPAISA_USERNAME.trim(),
    password: env.EASYPAISA_PASSWORD,
    accountNumber: env.EASYPAISA_ACCOUNT_NUMBER.trim(),
    paymentMethod: env.EASYPAISA_PAYMENT_METHOD,
  }
}

export function isConfigured() {
  const config = getConfig()
  return Boolean(config.storeId && config.hashKey)
}

/** True when the inquiry API can be used to verify a payment. */
export function isInquiryConfigured() {
  const config = getConfig()
  return Boolean(config.username && config.password && config.accountNumber)
}

function assertConfigured() {
  if (isConfigured()) return getConfig()

  const missing = REQUIRED_ENV.filter((name) => !env[name])
  throw new ApiError(
    503,
    'GATEWAY_NOT_CONFIGURED',
    'Easypaisa is not configured on this server. Add the store credentials to ' +
      `server/.env (${missing.join(', ') || 'EASYPAISA_*'}) and restart the server.`,
  )
}

/**
 * Amount format used by Easypay: a decimal point is always present.
 * 465000 paisa -> "4650.0", 9950 paisa -> "99.50".
 */
export function formatAmount(amountPaisa) {
  if (!Number.isInteger(amountPaisa) || amountPaisa <= 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'The payment amount is invalid.')
  }

  const fixed = (amountPaisa / 100).toFixed(2)
  return fixed.endsWith('.00') ? fixed.slice(0, -1) : fixed
}

/**
 * Build the `merchantHashedReq` value.
 *
 *   "amount=10.0&autoRedirect=1&...&storeId=123"
 *   → AES-128/192/256-ECB, PKCS#5 padding, base64
 *
 * The key must be the 16, 24 or 32 character hash key from the Easypay
 * merchant portal.
 *
 * @param {Record<string, string>} fields
 * @param {string} hashKey
 * @returns {string}
 */
export function buildHashedRequest(fields, hashKey) {
  const key = Buffer.from(String(hashKey ?? ''), 'utf8')

  if (![16, 24, 32].includes(key.length)) {
    throw new ApiError(
      503,
      'GATEWAY_NOT_CONFIGURED',
      'The Easypaisa hash key must be 16, 24 or 32 characters long. ' +
        'Copy it exactly from the Easypay merchant portal into server/.env.',
    )
  }

  const message = HASH_FIELDS.filter(
    (name) => fields[name] !== undefined && fields[name] !== null && String(fields[name]) !== '',
  )
    .map((name) => `${name}=${fields[name]}`)
    .join('&')

  const cipher = crypto.createCipheriv(`aes-${key.length * 8}-ecb`, key, null)
  return Buffer.concat([cipher.update(message, 'utf8'), cipher.final()]).toString('base64')
}

/**
 * Start a hosted-checkout payment.
 *
 * @param {{
 *   amount: number,
 *   currency: string,
 *   order: { orderNumber: string },
 *   customer: { name?: string, email?: string, mobile?: string },
 *   transactionReference: string,
 *   gatewayTxnRef: string
 * }} input
 */
export async function createPayment({ amount, currency, customer, gatewayTxnRef }) {
  const config = assertConfigured()

  if (currency !== 'PKR') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Easypaisa only accepts PKR payments.')
  }

  if (!/^[A-Za-z0-9_-]{1,50}$/.test(String(gatewayTxnRef || ''))) {
    throw new ApiError(500, 'INTERNAL_SERVER_ERROR', 'Could not build a valid Easypaisa order reference.')
  }

  const mobile = String(customer?.mobile ?? '')
  const now = new Date()

  const fields = {
    storeId: config.storeId,
    amount: formatAmount(amount),
    /** The gateway returns the browser here first (with auth_token). */
    postBackURL: `${env.PUBLIC_BASE_URL}/api/payments/easypaisa/return?tx=${encodeURIComponent(gatewayTxnRef)}`,
    orderRefNum: gatewayTxnRef,
    expiryDate: formatPktExpiry(addHours(now, 24)),
    autoRedirect: '1',
    paymentMethod: config.paymentMethod,
    emailAddr: String(customer?.email ?? ''),
    mobileNum: /^03\d{9}$/.test(mobile) ? mobile : '',
  }

  fields.merchantHashedReq = buildHashedRequest(fields, config.hashKey)

  // Empty optional fields are not posted (they are also not part of the hash).
  const postedFields = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== ''),
  )

  return {
    status: TRANSACTION_STATUS.PENDING,
    gatewayTxnRef,
    gatewayReference: null,
    failureReason: null,
    message: 'Redirecting to Easypaisa.',
    redirect: {
      url: `${config.baseUrl}${PATHS.checkout}`,
      method: 'POST',
      fields: postedFields,
    },
  }
}

/**
 * Step 2 of the flow: the page that posts the auth token to the confirmation
 * page. Easypaisa then redirects to our callback.
 *
 * @param {string} authToken
 * @param {string} gatewayTxnRef
 */
export function buildConfirmationRedirect(authToken, gatewayTxnRef) {
  const config = assertConfigured()
  const reference = String(gatewayTxnRef || '').trim()

  const callbackUrl =
    `${env.PUBLIC_BASE_URL}/api/payments/easypaisa/callback` +
    (reference ? `?tx=${encodeURIComponent(reference)}` : '')

  return {
    url: `${config.baseUrl}${PATHS.confirm}`,
    method: 'POST',
    fields: {
      auth_token: authToken,
      postBackURL: callbackUrl,
    },
  }
}

/**
 * Decide whether an unsigned SUCCESS may be accepted.
 *
 * Exported so the security rule can be tested without a live environment.
 * A successful redirect is only trusted when the inquiry API verified it, or
 * when the operator explicitly enabled `EASYPAISA_TRUST_REDIRECT`.
 *
 * @param {{status: string, verified: boolean, trustRedirect: boolean}} input
 */
export function resolveCallbackStatus({ status, verified, trustRedirect }) {
  if (status === TRANSACTION_STATUS.SUCCESS && !verified && !trustRedirect) {
    return { status: TRANSACTION_STATUS.PENDING, forcedPending: true }
  }

  return { status, forcedPending: false }
}

/**
 * Read the final redirect from Easypaisa.
 *
 * The redirect parameters are **not signed**, so they are only a hint. When
 * the inquiry API is configured the real state is fetched from Easypaisa and
 * that answer wins.
 *
 * @param {Record<string, string>} query
 */
export async function verifyCallback(query) {
  assertConfigured()

  const orderRef = String(query?.orderRefNumber ?? query?.orderRefNum ?? query?.tx ?? '').trim()
  const statusCode = String(query?.status ?? query?.desc ?? '').trim()
  const description = String(query?.desc ?? query?.status ?? '').trim()

  if (!orderRef) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'The Easypaisa callback has no order reference.')
  }

  let status = TRANSACTION_STATUS.FAILED
  if (statusCode === '0000') status = TRANSACTION_STATUS.SUCCESS
  else if (PENDING_STATUS_CODES.has(statusCode)) status = TRANSACTION_STATUS.PENDING

  let verified = false
  let gatewayReference = null
  let amountPaisa = null
  let message = description

  if (isInquiryConfigured()) {
    try {
      const inquiry = await getStatus(orderRef)
      status = inquiry.status
      gatewayReference = inquiry.gatewayReference
      amountPaisa = inquiry.amountPaisa
      message = inquiry.message || description
      verified = inquiry.verified
    } catch (error) {
      logger.warn(
        { orderRef, err: error.message },
        'easypaisa inquiry failed — falling back to the unsigned redirect parameters',
      )
    }
  }

  const resolved = resolveCallbackStatus({
    status,
    verified,
    trustRedirect: env.EASYPAISA_TRUST_REDIRECT,
  })

  /**
   * Without the inquiry API the only source is an unsigned redirect. By
   * default a SUCCESS claim is therefore *not* trusted: the transaction stays
   * pending until a server-side verification happens. `EASYPAISA_TRUST_REDIRECT`
   * is the explicit opt-in for merchants that only have the hosted checkout.
   */
  if (resolved.forcedPending) {
    logger.warn(
      { orderRef },
      'easypaisa reported success but no verification is configured — keeping the transaction pending',
    )

    return {
      status: TRANSACTION_STATUS.PENDING,
      gatewayTxnRef: orderRef,
      gatewayReference,
      failureReason: null,
      message: 'Payment reported as successful; waiting for server-side verification.',
      amountPaisa,
      verified: false,
    }
  }

  status = resolved.status

  const finalFailure =
    status === TRANSACTION_STATUS.FAILED || status === TRANSACTION_STATUS.CANCELLED

  return {
    status,
    gatewayTxnRef: orderRef,
    gatewayReference,
    failureReason: finalFailure
      ? description || 'Easypaisa did not complete the payment.'
      : null,
    message:
      message ||
      (status === TRANSACTION_STATUS.SUCCESS
        ? 'Payment successful.'
        : status === TRANSACTION_STATUS.PENDING
          ? 'Payment pending.'
          : 'Payment failed.'),
    amountPaisa,
    verified,
  }
}

/**
 * Ask Easypaisa for the real state of an order.
 *
 * @param {string} orderRefNum
 */
export async function getStatus(orderRefNum) {
  const config = assertConfigured()

  if (!config.username || !config.password || !config.accountNumber) {
    const missing = INQUIRY_ENV.filter((name) => !env[name])
    throw new ApiError(
      503,
      'GATEWAY_NOT_CONFIGURED',
      `The Easypaisa inquiry API needs ${missing.join(', ')} in server/.env.`,
    )
  }

  let payload
  try {
    const response = await fetch(`${config.baseUrl}${PATHS.inquiry}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Credentials: Buffer.from(`${config.username}:${config.password}`).toString('base64'),
      },
      body: JSON.stringify({
        orderId: orderRefNum,
        storeId: config.storeId,
        accountNum: config.accountNumber,
      }),
      signal: AbortSignal.timeout(20_000),
    })

    const text = await response.text()
    payload = text ? JSON.parse(text) : {}
  } catch (error) {
    throw new ApiError(
      502,
      'GATEWAY_UNAVAILABLE',
      `The Easypaisa status inquiry failed: ${error.message}`,
    )
  }

  const responseCode = String(payload?.responseCode ?? payload?.response_code ?? '')
  const state = String(
    payload?.transactionStatus ?? payload?.transaction_status ?? payload?.paid_status ?? '',
  ).toUpperCase()

  let status = TRANSACTION_STATUS.PENDING
  if (responseCode && responseCode !== '0000') {
    status = TRANSACTION_STATUS.PENDING
  } else if (state === 'PAID') {
    status = TRANSACTION_STATUS.SUCCESS
  } else if (['FAILED', 'BLOCKED', 'EXPIRED', 'REVERSED'].includes(state)) {
    status = TRANSACTION_STATUS.FAILED
  }

  const amount = Number(payload?.transactionAmount ?? payload?.transaction_amount)

  return {
    status,
    gatewayTxnRef: orderRefNum,
    gatewayReference: payload?.transactionId ?? payload?.transaction_id ?? null,
    failureReason:
      status === TRANSACTION_STATUS.FAILED
        ? payload?.responseDesc || payload?.description || 'Payment failed.'
        : null,
    message: payload?.responseDesc || payload?.description || state,
    amountPaisa: Number.isFinite(amount) ? Math.round(amount * 100) : null,
    verified: true,
  }
}

/**
 * Describe the provider for the health endpoint. Never includes secrets.
 */
export function describe() {
  return {
    name: GATEWAY.EASYPAISA,
    displayName: 'Easypaisa',
    implemented: true,
    configured: isConfigured(),
    inquiryConfigured: isInquiryConfigured(),
    simulated: false,
    environment: env.EASYPAISA_ENVIRONMENT,
    supports: [GATEWAY.EASYPAISA],
    supportedOutcomes: [TRANSACTION_STATUS.PENDING, TRANSACTION_STATUS.SUCCESS, TRANSACTION_STATUS.FAILED],
    flow: 'HOSTED_CHECKOUT',
    requiredEnv: REQUIRED_ENV,
    note: isConfigured()
      ? 'Hashed hosted checkout (AES/ECB). Credentials are read from the server environment.'
      : 'Credentials missing — payments with Easypaisa are refused with GATEWAY_NOT_CONFIGURED.',
  }
}

export default {
  createPayment,
  buildConfirmationRedirect,
  verifyCallback,
  resolveCallbackStatus,
  getStatus,
  describe,
  isConfigured,
  isInquiryConfigured,
  buildHashedRequest,
  formatAmount,
}
