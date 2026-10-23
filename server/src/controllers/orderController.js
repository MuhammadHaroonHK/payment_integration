import { asyncHandler } from '../utils/asyncHandler.js'
import { createDemoOrder, serialiseOrder } from '../services/orderService.js'
import { env } from '../config/env.js'
import { isGatewayConfigured } from '../services/gateways/gatewayFactory.js'

/**
 * Order controller
 */

/**
 * GET /api/orders/demo
 *
 * Creates a fresh demo order from the server controlled catalogue and
 * returns it. The client never sends prices — it only receives them.
 */
export const getDemoOrder = asyncHandler(async (req, res) => {
  const { quantity } = req.validated?.query || {}

  const order = await createDemoOrder({ quantity })

  res.status(201).json({
    success: true,
    mode: env.PAYMENT_MODE.toUpperCase(),
    message: 'Demo order created from the server catalogue.',
    data: serialiseOrder(order),
    /**
     * The frontend uses this to decide whether the development-only outcome
     * control may be shown. The browser can never enable it by itself.
     */
    capabilities: {
      testControlsEnabled: env.testControlsEnabled,
      /** MOCK or LIVE — used by the UI to word the review screen correctly. */
      mode: env.PAYMENT_MODE.toUpperCase(),
      /**
       * A live gateway can only be selected when its credentials exist on the
       * server. The browser never sees the credentials themselves.
       */
      gateways: {
        jazzcash: isGatewayConfigured('JAZZCASH'),
        easypaisa: isGatewayConfigured('EASYPAISA'),
      },
    },
  })
})

export default { getDemoOrder }
