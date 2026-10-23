/**
 * The server-controlled demo catalogue.
 *
 * ⚠️ This file is the single source of truth for demo pricing.
 *
 * The browser never decides what an order costs. The client may choose a
 * *quantity*, but the unit price and the service fee always come from here,
 * so a tampered request cannot change the payable amount.
 */

export const DEMO_CATALOGUE = {
  productCode: 'PAYLAB-FE-04',
  productName: 'Frontend Engineering Practice — Module 04',
  productDescription: 'Checkout flow, form validation and result states',
  /** PKR 4,500.00 */
  unitPricePaisa: 450_000,
  /** PKR 150.00 */
  serviceFeePaisa: 15_000,
  currency: 'PKR',
  /** How many items a customer may buy in one demo order. */
  maxQuantity: 20,
  /** How many demo orders may be created per hour (basic abuse protection). */
  maxOrdersPerHour: 60,
}

export default DEMO_CATALOGUE
