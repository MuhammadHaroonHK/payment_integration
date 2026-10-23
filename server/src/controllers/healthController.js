import { asyncHandler } from '../utils/asyncHandler.js'
import { getDatabaseStatus } from '../config/database.js'
import { env } from '../config/env.js'
import { describePaymentSetup } from '../services/gateways/gatewayFactory.js'

/**
 * Health controller
 *
 * Reports whether the API and the database are usable.
 *
 * ⚠️ It never exposes the connection string, the host, credentials or any
 * other sensitive configuration.
 */
export const getHealth = asyncHandler(async (req, res) => {
  const database = getDatabaseStatus()

  const body = {
    success: true,
    data: {
      status: database.connected ? 'ok' : 'degraded',
      api: 'PayLab API',
      version: '0.1.0',
      environment: env.NODE_ENV,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      database: {
        connected: database.connected,
        state: database.state,
        name: database.name,
      },
      payments: describePaymentSetup(),
    },
  }

  // A degraded database is reported with 503 so a load balancer notices.
  res.status(database.connected ? 200 : 503).json(body)
})

export default { getHealth }
