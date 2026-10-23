import { describe, it, expect } from 'vitest'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Configuration safety tests.
 *
 * These rules are decided when the configuration is loaded, so the API is
 * started in a child process with a modified environment.
 */

const probePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'support',
  'probeServer.mjs',
)

/**
 * Start the API in a child process with the given environment overrides.
 *
 * @param {Record<string, string>} overrides
 * @returns {Promise<any>} the probe result
 */
function runProbe(overrides) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [probePath], {
      env: { ...process.env, ...overrides },
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
      const line = output.split('\n').find((entry) => entry.startsWith('__PROBE__'))

      if (!line) {
        reject(new Error(`The probe did not report a result.\n${errorOutput}`))
        return
      }

      try {
        resolve(JSON.parse(line.replace('__PROBE__', '')))
      } catch (error) {
        reject(error)
      }
    })
  })
}

describe('development test controls', () => {
  it('ignores the test controls when NODE_ENV is production', async () => {
    const result = await runProbe({
      NODE_ENV: 'production',
      PAYMENT_MODE: 'mock',
      ENABLE_TEST_CONTROLS: 'true',
    })

    // The controls are reported as switched off ...
    expect(result.health.data.payments.testControlsEnabled).toBe(false)
    expect(result.capabilities.testControlsEnabled).toBe(false)

    // ... and a request that tries to force an outcome is rejected.
    expect(result.createStatus).toBe(400)
    expect(result.createBody.error.code).toBe('TEST_CONTROLS_DISABLED')

    // The mock control route is not even registered.
    expect(result.mockStatus).toBe(404)
  })

  it('ignores the test controls when ENABLE_TEST_CONTROLS is false', async () => {
    const result = await runProbe({
      NODE_ENV: 'development',
      PAYMENT_MODE: 'mock',
      ENABLE_TEST_CONTROLS: 'false',
    })

    expect(result.health.data.payments.testControlsEnabled).toBe(false)
    expect(result.createStatus).toBe(400)
    expect(result.createBody.error.code).toBe('TEST_CONTROLS_DISABLED')
    expect(result.mockStatus).toBe(404)
  })

  it('allows the test controls in development with mock mode', async () => {
    const result = await runProbe({
      NODE_ENV: 'development',
      PAYMENT_MODE: 'mock',
      ENABLE_TEST_CONTROLS: 'true',
    })

    expect(result.health.data.payments.testControlsEnabled).toBe(true)
    expect(result.createStatus).toBe(201)
    expect(result.createBody.data.status).toBe('FAILED')
    expect(result.mockStatus).toBe(404)
  })
})
