import { CheckCircle2, Clock3, HelpCircle, Slash, XCircle } from 'lucide-react'
import { getStatusStyle } from '../../utils/transactionHelpers'

/**
 * StatusBadge
 *
 * Shows the status of a simulated transaction.
 *   - Success  -> restrained brand green
 *   - Failed   -> red
 *   - Pending  -> neutral slate
 *   - Cancelled-> neutral slate
 */

const ICONS = {
  'check-circle-2': CheckCircle2,
  'x-circle': XCircle,
  clock: Clock3,
  'clock-3': Clock3,
  slash: Slash,
  'help-circle': HelpCircle,
}

export default function StatusBadge({ status, size = 'md', className = '' }) {
  const style = getStatusStyle(status)
  const Icon = ICONS[style.icon] || HelpCircle

  const sizing = size === 'sm' ? 'text-[11px] px-2 py-0.5 gap-1' : 'text-xs px-2.5 py-1 gap-1.5'
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'

  return (
    <span
      className={`inline-flex items-center rounded border font-medium uppercase tracking-wide ${style.badgeClass} ${sizing} ${className}`}
    >
      <Icon className={iconSize} aria-hidden="true" />
      {style.label}
    </span>
  )
}
