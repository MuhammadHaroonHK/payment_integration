import { useId } from 'react'

/**
 * Input
 *
 * A labelled text field with optional hint and validation message.
 * The label is always linked to the input via `htmlFor`, and errors are
 * announced with `aria-invalid` + `role="alert"`.
 *
 * Usage:
 *   <Input label="Email address" type="email" value={email} onChange={fn} error={error} />
 */

const BASE_FIELD =
  'w-full rounded-md border bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-0'

function fieldClasses(hasError) {
  return [
    BASE_FIELD,
    hasError
      ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
      : 'border-slate-300 hover:border-slate-400 focus:border-brand-600 focus:ring-brand-100',
    'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
  ].join(' ')
}

export default function Input({
  label,
  type = 'text',
  value,
  onChange,
  error = '',
  hint = '',
  placeholder = '',
  required = false,
  disabled = false,
  autoComplete,
  inputMode,
  name,
  id,
  className = '',
  ...rest
}) {
  const generatedId = useId()
  const fieldId = id || name || generatedId
  const errorId = `${fieldId}-error`
  const hintId = `${fieldId}-hint`

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label ? (
        <label htmlFor={fieldId} className="text-[13px] font-medium text-slate-700">
          {label}
          {required ? (
            <span className="ml-1 text-red-600" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}

      <input
        id={fieldId}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={fieldClasses(Boolean(error))}
        {...rest}
      />

      {error ? (
        <p id={errorId} role="alert" className="text-[13px] text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[13px] text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Select
 *
 * Native select element styled to match Input. Used by the history filters.
 */
export function Select({
  label,
  value,
  onChange,
  options = [],
  id,
  name,
  className = '',
  ...rest
}) {
  const generatedId = useId()
  const fieldId = id || name || generatedId

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label ? (
        <label htmlFor={fieldId} className="text-[13px] font-medium text-slate-700">
          {label}
        </label>
      ) : null}

      <select
        id={fieldId}
        name={name}
        value={value}
        onChange={onChange}
        className={`${BASE_FIELD} border-slate-300 hover:border-slate-400 focus:border-brand-600 focus:ring-brand-100 pr-8`}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
