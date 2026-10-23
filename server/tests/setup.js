import { afterAll, beforeAll, beforeEach } from 'vitest'

/**
 * Test setup.
 *
 * The environment variables are set BEFORE anything imports the application,
 * because `src/config/env.js` validates the configuration once, when it is
 * first loaded.
 */
process.env.NODE_ENV = 'test'
process.env.PORT = '5001'
process.env.CLIENT_URL = 'http://localhost:5173'
process.env.MONGODB_URI =
  process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/paylab_test'
process.env.PAYMENT_MODE = 'mock'
process.env.ENABLE_TEST_CONTROLS = 'true'
process.env.MOCK_GATEWAY_DELAY_MS = '10'
process.env.RATE_LIMIT_MAX = '1000'
process.env.LOG_LEVEL = 'silent'

const { connectDatabase, disconnectDatabase } = await import('../src/config/database.js')
const { Order } = await import('../src/models/Order.js')
const { Transaction } = await import('../src/models/Transaction.js')

/** Connect to the isolated test database once for the whole run. */
beforeAll(async () => {
  await connectDatabase()
})

/** Close the connection when the run is over. */
afterAll(async () => {
  await disconnectDatabase()
})

/** Start every test with an empty database. */
beforeEach(async () => {
  await Promise.all([Order.deleteMany({}), Transaction.deleteMany({})])
})

/**
 * Helper used by the tests: create a demo order through the API.
 */
export async function createDemoOrder(request, app, query = '') {
  const response = await request(app).get(`/api/orders/demo${query}`)

  if (response.status !== 201) {
    throw new Error(`Could not create a demo order: ${response.status} ${JSON.stringify(response.body)}`)
  }

  return response.body.data
}
