import { generateRequestId } from '../utils/generateReference.js'
import { logger } from '../utils/logger.js'

/**
 * requestId
 *
 * Gives every request a correlation id so a frontend error can be matched
 * with a server log line.
 *
 * The id is taken from the incoming `X-Request-Id` header when the frontend
 * supplies one (the PayLab axios client always does), otherwise a new one is
 * generated. It is echoed back in the response.
 */
export function requestId(req, res, next) {
  const incoming = req.get('x-request-id')
  const id = incoming && incoming.trim() ? incoming.trim().slice(0, 100) : generateRequestId()

  req.id = id
  res.set('X-Request-Id', id)

  next()
}

/**
 * requestLogger
 *
 * A small structured access log. It records the method, path, status and
 * duration — never the request body, so customer details never reach the log.
 */
export function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint()

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000

    logger.info(
      {
        requestId: req.id,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
      },
      'request',
    )
  })

  next()
}

export default requestId
