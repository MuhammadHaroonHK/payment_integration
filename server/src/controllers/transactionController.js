import { asyncHandler } from '../utils/asyncHandler.js'
import { listTransactions, findTransaction, serialiseTransaction } from '../services/transactionService.js'
import { Order } from '../models/Order.js'
import { env } from '../config/env.js'

/**
 * Transaction controller
 *
 * Read-only endpoints for the transaction history.
 */

/**
 * GET /api/payments/transactions
 */
export const getTransactions = asyncHandler(async (req, res) => {
  const filters = req.validated?.query || {}

  const { items, pagination } = await listTransactions(filters)

  res.status(200).json({
    success: true,
    mode: env.PAYMENT_MODE.toUpperCase(),
    data: {
      transactions: items,
      pagination,
    },
    // Kept at the top level as well so a client that expects a bare array
    // can find the list without digging into "data".
    transactions: items,
    pagination,
  })
})

/**
 * GET /api/payments/transactions/:transactionId
 */
export const getTransactionById = asyncHandler(async (req, res) => {
  const { transactionId } = req.validated?.params || {}

  const transaction = await findTransaction(transactionId)
  const order = await Order.findById(transaction.orderId)

  res.status(200).json({
    success: true,
    mode: env.PAYMENT_MODE.toUpperCase(),
    data: serialiseTransaction(transaction, { order }),
  })
})

export default { getTransactions, getTransactionById }
