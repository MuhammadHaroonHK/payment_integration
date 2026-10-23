import pino from 'pino'
import { env } from '../config/env.js'

/**
 * Structured application logger.
 *
 * Only operational events are logged. Customer names, email addresses and
 * mobile numbers are never written to the log — see `safeLogCustomer()` in
 * the payment service.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'paylab-server' },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.customer.email',
      'req.body.customer.mobile',
      'customer.email',
      'customer.mobile',
    ],
    censor: '[redacted]',
  },
  ...(env.NODE_ENV === 'development'
    ? { transport: { target: 'pino/file', options: { destination: 1 } } }
    : {}),
})

export default logger
