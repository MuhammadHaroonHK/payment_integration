import { Link, NavLink } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { PAYMENT_CONFIG } from '../../config/paymentConfig'

/**
 * Navbar
 *
 * Top navigation. On small screens the links collapse into a menu panel so
 * nothing ever overflows horizontally.
 */

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/checkout', label: 'Checkout' },
  { to: '/transactions', label: 'Transactions' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)

  const linkClass = ({ isActive }) =>
    [
      'inline-flex h-9 items-center rounded-md px-3 text-sm font-medium transition-colors duration-150',
      isActive
        ? 'bg-brand-50 text-brand-700'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    ].join(' ')

  const mobileLinkClass = ({ isActive }) =>
    [
      'flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150',
      isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-100',
    ].join(' ')

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-600 text-sm font-bold text-white">
            P
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[15px] font-semibold tracking-tight text-slate-900">PayLab</span>
            <span className="mt-0.5 hidden text-[11px] text-slate-500 sm:block">
              Payment Gateway Practice
            </span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
              {link.label}
            </NavLink>
          ))}
          <span className="ml-2 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-600">
            {PAYMENT_CONFIG.isMock ? 'Demo mode' : 'Backend mode'}
          </span>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 text-slate-700 transition-colors hover:bg-slate-100 md:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
        >
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>

      {open ? (
        <nav id="mobile-nav" className="border-t border-slate-200 bg-white px-4 py-2 md:hidden">
          <ul className="flex flex-col gap-1 pb-2">
            {LINKS.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.end}
                  className={mobileLinkClass}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <p className="border-t border-slate-100 px-3 pb-2 pt-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            {PAYMENT_CONFIG.isMock ? 'Demo mode — simulated payments' : 'Backend mode — server API'}
          </p>
        </nav>
      ) : null}
    </header>
  )
}
