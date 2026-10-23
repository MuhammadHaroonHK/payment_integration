import { PAYMENT_CONFIG } from '../config/paymentConfig'

/**
 * Format a number as a PKR amount, e.g. 4650 -> "PKR 4,650".
 *
 * @param {number} amount
 * @param {{currency?: string, locale?: string, maximumFractionDigits?: number}} options
 * @returns {string}
 */
export function formatCurrency(amount, options = {}) {
  const {
    currency = PAYMENT_CONFIG.currency,
    locale = PAYMENT_CONFIG.locale,
    maximumFractionDigits = 0,
  } = options

  const value = Number(amount)
  if (!Number.isFinite(value)) return `${currency} 0`

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      // Always spell the currency out ("PKR 4,650") so the amount is
      // unambiguous, whatever the browser's default locale is.
      currencyDisplay: 'code',
      minimumFractionDigits: 0,
      maximumFractionDigits,
    }).format(value)
  } catch {
    // Fallback if an invalid currency/locale combination is supplied.
    return `${currency} ${value.toLocaleString('en-US', { maximumFractionDigits })}`
  }
}

/**
 * Format an ISO date string as "22 Oct 2026, 3:24 PM".
 *
 * @param {string|number|Date} value
 * @returns {string}
 */
export function formatDateTime(value) {
  const date = toDate(value)
  if (!date) return '—'

  const day = date.getDate()
  const month = MONTHS[date.getMonth()]
  const year = date.getFullYear()
  const time = formatTime(date)

  return `${day} ${month} ${year}, ${time}`
}

/**
 * Format an ISO date string as "22 Oct 2026".
 */
export function formatDate(value) {
  const date = toDate(value)
  if (!date) return '—'

  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

/**
 * Format a Date as "3:24 PM".
 */
export function formatTime(value) {
  const date = toDate(value)
  if (!date) return '—'

  const hours = date.getHours()
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const suffix = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 === 0 ? 12 : hours % 12

  return `${displayHours}:${minutes} ${suffix}`
}

function toDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

export default formatCurrency
