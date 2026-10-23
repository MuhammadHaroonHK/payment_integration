import { FlaskConical } from 'lucide-react'
import { SIMULATED_OUTCOMES } from '../../services/mockPaymentService'

/**
 * SimulatedOutcomeSelector
 *
 * ⚠️ DEVELOPER / TESTING CONTROL — NOT A GATEWAY FEATURE.
 *
 * A real JazzCash or Easypaisa page has no such selector: the outcome is
 * decided by the gateway. This control only exists in the mock service so a
 * developer can exercise every result state (success, failure, cancelled,
 * pending) without a real account.
 *
 * It is intentionally labelled as a test control everywhere it appears.
 */
export default function SimulatedOutcomeSelector({ value, onChange, disabled = false }) {
  return (
    <section
      className="rounded-md border border-dashed border-amber-300 bg-amber-50/60"
      aria-labelledby="simulator-heading"
    >
      <header className="flex items-start gap-2 border-b border-amber-200/80 px-4 py-3">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
        <div>
          <h2 id="simulator-heading" className="text-[13px] font-semibold text-amber-900">
            Developer test control — simulated result
          </h2>
          <p className="mt-0.5 text-[12px] leading-relaxed text-amber-800">
            Choose the outcome the local mock service should return. This is a testing aid only;
            it is never sent to or received from JazzCash or Easypaisa.
          </p>
        </div>
      </header>

      <fieldset className="px-4 py-3" disabled={disabled}>
        <legend className="sr-only">Simulated payment outcome</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {SIMULATED_OUTCOMES.map((outcome) => {
            const isActive = outcome.id === value
            const inputId = `simulated-outcome-${outcome.id}`

            return (
              <label
                key={outcome.id}
                htmlFor={inputId}
                className={[
                  'flex cursor-pointer items-start gap-2.5 rounded border bg-white px-3 py-2.5 transition-colors duration-150',
                  isActive
                    ? 'border-amber-400 ring-1 ring-amber-400'
                    : 'border-slate-300 hover:border-slate-400',
                  disabled ? 'cursor-not-allowed opacity-60' : '',
                ].join(' ')}
              >
                <input
                  id={inputId}
                  type="radio"
                  name="simulated-outcome"
                  value={outcome.id}
                  checked={isActive}
                  onChange={() => onChange?.(outcome.id)}
                  className="sr-only peer"
                />

                <span
                  aria-hidden="true"
                  className={[
                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
                    isActive ? 'border-amber-600' : 'border-slate-300',
                    'peer-focus-visible:ring-2 peer-focus-visible:ring-amber-600 peer-focus-visible:ring-offset-2',
                  ].join(' ')}
                >
                  {isActive ? <span className="h-1.5 w-1.5 rounded-full bg-amber-600" /> : null}
                </span>

                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-slate-900">
                    {outcome.label}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-relaxed text-slate-600">
                    {outcome.description}
                  </span>
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>
    </section>
  )
}
