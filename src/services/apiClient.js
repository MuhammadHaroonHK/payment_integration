import axios from 'axios'
import { PAYMENT_CONFIG } from '../config/paymentConfig'

/**
 * Central axios client.
 *
 * This is the single place where the app talks to a server. When the project
 * is running in mock mode nothing here is used at all — the mock service
 * handles the calls instead. When a backend exists, point
 * `VITE_API_BASE_URL` at it and set `VITE_PAYMENT_MODE=backend`.
 *
 * The client never sends merchant credentials. Authentication (if it is ever
 * needed) must be handled server side.
 */
const apiClient = axios.create({
  baseURL: PAYMENT_CONFIG.apiBaseUrl,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  // A request id makes it possible to match a frontend call with a backend log.
  config.headers['X-Request-Id'] = `paylab-${Date.now().toString(36)}`
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(normaliseApiError(error)),
)

/**
 * Turn any axios / network failure into a predictable shape the UI can use.
 *
 * @param {any} error
 * @returns {{message: string, status: number|null, code: string, details: any}}
 */
export function normaliseApiError(error) {
  const status = error?.response?.status ?? null
  const body = error?.response?.data

  // The backend answers with { success: false, error: { code, message, details } }.
  const data = body?.error ? { ...body.error, ...body } : body

  let message = 'Something went wrong while contacting the payment service.'
  let code = 'UNKNOWN_ERROR'
  let details = null

  if (error?.code === 'ECONNABORTED') {
    message = 'The payment service took too long to respond. Please try again.'
    code = 'TIMEOUT'
  } else if (error?.message === 'Network Error') {
    message = 'Could not reach the payment service. Check your connection.'
    code = 'NETWORK_ERROR'
  } else if (status === 400) {
    message = data?.message || 'The request was rejected by the payment service.'
    code = data?.code || 'BAD_REQUEST'
    details = data?.details || null
  } else if (status === 401 || status === 403) {
    message = data?.message || 'The payment service rejected the request as unauthorised.'
    code = data?.code || 'UNAUTHORIZED'
  } else if (status === 404) {
    message = data?.message || 'The requested payment record was not found.'
    code = data?.code || 'NOT_FOUND'
  } else if (status === 409) {
    message = data?.message || 'This request conflicts with an existing record.'
    code = data?.code || 'CONFLICT'
  } else if (status === 429) {
    message = data?.message || 'Too many requests. Please wait a moment and try again.'
    code = data?.code || 'RATE_LIMIT_EXCEEDED'
  } else if (status >= 500) {
    message =
      data?.message ||
      'The payment service is currently unavailable. Please try again.'
    code = data?.code || 'SERVER_ERROR'
  } else if (typeof data?.message === 'string') {
    message = data.message
    code = data?.code || 'API_ERROR'
    details = data?.details || null
  }

  return { message, status, code, details }
}

/**
 * Convenience wrapper around axios calls so pages never touch axios directly.
 */
export async function request(config) {
  const response = await apiClient.request(config)
  return response.data
}

export default apiClient
