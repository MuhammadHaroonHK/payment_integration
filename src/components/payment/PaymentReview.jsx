import { formatCurrency, formatDateTime } from '../../utils/formatCurrency'
import { getStatusStyle } from '../../utils/transactionHelpers'

/**
 * PaymentReview
 *
 * Reusable read-only summary of everything that is about to be "paid".
 * Used on the review page and reused for the receipt shown on the result page.
 *
 * Props:
 *   order      order object
 *   totals     calculated totals
 *   customer   {fullName, email, phone}
 *   gateway    gateway details object (from data/gateways.js)
 *   transaction optional transaction record (adds reference + timestamp)
 */
export default function PaymentReview({
  order,
  totals,
  customer,
  gateway,
  transaction = null,
  subtitle = 'Review the details before the demo payment is processed.',
}) {
  const rows = [
    { label: 'Order number', value: order.orderNumber, mono: true },
    { label: 'Product', value: order.productName },
    { label: 'Quantity', value: `${totals.quantity} × ${formatCurrency(totals.unitPrice)}` },
    { label: 'Subtotal', value: formatCurrency(totals.subtotal) },
    { label: 'Service fee', value: formatCurrency(totals.serviceFee) },
  ]

  return (
    <section className="panel overflow-hidden" aria-labelledby="review-heading">
      <header className="panel-header">
        <h2 id="review-heading" className="text-sm font-semibold text-slate-900">
          Payment summary
        </h2>
        <p className="mt-0.5 text-[12px] text-slate-500">{subtitle}</p>
      </header>

      <div className="px-4 py-4">
        <dl className="divide-y divide-slate-100">
          {rows.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-4 py-2.5">
              <dt className="shrink-0 text-[13px] text-slate-500">{row.label}</dt>
              <dd
                className={`text-right text-[13px] font-medium text-slate-900 ${
                  row.mono ? 'font-mono' : ''
                }`}
              >
                {row.value}
              </dd>
            </div>
          ))}

          <div className="flex items-start justify-between gap-4 py-2.5">
            <dt className="text-[13px] text-slate-500">Customer</dt>
            <dd className="text-right text-[13px] font-medium text-slate-900">
              {customer.fullName}
              <span className="block text-[12px] font-normal text-slate-500">{customer.email}</span>
              <span className="block text-[12px] font-normal text-slate-500">{customer.phone}</span>
            </dd>
          </div>

          <div className="flex items-start justify-between gap-4 py-2.5">
            <dt className="text-[13px] text-slate-500">Payment method</dt>
            <dd className="text-right text-[13px] font-medium text-slate-900">
              {gateway ? gateway.name : 'Not selected'}
              {gateway ? (
                <span className="mt-1 block text-[12px] font-normal text-slate-500">
                  {gateway.detail}
                </span>
              ) : null}
            </dd>
          </div>

          {transaction ? (
            <>
              <div className="flex items-start justify-between gap-4 py-2.5">
                <dt className="text-[13px] text-slate-500">Transaction reference</dt>
                <dd className="text-right font-mono text-[13px] font-medium text-slate-900">
                  {transaction.transactionRef}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 py-2.5">
                <dt className="text-[13px] text-slate-500">Recorded at</dt>
                <dd className="text-right text-[13px] font-medium text-slate-900">
                  {formatDateTime(transaction.createdAt)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 py-2.5">
                <dt className="text-[13px] text-slate-500">Transaction status</dt>
                <dd className="text-right">
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-900">
                    <span
                      className={`h-2 w-2 rounded-full ${getStatusStyle(transaction.status).dotClass}`}
                      aria-hidden="true"
                    />
                    {transaction.status}
                  </span>
                </dd>
              </div>
            </>
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
