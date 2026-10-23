/**
 * Central configuration for PayLab.
 *
 * Everything the application needs to switch between "simulated" mode and a
 * real backend lives in this one file. Nothing else in the codebase reads
 * `import.meta.env` directly, so changing mode is a single edit here (or a
 * single `.env` value).
 *
 * SECURITY NOTE:
 * Every variable prefixed with `VITE_` is bundled into the browser code and
 * is therefore PUBLIC. Never put merchant credentials, signing keys, API
 * secrets, PINs or OTPs in here. Those must live on the backend only.
 */

const env = import.meta.env || {}

const rawMode = String(env.VITE_PAYMENT_MODE || 'mock').trim().toLowerCase()

/** 'mock' (default) or 'backend' */
export const PAYMENT_MODE = rawMode === 'backend' ? 'backend' : 'mock'

/** Base URL of the future Node.js / Express API. */
export const API_BASE_URL = env.VITE_API_BASE_URL || 'http://localhost:5000/api'

export const PAYMENT_CONFIG = {
  /** Which payment implementation is active. */
  mode: PAYMENT_MODE,
  /** True while the app is running against the local simulator. */
  isMock: PAYMENT_MODE === 'mock',

  /** Base URL used by the axios client. */
  apiBaseUrl: API_BASE_URL,

  /** Currency used for every demo amount. */
  currency: 'PKR',
  locale: 'en-PK',

  /** How long the simulated gateway call takes, in milliseconds. */
  simulateDelayMs: 1800,

  /** localStorage keys. These hold demo data only. */
  storageKeys: {
    transactions: 'paylab.demo.transactions.v1',
    checkout: 'paylab.checkout.session.v1',
    lastTransaction: 'paylab.demo.lastTransaction.v1',
  },
}

/**
 * Small helper so feature code can branch without importing the whole object.
 */
export function isMockMode() {
  return PAYMENT_CONFIG.isMock
}

export default PAYMENT_CONFIG
