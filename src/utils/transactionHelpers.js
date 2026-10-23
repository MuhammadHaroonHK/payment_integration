/**
 * Helpers shared by the mock service, the result page and the history page.
 */

export const TRANSACTION_STATUS = {
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  PENDING: 'PENDING',
}

export const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: TRANSACTION_STATUS.SUCCESS, label: 'Success' },
  { value: TRANSACTION_STATUS.FAILED, label: 'Failed' },
  { value: TRANSACTION_STATUS.CANCELLED, label: 'Cancelled' },
  { value: TRANSACTION_STATUS.PENDING, label: 'Pending' },
]

/** Visual treatment for each status. Neutral tones for pending / cancelled. */
export const STATUS_STYLES = {
  SUCCESS: {
    label: 'Success',
    badgeClass: 'bg-brand-50 text-brand-800 border-brand-200',
    dotClass: 'bg-brand-600',
    icon: 'check-circle-2',
  },
  FAILED: {
    label: 'Failed',
    badgeClass: 'bg-red-50 text-red-800 border-red-200',
    dotClass: 'bg-red-600',
    icon: 'x-circle',
  },
  CANCELLED: {
    label: 'Cancelled',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    dotClass: 'bg-slate-500',
    icon: 'slash',
  },
  PENDING: {
    label: 'Pending',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    dotClass: 'bg-slate-400',
    icon: 'clock-3',
  },
}

export function getStatusStyle(status) {
  return (
    STATUS_STYLES[status] || {
      label: status || 'Unknown',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
      dotClass: 'bg-slate-400',
      icon: 'help-circle',
    }
  )
}

/**
 * Build a readable demo transaction reference, e.g. "JC-7F3K9Q".
 * The prefix comes from the gateway so references stay recognisable.
 */
export function generateTransactionRef(gatewayCode = 'PL') {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let suffix = ''
  for (let i = 0; i < 6; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return `${gatewayCode}-${suffix}`
}

/**
 * Internal id for a demo transaction.
 */
export function generateTransactionId() {
  return `txn_demo_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Clearly labelled *simulated* gateway reference.
 *
 * The "SIM-" prefix makes it obvious that this id was produced by the local
 * simulator and is not an official JazzCash or Easypaisa transaction id. The
 * server uses the same convention.
 *
 * @param {string} gateway gateway id, e.g. 'jazzcash'
 */
export function generateSimulatedGatewayRef(gateway = 'PL') {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  let code = ''
  for (let i = 0; i < 8; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return `SIM-MOCK-${String(gateway).toUpperCase()}-${code}`
}

/**
 * Read the customer of a transaction, whichever shape the record uses.
 *
 * A record may keep the customer in three different ways:
 *   - flat fields:  customerName / customerEmail / customerPhone
 *   - an object:   customer: { fullName | name, email, phone | mobile }
 *   - only one of the two (older demo records)
 *
 * The UI should not have to care, so every page reads the customer through
 * this helper and always gets the same shape back.
 *
 * @param {object} transaction
 * @returns {{fullName: string, email: string, phone: string}}
 */
export function getTransactionCustomer(transaction) {
  const source = transaction || {}
  const customer = source.customer || {}

  return {
    fullName: customer.fullName || customer.name || source.customerName || '',
    email: customer.email || source.customerEmail || '',
    phone: customer.phone || customer.mobile || source.customerPhone || '',
  }
}

/**
 * Read the order snapshot of a transaction, with sensible fallbacks.
 *
 * @param {object} transaction
 * @returns {object} the order details
 */
export function getTransactionOrder(transaction) {
  const source = transaction || {}
  const order = source.order || {}
  const totals = source.totals || {}

  return {
    orderNumber: source.orderNumber || order.orderNumber || '',
    productName: order.productName || order.name || '',
    productCode: order.productCode || '',
    productDescription: order.productDescription || order.description || '',
    unitPrice: Number(order.unitPrice ?? totals.unitPrice ?? 0),
    quantity: Number(order.quantity ?? totals.quantity ?? 1),
    serviceFee: Number(order.serviceFee ?? totals.serviceFee ?? 0),
    currency: order.currency || source.currency || 'PKR',
  }
}

/**
 * Read the money breakdown of a transaction, with sensible fallbacks.
 *
 * @param {object} transaction
 * @returns {{quantity: number, unitPrice: number, subtotal: number, serviceFee: number, total: number}}
 */
export function getTransactionTotals(transaction) {
  const source = transaction || {}
  const totals = source.totals || {}
  const order = source.order || {}

  const quantity = Number(totals.quantity ?? order.quantity ?? 1)
  const unitPrice = Number(totals.unitPrice ?? order.unitPrice ?? 0)
  const subtotal = Number(totals.subtotal ?? unitPrice * quantity)
  const serviceFee = Number(totals.serviceFee ?? order.serviceFee ?? 0)
  const total = Number(totals.total ?? source.amount ?? subtotal + serviceFee)

  return { quantity, unitPrice, subtotal, serviceFee, total }
}

/**
 * Match a transaction against a free text search.
 *
 * Matches the order number, the reference, the internal id and the customer
 * who made the payment (name, email or mobile number).
 */
export function matchesSearch(transaction, query) {
  const term = String(query || '').trim().toLowerCase()
  if (!term) return true

  const customer = getTransactionCustomer(transaction)

  return (
    String(transaction.orderNumber || '').toLowerCase().includes(term) ||
    String(transaction.transactionRef || '').toLowerCase().includes(term) ||
    String(transaction.id || '').toLowerCase().includes(term) ||
    String(customer.fullName || '').toLowerCase().includes(term) ||
    String(customer.email || '').toLowerCase().includes(term) ||
    String(customer.phone || '').toLowerCase().includes(term)
  )
}

/**
 * Filter a list of transactions by gateway, status and search term.
 */
export function filterTransactions(transactions, { gateway = 'all', status = 'all', search = '' } = {}) {
  return (transactions || []).filter((transaction) => {
    if (gateway !== 'all' && transaction.gateway !== gateway) return false
    if (status !== 'all' && transaction.status !== status) return false
    return matchesSearch(transaction, search)
  })
}

/**
 * Sort newest first.
 */
export function sortByNewest(transactions) {
  return [...(transactions || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}
