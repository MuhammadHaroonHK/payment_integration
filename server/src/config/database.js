import mongoose from 'mongoose'
import { env } from './env.js'
import { logger } from '../utils/logger.js'

/**
 * MongoDB connection handling.
 *
 * The server never starts listening for requests before the database is
 * reachable — a payment API that cannot store a transaction must not accept
 * payments.
 */

mongoose.set('strictQuery', true)

/** Human readable names for the mongoose connection states. */
const STATE_NAMES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
  99: 'uninitialized',
}

/**
 * Connect to MongoDB.
 *
 * @param {string} [uri] defaults to the configured MONGODB_URI
 * @returns {Promise<typeof mongoose>}
 */
export async function connectDatabase(uri = env.MONGODB_URI) {
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 10,
    })

    logger.info({ db: mongoose.connection.name }, 'Connected to MongoDB')
    return mongoose
  } catch (error) {
    logger.error({ err: error.message }, 'Could not connect to MongoDB')
    throw error
  }
}

/**
 * Close the connection (used on shutdown and between test runs).
 */
export async function disconnectDatabase() {
  if (mongoose.connection.readyState === 0) return
  await mongoose.disconnect()
  logger.info('Disconnected from MongoDB')
}

/**
 * A safe description of the database connection for the health endpoint.
 *
 * It deliberately contains no connection string, host, user or password.
 */
export function getDatabaseStatus() {
  const state = mongoose.connection.readyState

  return {
    connected: state === 1,
    state: STATE_NAMES[state] || 'unknown',
    name: mongoose.connection.name || null,
  }
}

export default { connectDatabase, disconnectDatabase, getDatabaseStatus }
