/**
 * Money helpers.
 *
 * All monetary values are stored and calculated as **integer Pakistani paisa**
 * (1 PKR = 100 paisa). Floating point rupees would introduce rounding errors
 * such as 0.1 + 0.2 !== 0.3, which is unacceptable for an amount of money.
 *
 * The API returns both the raw paisa value (for machines) and a formatted
 * string (for humans).
 */

export const CURRENCY = 'PKR'
export const PAISA_PER_RUPEE = 100

/**
 * Convert rupees to paisa.
 *
 * @param {number|string} rupees
 * @returns {number} integer paisa
 */
export function toPaisa(rupees) {
  const value = Number(rupees)
  if (!Number.isFinite(value)) return 0
  return Math.round(value * PAISA_PER_RUPEE)
}

/**
 * Convert paisa to rupees.
 *
 * @param {number} paisa
 * @returns {number} rupees
 */
export function toRupees(paisa) {
  const value = Number(paisa)
  if (!Number.isFinite(value)) return 0
  return Math.round(value) / PAISA_PER_RUPEE
}

/**
 * Format an amount in paisa as a readable PKR string.
 *
 * @param {number} paisa
 * @returns {string} e.g. "PKR 4,650"
 */
export function formatPKR(paisa) {
  const amount = toRupees(paisa)

  try {
    const formatted = new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: CURRENCY,
      currencyDisplay: 'code',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)

    // Intl inserts a non-breaking space between the currency code and the
    // number. A normal space keeps the API response easy to compare and to
    // copy.
    return formatted.replace(/\u00A0/g, ' ')
  } catch {
    return `${CURRENCY} ${amount.toFixed(2)}`
  }
}

/**
 * Build the money breakdown of an order.
 *
 * @param {{unitPricePaisa:number, serviceFeePaisa:number, quantity:number}} input
 * @returns {{subtotal:number, serviceFee:number, total:number, quantity:number}}
 */
export function buildBreakdown({ unitPricePaisa, serviceFeePaisa, quantity }) {
  const safeQuantity = Math.max(1, Number(quantity) || 1)
  const subtotal = Math.round(unitPricePaisa) * safeQuantity
  const serviceFee = Math.round(serviceFeePaisa)
  const total = subtotal + serviceFee

  return { subtotal, serviceFee, total, quantity: safeQuantity }
}
