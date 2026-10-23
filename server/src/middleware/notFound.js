import { ApiError } from '../utils/ApiError.js'

/**
 * notFound
 *
 * Catches every request that did not match a route and turns it into a
 * standard 404 response.
 */
export function notFound(req, res, next) {
  next(
    new ApiError(404, 'NOT_FOUND', `No route matches ${req.method} ${req.originalUrl.split('?')[0]}.`),
  )
}

export default notFound
