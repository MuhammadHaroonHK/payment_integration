import { z } from 'zod'
import { TRANSACTION_STATUS } from '../models/Transaction.js'

/**
 * Payment request validation.
 *
 * The schema accepts both shapes the API can receive:
 *
 *   { "orderNumber": "PAYLAB-DEMO-XXXX", "gateway": "JAZZCASH" }
 *   { "order": { "orderNumber": "..." }, "customer": {...}, "gateway": "jazzcash" }
 *
 * Amounts are deliberately NOT part of the schema: the server calculates the
 * payable amount itself.
 */

const customerSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  name: z.string().trim().min(2).max(120).optional(),
  email: z.email().max(160).optional(),
  phone: z.string().trim().min(6).max(24).optional(),
  mobile: z.string().trim().min(6).max(24).optional(),
})

export const createPaymentSchema = z.object({
  orderNumber: z.string().trim().min(3).max(64).optional(),
  order: z
    .object({
      orderNumber: z.string().trim().min(3).max(64).optional(),
    })
    .optional(),
  gateway: z.string().trim().min(1).max(32),
  customer: customerSchema.optional(),
  quantity: z.coerce.number().int().min(1).max(20).optional(),
  /**
   * Development-only. It is only honoured when the test controls are enabled
   * on the server — the browser cannot enable them.
   */
  simulatedOutcome: z.enum(Object.values(TRANSACTION_STATUS)).optional(),
})

export const mockOutcomeSchema = z.object({
  outcome: z.enum(Object.values(TRANSACTION_STATUS)),
})

export const transactionIdentifierSchema = z.object({
  transactionId: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .regex(/^[A-Za-z0-9_-]+$/, 'The transaction identifier contains unsupported characters.'),
})

export default { createPaymentSchema, mockOutcomeSchema, transactionIdentifierSchema }
