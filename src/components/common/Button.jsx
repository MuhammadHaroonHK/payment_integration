import { Link } from 'react-router-dom'
import Loader from './Loader'

/**
 * Button
 *
 * One button component for the whole app so every action looks and behaves
 * the same. Render it as a <button> by default, or as a router <Link> when
 * the `to` prop is supplied.
 *
 * Usage:
 *   <Button onClick={handleClick}>Continue</Button>
 *   <Button to="/checkout" variant="primary">Start demo</Button>
 *   <Button loading={isSaving}>Saving…</Button>
 */

const VARIANTS = {
  primary:
    'bg-brand-600 text-white border border-brand-600 hover:bg-brand-700 hover:border-brand-700 disabled:bg-brand-300 disabled:border-brand-300',
  secondary:
    'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 disabled:text-slate-500 disabled:bg-slate-50',
  outline:
    'bg-transparent text-brand-700 border border-brand-300 hover:bg-brand-50 disabled:text-slate-500 disabled:border-slate-200 disabled:hover:bg-transparent',
  danger:
    'bg-white text-red-700 border border-red-300 hover:bg-red-50 disabled:text-red-300 disabled:hover:bg-white',
  ghost:
    'bg-transparent text-slate-700 border border-transparent hover:bg-slate-100 disabled:text-slate-500 disabled:hover:bg-transparent',
}

const SIZES = {
  sm: 'h-9 px-3 text-[13px] gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-[15px] gap-2',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  to,
  onClick,
  loading = false,
  disabled = false,
  fullWidth = false,
  className = '',
  ...rest
}) {
  const isDisabled = disabled || loading
  const classes = [
    'inline-flex items-center justify-center rounded-md font-medium',
    'transition-colors duration-150 select-none',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
    'disabled:cursor-not-allowed',
    SIZES[size],
    VARIANTS[variant],
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const content = (
    <>
      {loading ? <Loader size="sm" className="shrink-0" /> : null}
      <span className="truncate">{children}</span>
    </>
  )

  if (to) {
    return (
      <Link to={to} className={classes} aria-disabled={isDisabled} onClick={onClick} {...rest}>
        {content}
      </Link>
    )
  }

  return (
    <button type={type} className={classes} onClick={onClick} disabled={isDisabled} {...rest}>
      {content}
    </button>
  )
}
