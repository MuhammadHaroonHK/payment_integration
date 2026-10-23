/**
 * Pakistan Standard Time helpers.
 *
 * Both gateways expect their timestamps in Pakistan time and reject a request
 * whose date/time does not look like `yyyyMMddHHmmss` (JazzCash) or
 * `yyyyMMdd HHmmss` (Easypaisa). The server may run anywhere, so the date is
 * always converted to Asia/Karachi explicitly instead of relying on the
 * machine's local time zone.
 */

const TIME_ZONE = 'Asia/Karachi'

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

/**
 * The date and time in Pakistan, as numeric parts.
 *
 * @param {Date} [date]
 * @returns {{yyyy: string, MM: string, dd: string, HH: string, mm: string, ss: string}}
 */
export function pktParts(date = new Date()) {
  const parts = Object.fromEntries(
    partsFormatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )

  return {
    yyyy: parts.year,
    MM: parts.month,
    dd: parts.day,
    HH: parts.hour,
    mm: parts.minute,
    ss: parts.second,
  }
}

/** `yyyyMMddHHmmss` — the JazzCash format. */
export function formatPktDateTime(date = new Date()) {
  const p = pktParts(date)
  return `${p.yyyy}${p.MM}${p.dd}${p.HH}${p.mm}${p.ss}`
}

/** `yyyyMMdd HHmmss` — the Easypaisa expiry format. */
export function formatPktExpiry(date = new Date()) {
  const p = pktParts(date)
  return `${p.yyyy}${p.MM}${p.dd} ${p.HH}${p.mm}${p.ss}`
}

/**
 * Add hours without mutating the input date.
 *
 * @param {Date} date
 * @param {number} hours
 */
export function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000)
}

export default { pktParts, formatPktDateTime, formatPktExpiry, addHours }
