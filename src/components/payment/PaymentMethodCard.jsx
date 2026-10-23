import { Smartphone, Wallet } from 'lucide-react'

/**
 * PaymentMethodCard
 *
 * A selectable payment method. Built on a real radio input so it works with
 * keyboard navigation (arrow keys, space) and assistive technology.
 *
 * Only one method can be active at a time — the parent controls that by
 * giving every card the same `name`.
 */

const ICONS = {
  smartphone: Smartphone,
  wallet: Wallet,
}

export default function PaymentMethodCard({
  gateway,
  selected = false,
  onSelect,
  disabled = false,
}) {
  const Icon = ICONS[gateway.icon] || Wallet
  const inputId = `gateway-${gateway.id}`

  const handleChange = () => {
    if (disabled) return
    onSelect?.(gateway.id)
  }

  return (
    <label
      htmlFor={inputId}
      className={[
        'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors duration-150 sm:p-4',
        selected
          ? 'border-brand-600 bg-brand-50/40 ring-1 ring-brand-600'
          : 'border-slate-300 bg-white hover:border-slate-400',
        disabled ? 'cursor-not-allowed opacity-60' : '',
      ].join(' ')}
    >
      <input
        id={inputId}
        type="radio"
        name="payment-method"
        value={gateway.id}
        checked={selected}
        onChange={handleChange}
        disabled={disabled}
        className="sr-only peer"
      />

      <span
        aria-hidden="true"
        className={[
          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border',
          selected ? 'border-brand-200 bg-white text-brand-700' : 'border-slate-200 bg-slate-50 text-slate-500',
        ].join(' ')}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={`text-sm font-semibold ${selected ? 'text-brand-800' : 'text-slate-900'}`}
          >
            {gateway.name}
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-600"
            title={`${gateway.name} identifier`}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: gateway.markerColor }}
              aria-hidden="true"
            />
            {gateway.identifier}
          </span>
        </span>

        <span className="mt-1 block text-[13px] leading-relaxed text-slate-600">
          {gateway.description}
        </span>
        <span className="mt-1 block text-[11px] uppercase tracking-wide text-slate-500">
          {gateway.detail}
        </span>
      </span>

      <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center">
        <span
          aria-hidden="true"
          className={[
            'flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors',
            selected ? 'border-brand-600' : 'border-slate-300',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600 peer-focus-visible:ring-offset-2',
          ].join(' ')}
        >
          {selected ? <span className="h-2 w-2 rounded-full bg-brand-600" /> : null}
        </span>
      </span>
    </label>
  )
}
