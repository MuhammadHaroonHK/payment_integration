import 'dotenv/config'
import { z } from 'zod'

/**
 * Environment configuration.
 *
 * The whole server reads its configuration from this module — nothing else
 * touches `process.env` directly. Every value is validated here so a missing
 * or invalid setting fails loudly at startup instead of halfway through a
 * payment.
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
  MONGODB_URI: z.string().trim().min(1).default('mongodb://127.0.0.1:27017/paylab'),
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

  // Validate that the frontend origin is really a URL.
  try {
    new URL(env.CLIENT_URL)
  } catch {
    throw new Error(`Invalid environment configuration:\n  - CLIENT_URL: "${env.CLIENT_URL}" is not a valid URL.`)
  }

  // ── Safety rule 1 ────────────────────────────────────────────────────────
  // Only the mock provider exists today. Failing loudly is much safer than
  // silently simulating a payment that the user believes is real.
  if (env.PAYMENT_MODE === 'live') {
    throw new Error(
      'Invalid environment configuration:\n' +
        '  - PAYMENT_MODE: "live" is not supported yet.\n\n' +
        'No authorised JazzCash or Easypaisa adapter is configured, so the server ' +
        'refuses to start rather than pretending to process real payments.\n' +
        'Use PAYMENT_MODE=mock for local development.',
    )
  }

  // ── Safety rule 2 ────────────────────────────────────────────────────────
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

  return {
    ...env,
    ENABLE_TEST_CONTROLS: enableTestControls,
    /**
     * True when the development-only outcome controls may be used.
     * They are available in "development" and in the isolated "test"
     * environment, never in "production".
     */
    testControlsEnabled: enableTestControls && env.NODE_ENV !== 'production',
    /** True when the server may force a simulated transaction outcome. */
    isProduction: env.NODE_ENV === 'production',
  }
}

export const env = loadEnv()

export default env
