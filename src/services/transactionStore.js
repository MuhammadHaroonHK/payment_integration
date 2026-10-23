import { PAYMENT_CONFIG } from '../config/paymentConfig'
import { MOCK_TRANSACTIONS } from '../data/mockTransactions'

/**
 * Local demo transaction store (browser localStorage).
 *
 * ⚠️ IMPORTANT
 * These records are LOCAL DEMO DATA ONLY.
 * - They live in the browser of whoever used the demo.
 * - They are not authoritative, not secure and not stored by any server.
 * - Anyone with access to the browser can read or edit them.
 * - A real backend must keep payment records in a real database.
 *
 * The store exists so that transactions created during the demo also show up
 * on the transaction history page.
 */

const STORAGE_KEY = PAYMENT_CONFIG.storageKeys.transactions

function isStorageAvailable() {
  try {
    const probe = '__paylab_probe__'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

const storageAvailable = typeof window !== 'undefined' && isStorageAvailable()

/**
 * Read the demo transactions saved in this browser.
 * Falls back to the seed records when storage is unavailable.
 */
export function readTransactions() {
  if (!storageAvailable) return [...MOCK_TRANSACTIONS]

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return [...MOCK_TRANSACTIONS]

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return [...MOCK_TRANSACTIONS]
    return parsed
  } catch {
    return [...MOCK_TRANSACTIONS]
  }
}

/**
 * Persist the full list of demo transactions.
 */
export function writeTransactions(transactions) {
  if (!storageAvailable) return false
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions))
    return true
  } catch {
    return false
  }
}

/**
 * Add one demo transaction to the store.
 */
export function appendTransaction(transaction) {
  const current = readTransactions()
  const next = [transaction, ...current.filter((item) => item.id !== transaction.id)]
  writeTransactions(next)
  return next
}

/**
 * Find a single demo transaction by its internal id or transaction reference.
 */
export function findTransaction(id) {
  if (!id) return null
  const target = String(id).toLowerCase()
  return (
    readTransactions().find(
      (transaction) =>
        String(transaction.id).toLowerCase() === target ||
        String(transaction.transactionRef || '').toLowerCase() === target,
    ) || null
  )
}

/**
 * Remove every demo transaction (used by the "reset demo data" action).
 */
export function clearTransactions() {
  if (!storageAvailable) return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore — storage is optional */
  }
}

export { storageAvailable }
