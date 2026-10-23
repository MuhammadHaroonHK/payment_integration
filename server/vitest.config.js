import { defineConfig } from 'vitest/config'

/**
 * Vitest configuration.
 *
 * The tests run against a real, local MongoDB but always in a separate
 * "paylab_test" database, so a test run can never touch development data.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.js'],
    setupFiles: ['tests/setup.js'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // The tests share one MongoDB instance, so they run one after another.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
})
