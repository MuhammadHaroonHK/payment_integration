import { Inbox } from 'lucide-react'

/**
 * EmptyState
 *
 * Shown when a list has no records (e.g. the transaction history after
 * filtering everything away).
 */
export default function EmptyState({
  title = 'Nothing to show',
  description = '',
  action = null,
  icon: Icon = Inbox,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className}`}>
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
        <Icon className="h-5 w-5 text-slate-500" aria-hidden="true" />
      </span>

      <h3 className="mt-4 text-sm font-semibold text-slate-800">{title}</h3>

      {description ? (
        <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-slate-500">{description}</p>
      ) : null}

      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
