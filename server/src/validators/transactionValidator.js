import { z } from 'zod'
import { GATEWAY, TRANSACTION_STATUS } from '../models/Transaction.js'

/**
 * Transaction list filters.
 *
 * "all" is accepted as a value for gateway and status so the frontend can
 * pass its own "no filter" option straight through.
 */

const gatewayFilter = z
  .union([z.enum(Object.values(GATEWAY)), z.literal('all')])
  .optional()

const statusFilter = z
  .union([z.enum(Object.values(TRANSACTION_STATUS)), z.literal('all')])
  .optional()

export const listTransactionsSchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  gateway: gatewayFilter,
  status: statusFilter,
  search: z.string().trim().max(120).optional(),
})

export const transactionIdentifierSchema = z.object({
  transactionId: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .regex(/^[A-Za-z0-9_-]+$/, 'The transaction identifier contains unsupported characters.'),
})

export default { listTransactionsSchema, transactionIdentifierSchema }
