import mongoose from 'mongoose'
import { CURRENCY } from '../utils/money.js'

/**
 * Transaction model
 *
 * One record per payment attempt.
 *
 * ⚠️ Security rules for this collection:
 *   - no passwords, PINs, OTPs, card data or banking credentials are stored
 *   - no gateway secrets or raw authentication payloads are stored
 *   - `gatewayReference` is always clearly labelled as simulated while the
 *     mock provider is in use
 */

export const TRANSACTION_STATUS = {
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
}

export const GATEWAY = {
  JAZZCASH: 'JAZZCASH',
  EASYPAISA: 'EASYPAISA',
}

export const TRANSACTION_MODE = {
  /** Produced by the local simulator — no provider was contacted. */
  MOCK: 'MOCK',
  /** Produced by a real JazzCash / Easypaisa hosted checkout. */
  LIVE: 'LIVE',
}

const transactionSchema = new mongoose.Schema(
  {
    /** Server generated, unique, human readable. */
    transactionReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    orderNumber: { type: String, required: true, trim: true, index: true },

    gateway: {
      type: String,
      enum: Object.values(GATEWAY),
      required: true,
      index: true,
    },

    /** Amount in paisa. */
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: CURRENCY, enum: [CURRENCY], required: true },

    status: {
      type: String,
      enum: Object.values(TRANSACTION_STATUS),
      required: true,
      index: true,
    },

    /** Which provider produced this transaction. */
    mode: {
      type: String,
      enum: Object.values(TRANSACTION_MODE),
      default: TRANSACTION_MODE.MOCK,
      required: true,
      index: true,
    },

    /** Set when the payment did not succeed. */
    failureReason: { type: String, default: null, maxlength: 500 },

    /**
     * Reference returned by the provider.
     * While the mock provider is used this always starts with "SIM-MOCK-",
     * so it can never be mistaken for an official gateway reference.
     */
    gatewayReference: { type: String, default: null, trim: true },

    /**
     * The reference PayLab sent to the provider (JazzCash pp_TxnRefNo,
     * Easypaisa orderRefNum). It is the key used to match a callback back to
     * this transaction, and to ask the provider for the real status.
     */
    gatewayTxnRef: { type: String, default: null, trim: true },

    /**
     * True only when the outcome was confirmed by a verified, signed gateway
     * callback or by the provider's status inquiry API.
     */
    gatewayVerified: { type: Boolean, default: false },

    /** Which gateway environment handled a live transaction. */
    gatewayEnvironment: {
      type: String,
      enum: ['sandbox', 'production', null],
      default: null,
    },

    /** True while the transaction came from the simulator. */
    simulated: { type: Boolean, default: false },

    /** Money breakdown that was actually charged (paisa). */
    breakdown: {
      unitPrice: { type: Number, default: 0, min: 0 },
      subtotal: { type: Number, default: 0, min: 0 },
      serviceFee: { type: Number, default: 0, min: 0 },
      total: { type: Number, default: 0, min: 0 },
      quantity: { type: Number, default: 1, min: 1 },
    },

    /** Snapshot of the customer details used for this payment. */
    customer: {
      name: { type: String, default: '', trim: true, maxlength: 120 },
      email: { type: String, default: '', trim: true, maxlength: 160 },
      mobile: { type: String, default: '', trim: true, maxlength: 24 },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
)

/* ------------------------------- indexes ------------------------------- */

// Frequently used filters.
transactionSchema.index({ gateway: 1, status: 1, createdAt: -1 })
transactionSchema.index({ status: 1, createdAt: -1 })
transactionSchema.index({ orderNumber: 1, createdAt: -1 })
transactionSchema.index({ createdAt: -1 })
// Callback lookup.
transactionSchema.index({ gatewayTxnRef: 1 })

/**
 * Database level protection against paying the same order twice.
 *
 * The partial unique index only applies to SUCCESS transactions, so a failed
 * or pending attempt never blocks a new one.
 */
transactionSchema.index(
  { orderId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'SUCCESS' },
    name: 'one_successful_payment_per_order',
  },
)

export const Transaction = mongoose.model('Transaction', transactionSchema)

export default Transaction
