import { Minus, Plus } from 'lucide-react'
import { formatCurrency } from '../../utils/formatCurrency'

/**
 * OrderSummary
 *
 * Shows everything the customer is about to pay for. Every amount is derived
 * from the order object, so changing the quantity recalculates the totals
 * instantly.
 *
 * Props:
 *   order          {orderNumber, productName, productCode, unitPrice, quantity, serviceFee, currency}
 *   totals         {subtotal, serviceFee, total, quantity}
 *   showQuantity   show the quantity stepper (default true)
 *   onQuantityChange  callback(newQuantity)
 *   gateway        optional gateway details, shown as "Payment method"
 */
export default function OrderSummary({
  order,
  totals,
  showQuantity = true,
  onQuantityChange,
  gateway = null,
}) {
  const canChange = typeof onQuantityChange === 'function'

  const decrease = () => {
    if (!canChange) return
    onQuantityChange(Math.max(1, totals.quantity - 1))
  }

  const increase = () => {
    if (!canChange) return
    onQuantityChange(Math.min(20, totals.quantity + 1))
  }

  return (
    <section className="panel overflow-hidden" aria-labelledby="order-summary-heading">
      <header className="panel-header flex items-center justify-between gap-3">
        <h2 id="order-summary-heading" className="text-sm font-semibold text-slate-900">
          Order summary
        </h2>
        <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-600">
          {order.orderNumber}
        </span>
      </header>

      <div className="px-4 py-4">
        <div className="border-b border-slate-100 pb-4">
          <p className="text-[13px] font-medium text-slate-900">{order.productName}</p>
          <p className="mt-0.5 text-[12px] text-slate-500">{order.productDescription}</p>
          <p className="mt-1 font-mono text-[11px] text-slate-500">{order.productCode}</p>
        </div>

        <dl className="mt-4 space-y-2.5 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-600">Unit price</dt>
            <dd className="tabular text-slate-900">{formatCurrency(totals.unitPrice)}</dd>
          </div>

          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-600">Quantity</dt>
            <dd className="flex items-center gap-2">
              {showQuantity && canChange ? (
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={decrease}
                    disabled={totals.quantity <= 1}
                    aria-label="Decrease quantity"
                    className="flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                  >
                    <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <span className="tabular w-6 text-center text-sm font-medium text-slate-900">
                    {totals.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={increase}
                    disabled={totals.quantity >= 20}
                    aria-label="Increase quantity"
                    className="flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </span>
              ) : (
                <span className="tabular text-slate-900">{totals.quantity}</span>
              )}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-600">Subtotal</dt>
            <dd className="tabular text-slate-900">{formatCurrency(totals.subtotal)}</dd>
          </div>

          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-600">Service fee</dt>
            <dd className="tabular text-slate-900">{formatCurrency(totals.serviceFee)}</dd>
          </div>

          {gateway ? (
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-600">Payment method</dt>
              <dd className="flex items-center gap-1.5 text-slate-900">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: gateway.markerColor }}
                  aria-hidden="true"
                />
                <span className="text-sm font-medium">{gateway.name}</span>
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-4 flex items-center justify-between gap-4 border-t border-slate-200 pt-4">
          <span className="text-sm font-semibold text-slate-900">Total payable</span>
          <span className="tabular text-lg font-semibold text-slate-900">
            {formatCurrency(totals.total)}
          </span>
        </div>

        <p className="mt-1 text-right text-[11px] text-slate-500">
          Amount in {order.currency} (Pakistani Rupee)
        </p>
      </div>
    </section>
  )
}
