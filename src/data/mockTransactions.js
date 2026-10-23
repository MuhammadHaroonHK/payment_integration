/**
 * Seed transactions for the demo history page.
 *
 * These are hand-written sample records so the history table has something to
 * show on a fresh install. They are plain demo data, not real payments.
 *
 * Each record carries a small snapshot of the order it belonged to, exactly
 * like the transactions created by the mock service. That way the result page
 * can describe a transaction on its own, even when it is opened directly.
 */

/** Build the order + totals snapshot for a seed record. */
function snapshot({ orderNumber, quantity, unitPrice, serviceFee, productName }) {
  const subtotal = unitPrice * quantity

  return {
    order: {
      orderNumber,
      productName,
      productCode: 'PAYLAB-FE-04',
      productDescription: 'Checkout flow, form validation and result states',
      unitPrice,
      quantity,
      serviceFee,
      currency: 'PKR',
    },
    totals: {
      unitPrice,
      quantity,
      subtotal,
      serviceFee,
      total: subtotal + serviceFee,
    },
  }
}

export const MOCK_TRANSACTIONS = [
  {
    id: 'txn_demo_0001',
    transactionRef: 'JC-7F3K9Q',
    orderNumber: 'PL-2026-00137',
    gateway: 'jazzcash',
    amount: 4650,
    currency: 'PKR',
    status: 'SUCCESS',
    reason: '',
    customerName: 'Ayesha Khan',
    customerEmail: 'ayesha.khan@example.com',
    customerPhone: '03001234567',
    createdAt: '2026-10-18T09:24:00.000Z',
    ...snapshot({
      orderNumber: 'PL-2026-00137',
      quantity: 1,
      unitPrice: 4500,
      serviceFee: 150,
      productName: 'Frontend Engineering Practice — Module 04',
    }),
    customer: {
      fullName: 'Ayesha Khan',
      email: 'ayesha.khan@example.com',
      phone: '03001234567',
    },
  },
  {
    id: 'txn_demo_0002',
    transactionRef: 'EP-2M8R4T',
    orderNumber: 'PL-2026-00138',
    gateway: 'easypaisa',
    amount: 9200,
    currency: 'PKR',
    status: 'SUCCESS',
    reason: '',
    customerName: 'Bilal Ahmed',
    customerEmail: 'bilal.ahmed@example.com',
    customerPhone: '03011234567',
    createdAt: '2026-10-18T13:02:00.000Z',
    ...snapshot({
      orderNumber: 'PL-2026-00138',
      quantity: 2,
      unitPrice: 4500,
      serviceFee: 200,
      productName: 'Frontend Engineering Practice — Module 04',
    }),
    customer: {
      fullName: 'Bilal Ahmed',
      email: 'bilal.ahmed@example.com',
      phone: '03011234567',
    },
  },
  {
    id: 'txn_demo_0003',
    transactionRef: 'JC-4X1P6D',
    orderNumber: 'PL-2026-00139',
    gateway: 'jazzcash',
    amount: 4650,
    currency: 'PKR',
    status: 'FAILED',
    reason: 'Simulated decline — insufficient wallet balance.',
    customerName: 'Usman Tariq',
    customerEmail: 'usman.tariq@example.com',
    customerPhone: '03021234567',
    createdAt: '2026-10-19T11:47:00.000Z',
    ...snapshot({
      orderNumber: 'PL-2026-00139',
      quantity: 1,
      unitPrice: 4500,
      serviceFee: 150,
      productName: 'Frontend Engineering Practice — Module 04',
    }),
    customer: {
      fullName: 'Usman Tariq',
      email: 'usman.tariq@example.com',
      phone: '03021234567',
    },
  },
  {
    id: 'txn_demo_0004',
    transactionRef: 'EP-9Q5W2N',
    orderNumber: 'PL-2026-00140',
    gateway: 'easypaisa',
    amount: 9300,
    currency: 'PKR',
    status: 'PENDING',
    reason: 'Simulated pending state — the transaction has not reached a final state.',
    customerName: 'Hina Aslam',
    customerEmail: 'hina.aslam@example.com',
    customerPhone: '03031234567',
    createdAt: '2026-10-20T08:15:00.000Z',
    ...snapshot({
      orderNumber: 'PL-2026-00140',
      quantity: 2,
      unitPrice: 4500,
      serviceFee: 300,
      productName: 'Frontend Engineering Practice — Module 04',
    }),
    customer: {
      fullName: 'Hina Aslam',
      email: 'hina.aslam@example.com',
      phone: '03031234567',
    },
  },
  {
    id: 'txn_demo_0005',
    transactionRef: 'JC-1L6V8H',
    orderNumber: 'PL-2026-00141',
    gateway: 'jazzcash',
    amount: 4500,
    currency: 'PKR',
    status: 'CANCELLED',
    reason: 'Simulated cancellation — the customer aborted the demo payment.',
    customerName: 'Omar Saeed',
    customerEmail: 'omar.saeed@example.com',
    customerPhone: '03041234567',
    createdAt: '2026-10-21T16:31:00.000Z',
    ...snapshot({
      orderNumber: 'PL-2026-00141',
      quantity: 1,
      unitPrice: 4500,
      serviceFee: 0,
      productName: 'Frontend Engineering Practice — Module 04',
    }),
    customer: {
      fullName: 'Omar Saeed',
      email: 'omar.saeed@example.com',
      phone: '03041234567',
    },
  },
  {
    id: 'txn_demo_0006',
    transactionRef: 'EP-8T3B5Y',
    orderNumber: 'PL-2026-00141',
    gateway: 'easypaisa',
    amount: 4650,
    currency: 'PKR',
    status: 'SUCCESS',
    reason: '',
    customerName: 'Sana Javed',
    customerEmail: 'sana.javed@example.com',
    customerPhone: '03051234567',
    createdAt: '2026-10-22T10:05:00.000Z',
    ...snapshot({
      orderNumber: 'PL-2026-00141',
      quantity: 1,
      unitPrice: 4500,
      serviceFee: 150,
      productName: 'Frontend Engineering Practice — Module 04',
    }),
    customer: {
      fullName: 'Sana Javed',
      email: 'sana.javed@example.com',
      phone: '03051234567',
    },
  },
]

export default MOCK_TRANSACTIONS
