/**
 * Sample order used by the demo checkout.
 *
 * The order lives in React state (see PaymentContext) so the quantity can be
 * changed and every total is recalculated on the fly.
 */

export const DEMO_ORDER = {
  orderNumber: 'PL-2026-00142',
  productCode: 'PAYLAB-FE-04',
  productName: 'Frontend Engineering Practice — Module 04',
  productDescription: 'Checkout flow, form validation and result states',
  unitPrice: 4500,
  quantity: 1,
  serviceFee: 150,
  currency: 'PKR',
}

/**
 * Calculate every amount for an order.
 *
 * @param {object} order order object (any shape containing unitPrice/quantity/serviceFee)
 * @returns {{subtotal:number, serviceFee:number, total:number, quantity:number}}
 */
export function calculateOrderTotals(order) {
  const unitPrice = Number(order?.unitPrice) || 0
  const quantity = Math.max(1, Number(order?.quantity) || 1)
  const serviceFee = Number(order?.serviceFee) || 0
  const subtotal = unitPrice * quantity

  return {
    quantity,
    unitPrice,
    subtotal,
    serviceFee,
    total: subtotal + serviceFee,
  }
}

export default DEMO_ORDER
