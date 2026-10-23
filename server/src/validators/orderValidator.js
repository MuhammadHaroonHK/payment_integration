import { z } from 'zod'
import { DEMO_CATALOGUE } from '../config/demoCatalogue.js'

/**
 * Demo order query parameters.
 */
export const demoOrderSchema = z.object({
  quantity: z.coerce
    .number()
    .int()
    .min(1)
    .max(DEMO_CATALOGUE.maxQuantity)
    .default(1),
})

export default { demoOrderSchema }
