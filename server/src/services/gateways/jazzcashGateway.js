import crypto from 'node:crypto'
import { env } from '../../config/env.js'
import { ApiError } from '../../utils/ApiError.js'
import { GATEWAY, TRANSACTION_STATUS } from '../../models/Transaction.js'
import { formatPktDateTime, addHours } from '../../utils/pkTime.js'

/**
 * jazzcashGateway
 *
 * Real JazzCash integration using the **hosted checkout** flow:
 *
 *   1. the server signs a payment request and returns the form fields,
 *   2. the browser POSTs them to JazzCash and the customer pays there,
 *   3. JazzCash POSTs the result back to our return URL,
 *   4. the server verifies the HMAC-SHA256 signature before the transaction is
 *      allowed to become SUCCESS.
 *
 * Nothing here is simulated. The merchant ID, password and integrity salt come
 * from `server/.env`. The integrity salt — which signs every request — is used
 * only on the server and never leaves it. JazzCash's hosted form does carry the
 * merchant password (`pp_Password`) because that is part of JazzCash's protocol;
 * the browser posts it to JazzCash and PayLab does not store it.
 *
 * Docs: https://sandbox.jazzcash.com.pk (merchant portal → integration guide)
 */

const HOSTS = {
  sandbox: 'https://sandbox.jazzcash.com.pk',
  production: 'https://payments.jazzcash.com.pk',
}

const PATHS = {
  /** Hosted checkout page that the customer's browser POSTs to. */
  checkout: '/CustomerPortal/transactionmanagement/merchantform/',
  /** Server-to-server status inquiry. */
  inquiry: '/ApplicationAPI/API/PaymentInquiry/Inquire',
}

/** Response codes that mean the payment is not finished yet. */
const PENDING_RESPONSE_CODES = new Set(['124', '157'])

/** Required environment variable names (values are never exposed). */
export const REQUIRED_ENV = [
  'JAZZCASH_MERCHANT_ID',
  'JAZZCASH_PASSWORD',
  'JAZZCASH_INTEGRITY_SALT',
]

function getConfig() {
  const environment = env.JAZZCASH_ENVIRONMENT
  const baseUrl = HOSTS[environment]

  return {
    environment,
    baseUrl,
    merchantId: env.JAZZCASH_MERCHANT_ID.trim(),
    password: env.JAZZCASH_PASSWORD,
    integritySalt: env.JAZZCASH_INTEGRITY_SALT,
    txnType: env.JAZZCASH_TXN_TYPE,
    returnUrl:
      env.JAZZCASH_RETURN_URL ||
      `${env.PUBLIC_BASE_URL}/api/payments/jazzcash/return`,
  }
}

/**
 * Whether this adapter has everything it needs to start a payment.
 */
export function isConfigured() {
  const config = getConfig()
  return Boolean(config.merchantId && config.password && config.integritySalt)
}

function assertConfigured() {
  if (isConfigured()) return getConfig()

  const missing = REQUIRED_ENV.filter((name) => !env[name])
  throw new ApiError(
    503,
    'GATEWAY_NOT_CONFIGURED',
    'JazzCash is not configured on this server. Add the merchant credentials to ' +
      `server/.env (${missing.join(', ') || 'JAZZCASH_*'}) and restart the server.`,
  )
}

/**
 * JazzCash rejects any character outside ISO-8859-1, because that is what its
 * hash covers. Rejecting it here produces a clear error instead of a hash
 * mismatch at the gateway.
 */
function assertLatin1(field, value) {
  const text = String(value ?? '')
  if ([...text].some((character) => character.charCodeAt(0) > 0xff)) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      `The ${field} contains characters JazzCash cannot sign. Use English text only.`,
    )
  }
  return text
}

/**
 * The JazzCash secure hash.
 *
 *   1. take every field whose name starts with "pp" (pp_* and ppmpf_*),
 *      except pp_SecureHash,
 *   2. drop empty values,
 *   3. sort by field name,
 *   4. put the integrity salt in front and join everything with "&",
 *   5. HMAC-SHA256 with the salt as key, ISO-8859-1 encoded,
 *   6. upper-case hex.
 *
 * @param {Record<string, string>} fields
 * @param {string} integritySalt
 * @returns {string}
 */
export function buildSecureHash(fields, integritySalt) {
  const salt = String(integritySalt ?? '').trim()
  if (!salt) {
    throw new ApiError(503, 'GATEWAY_NOT_CONFIGURED', 'The JazzCash integrity salt is missing.')
  }

  const values = Object.keys(fields)
    .filter((key) => key.toLowerCase().startsWith('pp') && key !== 'pp_SecureHash')
    .filter((key) => fields[key] !== undefined && fields[key] !== null && String(fields[key]) !== '')
    .sort()
    .map((key) => assertLatin1(key, fields[key]))

  const message = [salt, ...values].join('&')
  assertLatin1('payment description', message)

  return crypto
    .createHmac('sha256', Buffer.from(salt, 'latin1'))
    .update(message, 'latin1')
    .digest('hex')
    .toUpperCase()
}

/** Constant-time comparison of two hex digests. */
function hashesMatch(received, computed) {
  const a = Buffer.from(String(received || ''), 'utf8')
  const b = Buffer.from(String(computed || ''), 'utf8')

  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

/**
 * Verify a signed payload (a callback or an inquiry response).
 *
 * @param {Record<string, string>} fields
 * @param {string} integritySalt
 * @returns {boolean}
 */
export function verifySecureHash(fields, integritySalt) {
  const received = fields?.pp_SecureHash
  if (!received) return false

  return hashesMatch(String(received).toUpperCase(), buildSecureHash(fields, integritySalt))
}

/** JazzCash only accepts letters and digits, at most 20 characters. */
function billReference(value, fallback) {
  const cleaned = String(value ?? '')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 20)

  return cleaned || fallback
}

/**
 * Start a hosted-checkout payment.
 *
 * @param {{
 *   amount: number,
 *   currency: string,
 *   order: { orderNumber: string, id?: string },
 *   customer: object,
 *   transactionReference: string,
 *   gatewayTxnRef: string
 * }} input
 */
export async function createPayment({
  amount,
  currency,
  order,
  transactionReference,
  gatewayTxnRef,
}) {
  const config = assertConfigured()

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'The payment amount is invalid.')
  }

  if (currency !== 'PKR') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'JazzCash only accepts PKR payments.')
  }

  if (!/^[A-Za-z0-9]{1,20}$/.test(String(gatewayTxnRef || ''))) {
    throw new ApiError(500, 'INTERNAL_SERVER_ERROR', 'Could not build a valid JazzCash transaction reference.')
  }

  const now = new Date()

  const fields = {
    pp_Version: '1.1',
    pp_TxnType: config.txnType,
    pp_Language: 'EN',
    pp_MerchantID: config.merchantId,
    pp_SubMerchantID: '',
    pp_Password: config.password,
    pp_BankID: '',
    pp_ProductID: '',
    pp_TxnRefNo: gatewayTxnRef,
    /** JazzCash expects paisa, not rupees. */
    pp_Amount: String(amount),
    pp_TxnCurrency: 'PKR',
    pp_TxnDateTime: formatPktDateTime(now),
    pp_BillReference: billReference(order?.orderNumber, gatewayTxnRef),
    pp_Description: assertLatin1(
      'payment description',
      `PayLab order ${order?.orderNumber ?? gatewayTxnRef}`.slice(0, 100),
    ),
    pp_TxnExpiryDateTime: formatPktDateTime(addHours(now, 24)),
    pp_ReturnURL: config.returnUrl,
    /** Values that come back unchanged, used for reconciliation. */
    ppmpf_1: transactionReference,
    ppmpf_2: order?.orderNumber ?? '',
    ppmpf_3: '',
    ppmpf_4: '',
    ppmpf_5: '',
  }

  fields.pp_SecureHash = buildSecureHash(fields, config.integritySalt)

  return {
    status: TRANSACTION_STATUS.PENDING,
    gatewayTxnRef,
    gatewayReference: null,
    failureReason: null,
    message: 'Redirecting to JazzCash.',
    redirect: {
      url: `${config.baseUrl}${PATHS.checkout}`,
      method: 'POST',
      fields,
    },
  }
}

/**
 * Turn the POST JazzCash sends to pp_ReturnURL into a transaction outcome.
 *
 * Throws INVALID_SIGNATURE when the payload was not signed by JazzCash (or was
 * changed in transit), so a forged callback can never mark an order paid.
 *
 * @param {Record<string, string>} fields
 */
export async function verifyCallback(fields) {
  const config = assertConfigured()

  if (!fields || typeof fields !== 'object') {
    throw new ApiError(400, 'INVALID_SIGNATURE', 'The JazzCash callback is empty.')
  }

  if (!verifySecureHash(fields, config.integritySalt)) {
    throw new ApiError(
      400,
      'INVALID_SIGNATURE',
      'The JazzCash callback signature is invalid. The payment was not accepted.',
    )
  }

  const code = String(fields.pp_ResponseCode ?? '')
  const responseMessage = String(fields.pp_ResponseMessage ?? '')

  let status = TRANSACTION_STATUS.FAILED
  if (code === '000') status = TRANSACTION_STATUS.SUCCESS
  else if (PENDING_RESPONSE_CODES.has(code)) status = TRANSACTION_STATUS.PENDING

  const amountPaisa = Number(fields.pp_Amount)

  return {
    status,
    gatewayTxnRef: String(fields.pp_TxnRefNo ?? ''),
    gatewayReference: String(fields.pp_RetreivalReferenceNo ?? fields.pp_TxnRefNo ?? '') || null,
    failureReason:
      status === TRANSACTION_STATUS.FAILED
        ? responseMessage || `JazzCash declined the payment (code ${code || 'unknown'}).`
        : null,
    message:
      responseMessage ||
      (status === TRANSACTION_STATUS.SUCCESS
        ? 'Payment successful.'
        : status === TRANSACTION_STATUS.PENDING
          ? 'Payment pending.'
          : 'Payment failed.'),
    amountPaisa: Number.isFinite(amountPaisa) ? amountPaisa : null,
    verified: true,
  }
}

/**
 * Server-to-server inquiry, used for pending payments and reconciliation.
 *
 * @param {string} gatewayTxnRef the pp_TxnRefNo sent with the payment
 */
export async function getStatus(gatewayTxnRef) {
  const config = assertConfigured()

  const fields = {
    pp_TxnRefNo: gatewayTxnRef,
    pp_MerchantID: config.merchantId,
    pp_Password: config.password,
  }
  fields.pp_SecureHash = buildSecureHash(fields, config.integritySalt)

  let payload
  try {
    const response = await fetch(`${config.baseUrl}${PATHS.inquiry}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams(fields).toString(),
      signal: AbortSignal.timeout(20_000),
    })

    const text = await response.text()
    payload = text ? JSON.parse(text) : {}
  } catch (error) {
    throw new ApiError(
      502,
      'GATEWAY_UNAVAILABLE',
      `The JazzCash status inquiry failed: ${error.message}`,
    )
  }

  if (payload?.pp_SecureHash && !verifySecureHash(payload, config.integritySalt)) {
    throw new ApiError(502, 'GATEWAY_ERROR', 'The JazzCash inquiry response failed signature verification.')
  }

  const inquiryCode = String(payload?.pp_ResponseCode ?? '')
  const paymentCode = String(payload?.pp_PaymentResponseCode ?? '')

  let status = TRANSACTION_STATUS.PENDING
  if (inquiryCode === '000') {
    if (paymentCode === '121' || /^completed$/i.test(payload?.pp_Status ?? '')) {
      status = TRANSACTION_STATUS.SUCCESS
    } else if (PENDING_RESPONSE_CODES.has(paymentCode) || /pending/i.test(payload?.pp_Status ?? '')) {
      status = TRANSACTION_STATUS.PENDING
    } else if (paymentCode === '999' || !paymentCode) {
      // No final result yet (or no transaction with this reference).
      status = TRANSACTION_STATUS.PENDING
    } else {
      status = TRANSACTION_STATUS.FAILED
    }
  }

  const amountPaisa = Number(payload?.pp_Amount)

  return {
    status,
    gatewayTxnRef,
    gatewayReference: payload?.pp_RetreivalReferenceNo ?? null,
    failureReason:
      status === TRANSACTION_STATUS.FAILED
        ? payload?.pp_PaymentResponseMessage || payload?.pp_ResponseMessage || 'Payment failed.'
        : null,
    message: payload?.pp_PaymentResponseMessage || payload?.pp_ResponseMessage || '',
    amountPaisa: Number.isFinite(amountPaisa) ? amountPaisa : null,
    verified: true,
  }
}

/**
 * Describe the provider for the health endpoint. Never includes secrets.
 */
export function describe() {
  return {
    name: GATEWAY.JAZZCASH,
    displayName: 'JazzCash',
    implemented: true,
    configured: isConfigured(),
    simulated: false,
    environment: env.JAZZCASH_ENVIRONMENT,
    supports: [GATEWAY.JAZZCASH],
    supportedOutcomes: [TRANSACTION_STATUS.PENDING, TRANSACTION_STATUS.SUCCESS, TRANSACTION_STATUS.FAILED],
    flow: 'HOSTED_CHECKOUT',
    requiredEnv: REQUIRED_ENV,
    note: isConfigured()
      ? 'Signed hosted checkout. Credentials are read from the server environment.'
      : 'Credentials missing — payments with JazzCash are refused with GATEWAY_NOT_CONFIGURED.',
  }
}

export default {
  createPayment,
  verifyCallback,
  getStatus,
  describe,
  isConfigured,
  buildSecureHash,
  verifySecureHash,
}
