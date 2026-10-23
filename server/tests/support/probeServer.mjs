/**
 * Test support: boots the API in a child process with a custom environment.
 *
 * Some rules (for example "the development test controls must be disabled")
 * are decided once, when the configuration is loaded. To test them honestly
 * the API has to start with a different environment, so it is started here
 * as a separate process.
 *
 * The script prints one JSON line prefixed with "__PROBE__" so the test can
 * read the result without guessing.
 */
import { createApp } from '../../src/app.js'
import { connectDatabase, disconnectDatabase } from '../../src/config/database.js'

const results = {}

try {
  await connectDatabase()

  const app = createApp()
  const server = app.listen(0)

  await new Promise((resolve) => server.once('listening', resolve))

  const base = `http://127.0.0.1:${server.address().port}`

  // 1. What does the health endpoint report about the test controls?
  const healthResponse = await fetch(`${base}/api/health`)
  results.healthStatus = healthResponse.status
  results.health = await healthResponse.json()

  // 2. Create a demo order.
  const orderResponse = await fetch(`${base}/api/orders/demo`)
  const orderBody = await orderResponse.json()
  results.orderNumber = orderBody?.data?.orderNumber
  results.capabilities = orderBody?.capabilities

  // 3. Try to force a transaction outcome.
  const createResponse = await fetch(`${base}/api/payments/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderNumber: results.orderNumber,
      gateway: 'JAZZCASH',
      simulatedOutcome: 'FAILED',
    }),
  })
  results.createStatus = createResponse.status
  results.createBody = await createResponse.json()

  // 4. Is the mock control route registered at all?
  const mockResponse = await fetch(`${base}/api/payments/mock/PAYLAB-TXN-UNKNOWN/outcome`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ outcome: 'FAILED' }),
  })
  results.mockStatus = mockResponse.status

  console.log(`__PROBE__${JSON.stringify(results)}`)
} catch (error) {
  console.log(`__PROBE__${JSON.stringify({ ...results, error: error.message })}`)
} finally {
  await disconnectDatabase().catch(() => {})
  process.exit(0)
}
