import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import { env } from './config/env.js'
import { requestId, requestLogger } from './middleware/requestId.js'
import { notFound } from './middleware/notFound.js'
import { errorHandler } from './middleware/errorHandler.js'
import healthRoutes from './routes/healthRoutes.js'
import paymentRoutes from './routes/paymentRoutes.js'
import transactionRoutes from './routes/transactionRoutes.js'
import orderRoutes from './routes/orderRoutes.js'

/**
 * The Express application.
 *
 * It is created separately from `server.js` so the test suite can import it
 * without opening a network port.
 */
export function createApp() {
  const app = express()

  // Only trust proxy headers when the app really runs behind a proxy.
  app.set('trust proxy', false)
  app.disable('x-powered-by')

  /* ------------------------------ security ------------------------------ */

  app.use(helmet())

  /**
   * CORS with an explicit origin.
   *
   * Only the configured frontend origin may call the API from a browser.
   */
  app.use(
    cors({
      origin: env.CLIENT_URL,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Accept', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 600,
    }),
  )

  /* ------------------------------- parsing ------------------------------ */

  // Small JSON limit — payment payloads are tiny.
  app.use(express.json({ limit: '100kb' }))
  app.use(express.urlencoded({ extended: false, limit: '100kb' }))

  /* ------------------------------- logging ------------------------------ */

  app.use(requestId)
  app.use(requestLogger)

  if (env.NODE_ENV !== 'test') {
    // Human readable access log for local development.
    app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'))
  }

  /* -------------------------------- routes ------------------------------ */

  app.use('/api/health', healthRoutes)

  // The transaction history is registered before the generic payment routes
  // so that "/api/payments/transactions" is never read as a transaction id.
  app.use('/api/payments/transactions', transactionRoutes)
  app.use('/api/payments', paymentRoutes)
  app.use('/api/orders', orderRoutes)

  /* ------------------------------- errors ------------------------------- */

  app.use(notFound)
  app.use(errorHandler)

  return app
}

export default createApp
