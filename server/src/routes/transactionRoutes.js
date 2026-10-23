import { Router } from 'express'
import { validateRequest } from '../middleware/validateRequest.js'
import {
  listTransactionsSchema,
  transactionIdentifierSchema,
} from '../validators/transactionValidator.js'
import { getTransactions, getTransactionById } from '../controllers/transactionController.js'

/**
 * Transaction history routes
 *
 * Mounted at /api/payments/transactions
 */
const router = Router()

/**
 * GET /api/payments/transactions
 */
router.get('/', validateRequest(listTransactionsSchema, 'query'), getTransactions)

/**
 * GET /api/payments/transactions/:transactionId
 */
router.get(
  '/:transactionId',
  validateRequest(transactionIdentifierSchema, 'params'),
  getTransactionById,
)

export default router
