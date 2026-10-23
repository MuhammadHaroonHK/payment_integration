import { Link } from 'react-router-dom'
import { PAYMENT_CONFIG } from '../../config/paymentConfig'

/**
 * Footer
 *
 * Small, factual footer. It repeats the "simulation only" message on every
 * page so the user is never in doubt about what the app does.
 */
export default function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-slate-900 text-[11px] font-bold text-white">
            P
          </span>
          <span className="text-[13px] font-medium text-slate-700">PayLab</span>
          <span className="text-[13px] text-slate-500">·</span>
          <span className="text-[13px] text-slate-500">Payment Gateway Integration Practice</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
          <Link
            to="/checkout"
            className="inline-flex items-center py-2 text-slate-600 transition-colors hover:text-brand-700"
          >
            Checkout
          </Link>
          <Link
            to="/transactions"
            className="inline-flex items-center py-2 text-slate-600 transition-colors hover:text-brand-700"
          >
            Transactions
          </Link>
          <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
            {PAYMENT_CONFIG.isMock
              ? 'Simulated payments — no real money moves'
              : 'Backend mode — requests are sent to the API'}
          </span>
        </div>
      </div>
    </footer>
  )
}
