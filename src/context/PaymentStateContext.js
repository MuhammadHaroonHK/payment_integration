import { createContext } from 'react'

/**
 * The React context object itself.
 *
 * It lives in its own file (instead of inside PaymentContext.jsx) so that
 * both the provider and the hooks can import it without creating a circular
 * dependency.
 *
 * Note: the file name differs from PaymentContext.jsx on purpose — on a
 * case-insensitive file system (Windows / macOS) two files that only differ
 * by case cannot be resolved reliably.
 */
export const PaymentContext = createContext(null)

export default PaymentContext
