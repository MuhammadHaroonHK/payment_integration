import { describe, it, expect } from 'vitest'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Live-mode integration tests.
 *
 * The API is started in a child process with PAYMENT_MODE=live and fake
 * credentials, because `src/config/env.js` is evaluated once per process.
 * The probe walks the whole hosted-checkout flow against a local HTTP server;
 * no request is sent to JazzCash or Easypaisa.
 */

const probePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'support',
  'liveProbe.mjs',
)

const liveEnv = {
  NODE_ENV: 'test',
  PAYMENT_MODE: 'live',
  ENABLE_TEST_CONTROLS: 'false',
  CLIENT_URL: 'http://localhost:5173',
  PUBLIC_BASE_URL: 'http://localhost:5000',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/paylab_live_probe',
  JAZZCASH_ENVIRONMENT: 'sandbox',
  JAZZCASH_MERCHANT_ID: 'MC-TEST',
  JAZZCASH_PASSWORD: 'test-password',
  JAZZCASH_INTEGRITY_SALT: 'test-integrity-salt',
  EASYPAISA_ENVIRONMENT: 'sandbox',
  EASYPAISA_STORE_ID: '12345',
  EASYPAISA_HASH_KEY: '0123456789abcdef',
  EASYPAISA_USERNAME: '',
  EASYPAISA_PASSWORD: '',
  EASYPAISA_ACCOUNT_NUMBER: '',
  EASYPAISA_TRUST_REDIRECT: 'true',
  RATE_LIMIT_MAX: '1000',
  LOG_LEVEL: 'silent',
}

function runLiveProbe() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [probePath], {
      env: { ...process.env, ...liveEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let output = ''
    let errorOutput = ''

    child.stdout.on('data', (chunk) => {
      output += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      errorOutput += chunk.toString()
    })

    child.on('error', reject)

    child.on('close', () => {
      const line = output.split('\n').find((entry) => entry.startsWith('__LIVE_PROBE__'))

      if (!line) {
        reject(new Error(`The live probe did not report a result.\n${errorOutput}`))
        return
      }

      resolve(JSON.parse(line.replace('__LIVE_PROBE__', '')))
    })
  })
}

describe('live hosted checkout', () => {
  it('runs the full JazzCash and Easypaisa flow without contacting the gateway', async () => {
    const result = await runLiveProbe()

    expect(result.error).toBeUndefined()

    // Health / capabilities
    expect(result.mode).toBe('LIVE')
    expect(result.gateways).toEqual({ jazzcash: true, easypaisa: true })

    /* ------------------------------ JazzCash ---------------------------- */
    expect(result.jazzcashCreateStatus).toBe(201)
    expect(result.jazzcashCreated.redirect.url).toContain('sandbox.jazzcash.com.pk')
    expect(result.jazzcashCreated.redirect.method).toBe('POST')
    expect(result.jazzcashCreated.redirect.fields.pp_SecureHash).toMatch(/^[A-F0-9]{64}$/)
    expect(result.jazzcashCreated.redirect.fields.pp_Amount).toBe('465000')
    expect(result.jazzcashCreated.redirect.fields.pp_MerchantID).toBe('MC-TEST')
    expect(result.jazzcashCreated.data.status).toBe('PENDING')
    expect(result.jazzcashCreated.data.mode).toBe('LIVE')
    expect(result.jazzcashCreated.data.simulated).toBe(false)

    // The signed callback is accepted and the customer is sent to the result page.
    expect(result.jazzcashCallbackStatus).toBe(303)
    expect(result.jazzcashCallbackLocation).toContain('/payment/result/')
    expect(result.jazzcashFinalStatus.status).toBe('SUCCESS')
    expect(result.jazzcashFinalStatus.gatewayVerified).toBe(true)
    expect(result.jazzcashFinalStatus.gatewayReference).toBe('987654321')

    /* --------------------------- Forged callback ------------------------ */
    expect(result.forgedCallbackStatus).toBe(400)
    expect(result.forgedTransaction.status).toBe('PENDING')

    /* ------------------------------ Easypaisa --------------------------- */
    expect(result.easypaisaCreateStatus).toBe(201)
    expect(result.easypaisaCreated.redirect.url).toContain('easypaystg.easypaisa.com.pk')
    expect(result.easypaisaCreated.redirect.fields.merchantHashedReq).toMatch(/^[A-Za-z0-9+/]+={0,2}$/)
    expect(result.easypaisaCreated.redirect.fields.amount).toBe('4650.0')
    expect(result.easypaisaCreated.data.status).toBe('PENDING')
    expect(result.easypaisaCreated.data.mode).toBe('LIVE')

    // The confirmation page must be allowed to run its inline submit script.
    expect(result.easypaisaConfirmStatus).toBe(200)
    expect(result.easypaisaConfirmCsp).toContain("'nonce-")
    expect(result.easypaisaConfirmCsp).toContain('form-action')
    expect(result.easypaisaConfirmCsp).toContain('https://easypaystg.easypaisa.com.pk')
    expect(result.easypaisaConfirmCsp).not.toContain('upgrade-insecure-requests')
    expect(result.easypaisaConfirmBody).toContain('/easypay/Confirm.jsf')
    expect(result.easypaisaConfirmBody).toContain('auth_token')
    expect(result.easypaisaConfirmBody).toContain('nonce="')

    expect(result.easypaisaCallbackStatus).toBe(303)
    expect(result.easypaisaCallbackLocation).toContain('/payment/result/')
    expect(result.easypaisaFinalStatus.status).toBe('SUCCESS')
    // No inquiry credentials were configured, so the redirect is used unsigned.
    expect(result.easypaisaFinalStatus.gatewayVerified).toBe(false)
  }, 60_000)
})
