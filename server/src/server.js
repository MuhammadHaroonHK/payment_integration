import { createApp } from './app.js'
import { env } from './config/env.js'
import { connectDatabase, disconnectDatabase } from './config/database.js'
import { logger } from './utils/logger.js'

/**
 * Server bootstrap.
 *
 * The order matters: the configuration is validated when this module is
 * imported, the database is connected before the server starts listening and
 * both are closed cleanly on shutdown.
 */
async function start() {
  try {
    await connectDatabase()

    const app = createApp()

    const server = app.listen(env.PORT, () => {
      logger.info(
        {
          port: env.PORT,
          environment: env.NODE_ENV,
          paymentMode: env.PAYMENT_MODE.toUpperCase(),
          testControls: env.testControlsEnabled,
          clientUrl: env.CLIENT_URL,
        },
        'PayLab API is ready',
      )
    })

    server.on('error', (error) => {
      logger.error({ err: error.message }, 'The HTTP server could not start')
      process.exit(1)
    })

    /* ----------------------------- shutdown ----------------------------- */

    const shutdown = async (signal) => {
      logger.info({ signal }, 'Shutting down')

      server.close(async () => {
        await disconnectDatabase()
        process.exit(0)
      })

      // Do not hang forever if a connection refuses to close.
      setTimeout(() => process.exit(1), 10_000).unref()
    }

    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))

    process.on('unhandledRejection', (reason) => {
      logger.error({ reason: String(reason) }, 'Unhandled promise rejection')
    })

    process.on('uncaughtException', (error) => {
      logger.error({ err: error.message, stack: error.stack }, 'Uncaught exception')
      process.exit(1)
    })
  } catch (error) {
    logger.error({ err: error.message }, 'The server could not start')
    // The configuration error is the most useful thing to show, so it goes to
    // the console as well as to the log.
    console.error(`\n${error.message}\n`)
    process.exit(1)
  }
}

start()
