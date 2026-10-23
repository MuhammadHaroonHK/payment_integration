import { Router } from 'express'
import { validateRequest } from '../middleware/validateRequest.js'
import { demoOrderLimiter } from '../middleware/rateLimit.js'
import { demoOrderSchema } from '../validators/orderValidator.js'
import { getDemoOrder } from '../controllers/orderController.js'

/**
 * Order routes
 *
 * Mounted at /api/orders
 */
const router = Router()

/**
 * GET /api/orders/demo
 */
router.get(
  '/demo',
  demoOrderLimiter,
  validateRequest(demoOrderSchema, 'query'),
  getDemoOrder,
)

export default router
