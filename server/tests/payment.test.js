import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { createApp } from '../src/app.js'
import { createDemoOrder } from './setup.js'
import jazzcashGateway from '../src/services/gateways/jazzcashGateway.js'
import easypaisaGateway from '../src/services/gateways/easypaisaGateway.js'
import { Order } from '../src/models/Order.js'

/**
 * Payment endpoint tests
 */
describe('POST /api/payments/create', () => {
  const app = createApp()

  it('processes a successful JazzCash mock payment', async () => {
    const order = await createDemoOrder(request, app)

    const response = await request(app)
      .post('/api/payments/create')
      .send({ orderNumber: order.orderNumber, gateway: 'JAZZCASH' })

    expect(response.status).toBe(201)
    expect(response.body.success).toBe(true)
    expect(response.body.mode).toBe('MOCK')
    expect(response.body.data.status).toBe('SUCCESS')
    expect(response.body.data.gateway).toBe('JAZZCASH')
    expect(response.body.data.orderNumber).toBe(order.orderNumber)
    expect(response.body.data.transactionReference).toMatch(/^PAYLAB-TXN-/)
    expect(response.body.data.mode).toBe('MOCK')
    expect(response.body.data.simulated).toBe(true)
    // The gateway reference must be clearly labelled as simulated.
    expect(response.body.data.gatewayReference).toMatch(/^SIM-MOCK-/)
    expect(response.body.data.amount).toBe(order.totalAmount)
  })

  it('processes a successful Easypaisa mock payment', async () => {
    const order = await createDemoOrder(request, app)

    const response = await request(app)
      .post('/api/payments/create')
      .send({ orderNumber: order.orderNumber, gateway: 'EASYPAISA' })

    expect(response.status).toBe(201)
    expect(response.body.data.status).toBe('SUCCESS')
    expect(response.body.data.gateway).toBe('EASYPAISA')
    expect(response.body.data.gatewayReference).toMatch(/^SIM-MOCK-EASYPAISA-/)
  })

  it('accepts the lowercase gateway names used by the React frontend', async () => {
    const order = await createDemoOrder(request, app)

    const response = await request(app)
      .post('/api/payments/create')
      .send({ orderNumber: order.orderNumber, gateway: 'jazzcash' })

    expect(response.status).toBe(201)
    expect(response.body.data.gateway).toBe('JAZZCASH')
  })

  it('accepts the payload shape used by the React frontend', async () => {
    const order = await createDemoOrder(request, app)

    const response = await request(app)
      .post('/api/payments/create')
      .send({
        order: { orderNumber: order.orderNumber },
        customer: { fullName: 'Ayesha Khan', email: 'ayesha@example.com', phone: '03001234567' },
        gateway: 'jazzcash',
      })

    expect(response.status).toBe(201)
    expect(response.body.data.status).toBe('SUCCESS')
    expect(response.body.data.customer.name).toBe('Ayesha Khan')
  })

  it('ignores any amount sent by the browser and uses the server price', async () => {
    const order = await createDemoOrder(request, app)

    const response = await request(app)
      .post('/api/payments/create')
      .send({
        orderNumber: order.orderNumber,
        gateway: 'JAZZCASH',
        totals: { total: 1, subtotal: 1, serviceFee: 0 },
        amount: 1,
      })

    expect(response.status).toBe(201)
    // PKR 4,500 + PKR 150 = PKR 4,650 -> 465_000 paisa
    expect(response.body.data.amount).toBe(465_000)
    expect(response.body.data.amount).not.toBe(1)
  })

  it('recalculates the amount when the quantity changes', async () => {
    const order = await createDemoOrder(request, app)

    const response = await request(app)
      .post('/api/payments/create')
      .send({ orderNumber: order.orderNumber, gateway: 'JAZZCASH', quantity: 3 })

    expect(response.status).toBe(201)
    // 3 x PKR 4,500 + PKR 150 = PKR 13,650 -> 1_365_000 paisa
    expect(response.body.data.amount).toBe(1_365_000)
    expect(response.body.data.breakdown.quantity).toBe(3)
  })

  it('simulates a failed payment', async () => {
    const order = await createDemoOrder(request, app)

    const response = await request(app)
      .post('/api/payments/create')
      .send({
        orderNumber: order.orderNumber,
        gateway: 'JAZZCASH',
        simulatedOutcome: 'FAILED',
      })

    expect(response.status).toBe(201)
    expect(response.body.data.status).toBe('FAILED')
    expect(response.body.data.failureReason).toMatch(/simulated/i)
  })

  it('simulates a cancelled payment', async () => {
    const order = await createDemoOrder(request, app)

    const response = await request(app)
      .post('/api/payments/create')
      .send({
        orderNumber: order.orderNumber,
        gateway: 'EASYPAISA',
        simulatedOutcome: 'CANCELLED',
      })

    expect(response.status).toBe(201)
    expect(response.body.data.status).toBe('CANCELLED')
    expect(response.body.data.failureReason).toMatch(/simulated/i)
  })

  it('simulates a pending payment and keeps it pending', async () => {
    const order = await createDemoOrder(request, app)

    const response = await request(app)
      .post('/api/payments/create')
      .send({
        orderNumber: order.orderNumber,
        gateway: 'JAZZCASH',
        simulatedOutcome: 'PENDING',
      })

    expect(response.status).toBe(201)
    expect(response.body.data.status).toBe('PENDING')
    expect(response.body.data.failureReason).toMatch(/pending/i)

    // The order must not be marked as paid.
    const storedOrder = await Order.findOne({ orderNumber: order.orderNumber })
    expect(storedOrder.status).toBe('PENDING')
  })

  it('rejects an unknown gateway', async () => {
    const order = await createDemoOrder(request, app)

    const response = await request(app)
      .post('/api/payments/create')
      .send({ orderNumber: order.orderNumber, gateway: 'PAYPAL' })

    expect(response.status).toBe(400)
    expect(response.body.success).toBe(false)
    expect(response.body.error.code).toBe('INVALID_GATEWAY')
  })

  it('rejects a missing order', async () => {
    const response = await request(app)
      .post('/api/payments/create')
      .send({ orderNumber: 'PAYLAB-DEMO-DOESNOTEXIST', gateway: 'JAZZCASH' })

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('ORDER_NOT_FOUND')
  })

  it('rejects an invalid request body', async () => {
    const response = await request(app).post('/api/payments/create').send({ gateway: '' })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
    expect(Array.isArray(response.body.error.details)).toBe(true)
  })

  it('rejects a request without a gateway', async () => {
    const response = await request(app).post('/api/payments/create').send({ orderNumber: 'X-1' })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('prevents paying the same order twice', async () => {
    const order = await createDemoOrder(request, app)

    const first = await request(app)
      .post('/api/payments/create')
      .send({ orderNumber: order.orderNumber, gateway: 'JAZZCASH' })

    expect(first.status).toBe(201)
    expect(first.body.data.status).toBe('SUCCESS')

    const second = await request(app)
      .post('/api/payments/create')
      .send({ orderNumber: order.orderNumber, gateway: 'JAZZCASH' })

    expect(second.status).toBe(409)
    expect(second.body.error.code).toBe('DUPLICATE_PAYMENT')
  })

  it('marks the order as paid after a successful payment', async () => {
    const order = await createDemoOrder(request, app)

    await request(app)
      .post('/api/payments/create')
      .send({ orderNumber: order.orderNumber, gateway: 'JAZZCASH' })

    const storedOrder = await Order.findOne({ orderNumber: order.orderNumber })
    expect(storedOrder.status).toBe('PAID')
    expect(storedOrder.paymentInProgress).toBe(false)
  })
})

describe('mock outcome controls', () => {
  const app = createApp()

  it('finalises a pending transaction through the mock control', async () => {
    const order = await createDemoOrder(request, app)

    const created = await request(app)
      .post('/api/payments/create')
      .send({
        orderNumber: order.orderNumber,
        gateway: 'JAZZCASH',
        simulatedOutcome: 'PENDING',
      })

    expect(created.body.data.status).toBe('PENDING')

    const reference = created.body.data.transactionReference

    const finalised = await request(app)
      .post(`/api/payments/mock/${reference}/outcome`)
      .send({ outcome: 'SUCCESS' })

    expect(finalised.status).toBe(200)
    expect(finalised.body.data.status).toBe('SUCCESS')
  })

  it('rejects an invalid status transition', async () => {
    const order = await createDemoOrder(request, app)

    const created = await request(app)
      .post('/api/payments/create')
      .send({
        orderNumber: order.orderNumber,
        gateway: 'JAZZCASH',
        simulatedOutcome: 'SUCCESS',
      })

    const reference = created.body.data.transactionReference

    const response = await request(app)
      .post(`/api/payments/mock/${reference}/outcome`)
      .send({ outcome: 'FAILED' })

    expect(response.status).toBe(409)
    expect(response.body.error.code).toBe('INVALID_STATUS_TRANSITION')
  })

  it('rejects an unknown outcome value', async () => {
    const response = await request(app)
      .post('/api/payments/mock/PAYLAB-TXN-UNKNOWN/outcome')
      .send({ outcome: 'MAYBE' })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('real gateway adapters', () => {
  it('the JazzCash adapter refuses to process a payment', async () => {
    await expect(jazzcashGateway.createPayment({})).rejects.toMatchObject({
      code: 'GATEWAY_NOT_CONFIGURED',
      statusCode: 501,
    })
  })

  it('the Easypaisa adapter refuses to process a payment', async () => {
    await expect(easypaisaGateway.createPayment({})).rejects.toMatchObject({
      code: 'GATEWAY_NOT_CONFIGURED',
      statusCode: 501,
    })
  })

  it('documents what is still required for a real integration', () => {
    expect(jazzcashGateway.REQUIRED_INTEGRATION_DETAILS.credentials.length).toBeGreaterThan(0)
    expect(easypaisaGateway.REQUIRED_INTEGRATION_DETAILS.documentation.length).toBeGreaterThan(0)
    expect(jazzcashGateway.describe().implemented).toBe(false)
  })

  it('refuses to start the server with PAYMENT_MODE=live', () => {
    const envModule = pathToFileURL(path.resolve('src/config/env.js')).href
    const code = `import(${JSON.stringify(envModule)}).then(()=>{console.log('NO_ERROR');process.exit(0)}).catch((error)=>{console.log('ERROR:'+error.message);process.exit(3)})`

    const result = spawnSync('node', ['--input-type=module', '-e', code], {
      encoding: 'utf8',
      env: { ...process.env, PAYMENT_MODE: 'live', NODE_ENV: 'development' },
    })

    expect(result.status).toBe(3)
    expect(result.stdout).toContain('not supported yet')
  })
})
