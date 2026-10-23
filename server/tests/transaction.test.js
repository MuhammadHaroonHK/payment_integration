import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { createDemoOrder } from './setup.js'

/**
 * Transaction endpoint tests
 */
describe('transaction endpoints', () => {
  const app = createApp()

  /** Create a transaction that is guaranteed to exist. */
  async function createTransaction(gateway = 'JAZZCASH', outcome = 'SUCCESS') {
    const order = await createDemoOrder(request, app)

    const response = await request(app)
      .post('/api/payments/create')
      .send({ orderNumber: order.orderNumber, gateway, simulatedOutcome: outcome })

    if (response.status !== 201) {
      throw new Error(`Could not create a transaction: ${JSON.stringify(response.body)}`)
    }

    return response.body.data
  }

  it('returns the status of a transaction', async () => {
    const transaction = await createTransaction()

    const response = await request(app).get(`/api/payments/${transaction.transactionReference}/status`)

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data.transactionReference).toBe(transaction.transactionReference)
    expect(response.body.data.orderNumber).toBe(transaction.orderNumber)
    expect(response.body.data.gateway).toBe('JAZZCASH')
    expect(response.body.data.amount).toBe(transaction.amount)
    expect(response.body.data.currency).toBe('PKR')
    expect(response.body.data.status).toBe('SUCCESS')
    expect(response.body.data.mode).toBe('MOCK')
    expect(response.body.data.createdAt).toBeTruthy()
    expect(response.body.data.updatedAt).toBeTruthy()
  })

  it('finds a transaction by its Mongo id as well', async () => {
    const transaction = await createTransaction()

    const response = await request(app).get(`/api/payments/${transaction.id}/status`)

    expect(response.status).toBe(200)
    expect(response.body.data.transactionReference).toBe(transaction.transactionReference)
  })

  it('returns TRANSACTION_NOT_FOUND for an unknown reference', async () => {
    const response = await request(app).get('/api/payments/PAYLAB-TXN-NOTHERE/status')

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('TRANSACTION_NOT_FOUND')
  })

  it('rejects a malformed transaction identifier', async () => {
    const response = await request(app).get('/api/payments/bad%20id!/status')

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('lists the transaction history', async () => {
    await createTransaction('JAZZCASH')
    await createTransaction('EASYPAISA')

    const response = await request(app).get('/api/payments/transactions')

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data.transactions).toHaveLength(2)
    expect(response.body.pagination.total).toBe(2)
    expect(response.body.pagination.page).toBe(1)
  })

  it('filters the history by gateway', async () => {
    await createTransaction('JAZZCASH')
    await createTransaction('EASYPAISA')

    const response = await request(app).get('/api/payments/transactions?gateway=EASYPAISA')

    expect(response.status).toBe(200)
    expect(response.body.data.transactions).toHaveLength(1)
    expect(response.body.data.transactions[0].gateway).toBe('EASYPAISA')
  })

  it('filters the history by status', async () => {
    await createTransaction('JAZZCASH', 'SUCCESS')
    await createTransaction('JAZZCASH', 'FAILED')

    const response = await request(app).get('/api/payments/transactions?status=FAILED')

    expect(response.status).toBe(200)
    expect(response.body.data.transactions).toHaveLength(1)
    expect(response.body.data.transactions[0].status).toBe('FAILED')
  })

  it('searches the history by order number and by reference', async () => {
    const transaction = await createTransaction()

    const byReference = await request(app).get(
      `/api/payments/transactions?search=${transaction.transactionReference}`,
    )
    expect(byReference.body.data.transactions).toHaveLength(1)

    const byOrder = await request(app).get(
      `/api/payments/transactions?search=${transaction.orderNumber}`,
    )
    expect(byOrder.body.data.transactions).toHaveLength(1)

    const noMatch = await request(app).get('/api/payments/transactions?search=zzzz-nothing')
    expect(noMatch.body.data.transactions).toHaveLength(0)
  })

  it('paginates the history', async () => {
    for (let index = 0; index < 5; index += 1) {
      await createTransaction('JAZZCASH')
    }

    const firstPage = await request(app).get('/api/payments/transactions?page=1&limit=2')

    expect(firstPage.status).toBe(200)
    expect(firstPage.body.data.transactions).toHaveLength(2)
    expect(firstPage.body.pagination.total).toBe(5)
    expect(firstPage.body.pagination.totalPages).toBe(3)
    expect(firstPage.body.pagination.hasNextPage).toBe(true)
    expect(firstPage.body.pagination.hasPreviousPage).toBe(false)

    const lastPage = await request(app).get('/api/payments/transactions?page=3&limit=2')

    expect(lastPage.body.data.transactions).toHaveLength(1)
    expect(lastPage.body.pagination.hasNextPage).toBe(false)
    expect(lastPage.body.pagination.hasPreviousPage).toBe(true)
  })

  it('rejects an invalid pagination value', async () => {
    const response = await request(app).get('/api/payments/transactions?page=0&limit=999')

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects an invalid status filter', async () => {
    const response = await request(app).get('/api/payments/transactions?status=MAYBE')

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns a single transaction with its order summary', async () => {
    const transaction = await createTransaction()

    const response = await request(app).get(
      `/api/payments/transactions/${transaction.transactionReference}`,
    )

    expect(response.status).toBe(200)
    expect(response.body.data.transactionReference).toBe(transaction.transactionReference)
    expect(response.body.data.order).toBeTruthy()
    expect(response.body.data.order.orderNumber).toBe(transaction.orderNumber)
    expect(response.body.data.order.items[0].unitPriceFormatted).toBe('PKR 4,500')
  })

  it('returns TRANSACTION_NOT_FOUND for an unknown single transaction', async () => {
    const response = await request(app).get('/api/payments/transactions/PAYLAB-TXN-NOTHERE')

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('TRANSACTION_NOT_FOUND')
  })
})

describe('demo order endpoint', () => {
  const app = createApp()

  it('creates a demo order using server controlled pricing', async () => {
    const response = await request(app).get('/api/orders/demo')

    expect(response.status).toBe(201)
    expect(response.body.success).toBe(true)
    expect(response.body.data.orderNumber).toMatch(/^PAYLAB-DEMO-/)
    expect(response.body.data.currency).toBe('PKR')
    expect(response.body.data.totalAmount).toBe(465_000)
    expect(response.body.data.totalAmountFormatted).toBe('PKR 4,650')
    expect(response.body.data.items[0].unitPrice).toBe(450_000)
    expect(response.body.data.status).toBe('PENDING')
  })

  it('creates a new order for every call', async () => {
    const first = await request(app).get('/api/orders/demo')
    const second = await request(app).get('/api/orders/demo')

    expect(first.body.data.orderNumber).not.toBe(second.body.data.orderNumber)
  })

  it('honours the requested quantity', async () => {
    const response = await request(app).get('/api/orders/demo?quantity=3')

    expect(response.status).toBe(201)
    expect(response.body.data.totalAmount).toBe(1_365_000)
    expect(response.body.data.items[0].quantity).toBe(3)
  })

  it('rejects an out of range quantity', async () => {
    const response = await request(app).get('/api/orders/demo?quantity=999')

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('reports whether the mock test controls are available', async () => {
    const response = await request(app).get('/api/orders/demo')

    expect(response.body.capabilities).toBeTruthy()
    expect(response.body.capabilities.testControlsEnabled).toBe(true)
  })
})
