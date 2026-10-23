/**
 * Loader
 *
 * A small, non-animated spin indicator used for buttons and inline loading
 * states. It is intentionally plain: no gradients, no pulsing decoration.
 */
export default function Loader({ size = 'md', label = '', className = '' }) {
  const sizes = {
    sm: 'h-3.5 w-3.5 border-2',
    md: 'h-5 w-5 border-2',
    lg: 'h-7 w-7 border-[3px]',
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`} role="status" aria-live="polite">
      <span
        className={`${sizes[size]} inline-block rounded-full border-current border-r-transparent animate-spin`}
        aria-hidden="true"
      />
      {label ? <span className="text-sm text-slate-600">{label}</span> : null}
      <span className="sr-only">{label || 'Loading'}</span>
    </span>
  )
}
