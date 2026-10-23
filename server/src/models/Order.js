import mongoose from 'mongoose'
import { CURRENCY } from '../utils/money.js'

/**
 * Order model
 *
 * An order is the *trusted* record of what the customer is paying for.
 * Every amount on it is stored in **integer paisa** and is calculated by the
 * server from the demo catalogue — never from a value sent by the browser.
 *
 * Money fields
 *   subtotal     = unitPrice * quantity
 *   serviceFee   = flat fee from the catalogue
 *   totalAmount  = subtotal + serviceFee
 */

export const ORDER_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
}

const orderItemSchema = new mongoose.Schema(
  {
    productCode: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true, maxlength: 240 },
    quantity: { type: Number, required: true, min: 1, max: 20 },
    /** Unit price in paisa. */
    unitPrice: { type: Number, required: true, min: 0 },
    /** quantity * unitPrice, in paisa. */
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
)

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 120, default: '' },
    email: { type: String, trim: true, maxlength: 160, default: '' },
    mobile: { type: String, trim: true, maxlength: 24, default: '' },
  },
  { _id: false },
)

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    customer: { type: customerSchema, default: () => ({}) },

    items: {
      type: [orderItemSchema],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'An order must contain at least one item.',
      },
    },

    /** All money fields are integer paisa. */
    subtotal: { type: Number, required: true, min: 0 },
    serviceFee: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },

    currency: { type: String, default: CURRENCY, enum: [CURRENCY], required: true },

    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PENDING,
      index: true,
    },

    /** Where the order came from (always the server catalogue today). */
    source: { type: String, default: 'DEMO_CATALOGUE', trim: true },

    /**
     * Technical flag used to claim an order for processing.
     *
     * It makes two simultaneous payment requests for the same order safe:
     * only the request that flips this flag to true may charge the order.
     */
    paymentInProgress: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  },
)

orderSchema.index({ createdAt: -1 })
orderSchema.index({ status: 1, createdAt: -1 })

export const Order = mongoose.model('Order', orderSchema)

export default Order
