import 'dotenv/config'
import { z } from 'zod'

/**
 * Environment configuration.
 *
 * The whole server reads its configuration from this module — nothing else
 * touches `process.env` directly. Every value is validated here so a missing
 * or invalid setting fails loudly at startup instead of halfway through a
 * payment.
 *
 * ⚠️ The gateway credentials below are secrets. They must only ever live in
 * `server/.env` (or the environment of the hosting platform) — never in the
 * frontend `.env`, because every `VITE_` variable is inlined into the browser
 * bundle.
 */

/**
 * Accepts the usual ways of writing a boolean in a .env file:
 * "true", "1", "yes", "on" -> true
 * "false", "0", "no", "off" -> false
 */
const booleanFromEnv = z
  .union([z.boolean(), z.string()])
  .transform((value, ctx) => {
    if (typeof value === 'boolean') return value

    const normalised = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'on'].includes(normalised)) return true
    if (['false', '0', 'no', 'off'].includes(normalised)) return false

    ctx.addIssue({
      code: 'custom',
      message: `Expected a boolean value (true/false) but received "${value}".`,
    })
    return z.NEVER
  })

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  CLIENT_URL: z.string().trim().min(1).default('http://localhost:5173'),
  /**
   * Public origin of THIS API, as seen by the payment gateway.
   *
   * The gateway redirects the customer's browser to a return URL on this
   * origin, so for local development it can be http://localhost:5000. If the
   * gateway's merchant portal insists on a publicly reachable URL, use an
   * HTTPS tunnel (for example `ngrok http 5000`) and put that URL here.
   */
  PUBLIC_BASE_URL: z.string().trim().default(''),
  MONGODB_URI: z.string().trim().min(1).default('mongodb://127.0.0.1:27017/paylab'),

  /**
   * "mock" — the local simulator, no provider is contacted.
   * "live" — the real hosted-checkout adapters are used.
   */
  PAYMENT_MODE: z.enum(['mock', 'live']).default('mock'),

  /**
   * Development-only controls that force a transaction outcome.
   * They are always ignored in production and whenever PAYMENT_MODE is not
   * "mock" — see the safety rules below.
   */
  ENABLE_TEST_CONTROLS: booleanFromEnv.default(true),
  MOCK_GATEWAY_DELAY_MS: z.coerce.number().int().min(0).max(10_000).default(600),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1_000).default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(20),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  /* ------------------------------ JazzCash ------------------------------ */
  /**
   * Sandbox by default. Both gateways have their own switch, so one can be
   * tested in sandbox while the other is live.
   */
  JAZZCASH_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
  /** Merchant ID issued by JazzCash. */
  JAZZCASH_MERCHANT_ID: z.string().trim().default(''),
  /** Merchant password issued by JazzCash (server side only). */
  JAZZCASH_PASSWORD: z.string().default(''),
  /** Integrity salt issued by JazzCash (server side only). */
  JAZZCASH_INTEGRITY_SALT: z.string().default(''),
  /**
   * Optional: limit the hosted page to one payment method.
   * "" lets the customer choose. Allowed: "" | MWALLET | MPAY | OTC
   */
  JAZZCASH_TXN_TYPE: z.enum(['', 'MWALLET', 'MPAY', 'OTC']).default(''),
  /** Optional override of the return URL registered with JazzCash. */
  JAZZCASH_RETURN_URL: z.string().trim().default(''),

  /* ------------------------------ Easypaisa ----------------------------- */
  EASYPAISA_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
  /** Store / merchant account id issued by Easypaisa. */
  EASYPAISA_STORE_ID: z.string().trim().default(''),
  /** Portal hash key used by the hosted checkout (16, 24 or 32 chars). */
  EASYPAISA_HASH_KEY: z.string().default(''),
  /** REST API credentials, used to verify a payment with the inquiry call. */
  EASYPAISA_USERNAME: z.string().trim().default(''),
  EASYPAISA_PASSWORD: z.string().default(''),
  /** Merchant account number, required by the inquiry call. */
  EASYPAISA_ACCOUNT_NUMBER: z.string().trim().default(''),
  /** Optional: "" lets the customer choose; MA_PAYMENT_METHOD | OTC_PAYMENT_METHOD | CC_PAYMENT_METHOD */
  EASYPAISA_PAYMENT_METHOD: z.string().trim().default(''),
  /** Optional override of the return URL registered with Easypaisa. */
  EASYPAISA_RETURN_URL: z.string().trim().default(''),
  /**
   * Accept a SUCCESS result from Easypaisa's unsigned return redirect when the
   * inquiry API is not configured.
   *
   *   false (default) — a SUCCESS result stays PENDING until it is verified.
   *   true            — the redirect is trusted, and the record is stored with
   *                     `gatewayVerified: false` so the UI can label it.
   *
   * Only turn this on when the merchant account has no REST API credentials
   * and the redirect flow is the only available confirmation.
   */
  EASYPAISA_TRUST_REDIRECT: booleanFromEnv.default(false),
})

/**
 * Parse the environment and apply the extra safety rules that a schema alone
 * cannot express.
 *
 * @param {NodeJS.ProcessEnv} source
 * @returns {typeof envSchema.parse extends (...a:any)=>infer R ? R : never}
 */
function loadEnv(source = process.env) {
  const parsed = envSchema.safeParse(source)

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n')

    throw new Error(
      `Invalid environment configuration:\n${details}\n\n` +
        'Copy server/.env.example to server/.env and fill in the missing values.',
    )
  }

  const env = parsed.data

  // Validate every URL setting, so a typo fails at startup.
  const urls = {
    CLIENT_URL: env.CLIENT_URL,
    PUBLIC_BASE_URL: env.PUBLIC_BASE_URL || `http://localhost:${env.PORT}`,
    JAZZCASH_RETURN_URL: env.JAZZCASH_RETURN_URL,
    EASYPAISA_RETURN_URL: env.EASYPAISA_RETURN_URL,
  }

  for (const [name, value] of Object.entries(urls)) {
    if (!value) continue

    try {
      new URL(value)
    } catch {
      throw new Error(`Invalid environment configuration:\n  - ${name}: "${value}" is not a valid URL.`)
    }
  }

  // ── Safety rule 1 ────────────────────────────────────────────────────────
  // The test controls force a transaction outcome. They must never be
  // reachable in production, whatever the .env file says.
  const testControlsRequested = env.ENABLE_TEST_CONTROLS
  let enableTestControls = testControlsRequested

  if (testControlsRequested && env.NODE_ENV === 'production') {
    enableTestControls = false
    console.warn(
      '[config] ENABLE_TEST_CONTROLS was ignored because NODE_ENV is "production".',
    )
  }

  if (enableTestControls && env.PAYMENT_MODE !== 'mock') {
    enableTestControls = false
    console.warn('[config] ENABLE_TEST_CONTROLS was ignored because PAYMENT_MODE is not "mock".')
  }

  // ── Safety rule 2 ────────────────────────────────────────────────────────
  // In live mode a gateway without credentials cannot work. The server still
  // starts (so the mock/other gateway and the rest of the app remain usable),
  // but it says loudly which configuration is missing. A payment request for
  // that gateway is refused with GATEWAY_NOT_CONFIGURED.
  if (env.PAYMENT_MODE === 'live') {
    const missingJazzCash = [
      ['JAZZCASH_MERCHANT_ID', env.JAZZCASH_MERCHANT_ID],
      ['JAZZCASH_PASSWORD', env.JAZZCASH_PASSWORD],
      ['JAZZCASH_INTEGRITY_SALT', env.JAZZCASH_INTEGRITY_SALT],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name)

    const missingEasypaisa = [
      ['EASYPAISA_STORE_ID', env.EASYPAISA_STORE_ID],
      ['EASYPAISA_HASH_KEY', env.EASYPAISA_HASH_KEY],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name)

    if (missingJazzCash.length) {
      console.warn(
        `[config] JazzCash is not configured (${missingJazzCash.join(', ')}). ` +
          'Payments with JAZZCASH will be refused with GATEWAY_NOT_CONFIGURED.',
      )
    }

    if (missingEasypaisa.length) {
      console.warn(
        `[config] Easypaisa is not configured (${missingEasypaisa.join(', ')}). ` +
          'Payments with EASYPAISA will be refused with GATEWAY_NOT_CONFIGURED.',
      )
    } else {
      const inquiryConfigured =
        env.EASYPAISA_USERNAME && env.EASYPAISA_PASSWORD && env.EASYPAISA_ACCOUNT_NUMBER

      if (!inquiryConfigured) {
        console.warn(
          '[config] Easypaisa inquiry credentials are not set. ' +
            (env.EASYPAISA_TRUST_REDIRECT
              ? 'Results will be accepted from the unsigned return redirect and stored with gatewayVerified=false.'
              : 'A SUCCESS return will stay PENDING until a server-side verification is available.'),
        )
      }
    }
  }

  return {
    ...env,
    /** Public origin of the API, without a trailing slash. */
    PUBLIC_BASE_URL: urls.PUBLIC_BASE_URL.replace(/\/+$/, ''),
    ENABLE_TEST_CONTROLS: enableTestControls,
    /**
     * True when the development-only outcome controls may be used.
     * They are available in "development" and in the isolated "test"
     * environment, never in "production".
     */
    testControlsEnabled: enableTestControls && env.NODE_ENV !== 'production',
    /** True when the server may force a simulated transaction outcome. */
    isProduction: env.NODE_ENV === 'production',
    /** True when the real gateway adapters are active. */
    isLiveMode: env.PAYMENT_MODE === 'live',
  }
}

export const env = loadEnv()

export default env
