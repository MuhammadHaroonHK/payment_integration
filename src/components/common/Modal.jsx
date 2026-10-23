import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'

/**
 * Modal
 *
 * One dialog component for the whole app, so every overlay looks and behaves
 * the same way.
 *
 * Behaviour:
 *   - closes on Escape
 *   - closes when the backdrop is pressed
 *   - locks the page behind it while it is open
 *   - moves the focus into the dialog and gives it back on close
 *
 * Usage:
 *   <Modal open={open} onClose={handleClose} title="Transaction details">
 *     …
 *   </Modal>
 */

const SIZES = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
}

export default function Modal({
  open = false,
  onClose,
  title = '',
  description = '',
  children = null,
  footer = null,
  size = 'md',
}) {
  const titleId = useId()
  const panelRef = useRef(null)
  const closeRef = useRef(onClose)
  const restoreFocusRef = useRef(null)

  // Keep the latest callback without re-running the open/close effect, so the
  // focus is not thrown back and forth on every render.
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return undefined

    restoreFocusRef.current = document.activeElement

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      closeRef.current?.()
    }

    document.addEventListener('keydown', handleKeyDown)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Move the focus into the dialog, otherwise keyboard users stay behind it.
    panelRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow

      const previous = restoreFocusRef.current
      if (previous && typeof previous.focus === 'function') previous.focus()
    }
  }, [open])

  if (!open) return null

  const handleBackdropMouseDown = (event) => {
    // Only close when the press started on the backdrop itself.
    if (event.target === event.currentTarget) closeRef.current?.()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-900/50 sm:items-center sm:p-4"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`panel flex max-h-[92vh] w-full flex-col rounded-b-none sm:rounded-b-[0.5rem] ${SIZES[size]}`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            {title ? (
              <h2 id={titleId} className="text-sm font-semibold text-slate-900">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">{description}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => closeRef.current?.()}
            aria-label="Close dialog"
            className="-mr-1 shrink-0 rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>

        {footer ? (
          <footer className="border-t border-slate-200 px-4 py-3 sm:px-5">{footer}</footer>
        ) : null}
      </div>
    </div>
  )
}
