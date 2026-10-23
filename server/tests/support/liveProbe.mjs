/**
 * Test support: boots the API in live mode with fake (but structurally valid)
 * gateway credentials and walks through the hosted-checkout flow.
 *
 * No request leaves this process: the gateway adapters only *build* the signed
 * redirect form here, and the callbacks are signed locally with the same
 * algorithm the gateway uses. That is exactly what we want to test — our own
 * request building and callback verification.
 */
import { createApp } from '../../src/app.js'
import { connectDatabase, disconnectDatabase } from '../../src/config/database.js'
import { Order } from '../../src/models/Order.js'
import { Transaction } from '../../src/models/Transaction.js'
import { buildSecureHash } from '../../src/services/gateways/jazzcashGateway.js'

const results = {}

const SALT = process.env.JAZZCASH_INTEGRITY_SALT

async function json(response) {
  return response.json()
}

try {
  await connectDatabase()
  await Promise.all([Order.deleteMany({}), Transaction.deleteMany({})])

  const app = createApp()
  const server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))

  const base = `http://127.0.0.1:${server.address().port}`

  /* ------------------------------ JazzCash ------------------------------ */

  const orderBody = await json(await fetch(`${base}/api/orders/demo`))
  const order = orderBody.data

  results.mode = orderBody.capabilities?.mode
  results.gateways = orderBody.capabilities?.gateways

  const createResponse = await fetch(`${base}/api/payments/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderNumber: order.orderNumber,
      gateway: 'JAZZCASH',
      customer: { fullName: 'Ayesha Khan', email: 'ayesha@example.com', phone: '03001234567' },
    }),
  })

  const created = await createResponse.json()
  results.jazzcashCreateStatus = createResponse.status
  results.jazzcashCreated = created

  const fields = created.redirect?.fields || {}

  const callbackFields = {
    pp_TxnRefNo: fields.pp_TxnRefNo,
    pp_Amount: fields.pp_Amount,
    pp_ResponseCode: '000',
    pp_ResponseMessage: 'Success',
    pp_RetreivalReferenceNo: '987654321',
  }
  callbackFields.pp_SecureHash = buildSecureHash(callbackFields, SALT)

  const callbackResponse = await fetch(`${base}/api/payments/jazzcash/return`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(callbackFields).toString(),
    redirect: 'manual',
  })

  results.jazzcashCallbackStatus = callbackResponse.status
  results.jazzcashCallbackLocation = callbackResponse.headers.get('location')

  const statusBody = await json(
    await fetch(`${base}/api/payments/${created.data.id}/status`),
  )
  results.jazzcashFinalStatus = statusBody.data

  /* --------------------------- Forged callback -------------------------- */

  const order2 = (await json(await fetch(`${base}/api/orders/demo`))).data
  const created2 = await json(
    await fetch(`${base}/api/payments/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNumber: order2.orderNumber, gateway: 'JAZZCASH' }),
    }),
  )

  const forgedResponse = await fetch(`${base}/api/payments/jazzcash/return`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      pp_TxnRefNo: created2.redirect.fields.pp_TxnRefNo,
      pp_Amount: created2.redirect.fields.pp_Amount,
      pp_ResponseCode: '000',
      pp_SecureHash: '00'.repeat(32),
    }).toString(),
    redirect: 'manual',
  })

  results.forgedCallbackStatus = forgedResponse.status
  results.forgedTransaction = (
    await json(await fetch(`${base}/api/payments/${created2.data.id}/status`))
  ).data

  /* ------------------------------ Easypaisa ----------------------------- */

  const order3 = (await json(await fetch(`${base}/api/orders/demo`))).data
  const created3 = await json(
    await fetch(`${base}/api/payments/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderNumber: order3.orderNumber,
        gateway: 'EASYPAISA',
        customer: {
          fullName: 'Ayesha Khan',
          email: 'ayesha@example.com',
          phone: '03001234567',
        },
      }),
    }),
  )

  results.easypaisaCreateStatus = 201
  results.easypaisaCreated = created3

  const epRef = created3.redirect?.fields?.orderRefNum

  // The first Easypaisa redirect carries an auth_token. The server must answer
  // with a self-submitting form that the CSP nonce actually allows.
  const confirmResponse = await fetch(
    `${base}/api/payments/easypaisa/return?tx=${encodeURIComponent(epRef)}&auth_token=test-token`,
  )
  results.easypaisaConfirmStatus = confirmResponse.status
  results.easypaisaConfirmCsp = confirmResponse.headers.get('content-security-policy')
  results.easypaisaConfirmBody = await confirmResponse.text()

  const callbackResponse2 = await fetch(
    `${base}/api/payments/easypaisa/callback?tx=${encodeURIComponent(epRef)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        status: '0000',
        desc: '0000',
        orderRefNumber: epRef,
      }).toString(),
      redirect: 'manual',
    },
  )

  results.easypaisaCallbackStatus = callbackResponse2.status
  results.easypaisaCallbackLocation = callbackResponse2.headers.get('location')
  results.easypaisaFinalStatus = (
    await json(await fetch(`${base}/api/payments/${created3.data.id}/status`))
  ).data

  console.log(`__LIVE_PROBE__${JSON.stringify(results)}`)
} catch (error) {
  console.log(
    `__LIVE_PROBE__${JSON.stringify({ ...results, error: error.stack || error.message })}`,
  )
} finally {
  await disconnectDatabase().catch(() => {})
  process.exit(0)
}
