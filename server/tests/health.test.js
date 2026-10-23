import { describe, it, expect } from 'vitest'
import request from 'supertest'
import mongoose from 'mongoose'
import { createApp } from '../src/app.js'
import { getDatabaseStatus } from '../src/config/database.js'

/**
 * Health endpoint tests
 */
describe('GET /api/health', () => {
  const app = createApp()

  it('reports the API and the database as healthy', async () => {
    const response = await request(app).get('/api/health')

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data.status).toBe('ok')
    expect(response.body.data.environment).toBe('test')
    expect(response.body.data.database.connected).toBe(true)
    expect(response.body.data.database.state).toBe('connected')
    expect(response.body.data.payments.mode).toBe('MOCK')
    expect(response.body.data.payments.simulated).toBe(true)
  })

  it('never exposes the connection string or any secret', async () => {
    const response = await request(app).get('/api/health')
    const raw = JSON.stringify(response.body)

    expect(raw).not.toContain('mongodb://')
    expect(raw).not.toContain(process.env.MONGODB_URI)
    expect(raw).not.toMatch(/password/i)
    expect(raw).not.toMatch(/secret/i)
  })

  it('reports a degraded state when the database is unreachable', async () => {
    await mongoose.disconnect()

    try {
      const response = await request(app).get('/api/health')

      expect(response.status).toBe(503)
      expect(response.body.success).toBe(true)
      expect(response.body.data.status).toBe('degraded')
      expect(response.body.data.database.connected).toBe(false)
    } finally {
      // Put the connection back for the remaining tests.
      const { connectDatabase } = await import('../src/config/database.js')
      await connectDatabase()
    }
  })

  it('exposes the database status helper without secrets', () => {
    const status = getDatabaseStatus()

    expect(status).toHaveProperty('connected')
    expect(status).toHaveProperty('state')
    expect(status).toHaveProperty('name')
    expect(Object.keys(status)).not.toContain('uri')
  })
})

describe('unknown routes', () => {
  const app = createApp()

  it('returns a consistent 404 error shape', async () => {
    const response = await request(app).get('/api/does-not-exist')

    expect(response.status).toBe(404)
    expect(response.body.success).toBe(false)
    expect(response.body.error.code).toBe('NOT_FOUND')
    expect(typeof response.body.error.message).toBe('string')
  })
})
