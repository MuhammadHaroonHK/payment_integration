import { useEffect, useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import Button from '../common/Button'
import Loader from '../common/Loader'
import Modal from '../common/Modal'
import StatusBadge from '../common/StatusBadge'
import { getGatewayById } from '../../data/gateways'
import { formatCurrency, formatDateTime } from '../../utils/formatCurrency'
import { getTransactionDetails } from '../../services/paymentApi'
import {
  getStatusStyle,
  getTransactionCustomer,
  getTransactionOrder,
  getTransactionTotals,
} from '../../utils/transactionHelpers'

/**
 * TransactionDetailsModal
 *
 * Shows everything that is known about one single transaction:
 * the customer who paid, the order it paid for, the money breakdown and the
 * transaction record itself.
 *
 * Props:
 *   transaction the transaction record (null closes the dialog)
 *   open       whether the dialog is shown
 *   onClose    called when the user dismisses the dialog
 */

/** A label / value pair inside one of the detail sections. */
function DetailRow({ label, value, mono = false }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="shrink-0 text-[13px] text-slate-500">{label}</dt>
      <dd
        className={`text-right text-[13px] font-medium text-slate-900 ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </dd>
    </div>
  )
}

/** The initials shown in the customer avatar. */
function getInitials(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (!parts.length) return '?'

  const first = parts[0].charAt(0)
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : ''
  return `${first}${last}`.toUpperCase()
}

/** A titled block of detail rows. */
function DetailSection({ title, children }) {
  return (
    <section className="mt-4 first:mt-0">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <dl className="mt-1 divide-y divide-slate-100">{children}</dl>
    </section>
  )
}

export default function TransactionDetailsModal({ transaction, open = false, onClose }) {
  // The full record of the transaction, once the service has answered.
  // `id` remembers which transaction it belongs to, so a new click always
  // shows the row that was clicked while the request is still running.
  const [detailState, setDetailState] = useState({ id: null, data: null, failed: false })

  useEffect(() => {
    if (!open || !transaction?.id) return undefined

    let cancelled = false

    // The history list only carries what the table needs. The full record
    // also contains the order it paid for.
    getTransactionDetails(transaction.id)
      .then((data) => {
        if (cancelled) return
        setDetailState({ id: transaction.id, data: data || null, failed: false })
      })
      .catch(() => {
        // Keep the list record — it already holds the customer details.
        if (cancelled) return
        setDetailState({ id: transaction.id, data: null, failed: true })
      })

    return () => {
      cancelled = true
    }
  }, [open, transaction])

  const hasFullRecord = detailState.id === transaction?.id && Boolean(detailState.data)
  const record = hasFullRecord ? detailState.data : transaction
  const isLoading = Boolean(open && transaction?.id) && !hasFullRecord && !detailState.failed

  const details = useMemo(() => {
    if (!record) return null

    return {
      customer: getTransactionCustomer(record),
      order: getTransactionOrder(record),
      totals: getTransactionTotals(record),
      gateway: getGatewayById(record.gateway),
    }
  }, [record])

  if (!details || !record) return null

  const { customer, order, totals, gateway } = details
  const statusStyle = getStatusStyle(record.status)

  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[11px] leading-relaxed text-slate-500">
        Demo record — this is a simulated payment, not a real transfer.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button to={`/payment/result/${record.id}`} variant="secondary" size="sm">
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          Open full receipt
        </Button>
        <Button onClick={onClose} size="sm">
          Close
        </Button>
      </div>
    </div>
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Transaction details"
      description={`${record.transactionRef || 'Transaction'} · ${formatDateTime(record.createdAt)}`}
      size="lg"
      footer={footer}
    >
      {isLoading ? (
        <p className="mb-3 flex items-center gap-2 text-[12px] text-slate-500">
          <Loader size="sm" className="text-brand-600" />
          Loading the full record…
        </p>
      ) : null}

      {/* Summary banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Amount paid</p>
          <p className="tabular mt-0.5 text-lg font-semibold text-slate-900">
            {formatCurrency(record.amount, { currency: record.currency })}
          </p>
        </div>
        <StatusBadge status={record.status} />
      </div>

      {/* Customer */}
      <DetailSection title="Customer">
        <div className="flex items-start gap-3 py-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[13px] font-semibold text-brand-800"
            aria-hidden="true"
          >
            {getInitials(customer.fullName)}
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-slate-900">
              {customer.fullName || 'Unknown customer'}
            </p>
            <p className="text-[12px] text-slate-600">{customer.email || 'No email recorded'}</p>
            <p className="text-[12px] text-slate-600">{customer.phone || 'No mobile number recorded'}</p>
          </div>
        </div>
      </DetailSection>

      {/* Payment */}
      <DetailSection title="Payment">
        <DetailRow
          label="Payment method"
          value={gateway ? gateway.name : record.gatewayName || record.gateway || '—'}
        />
        {gateway ? <DetailRow label="Method detail" value={gateway.detail} /> : null}
        <DetailRow label="Order number" value={order.orderNumber || record.orderNumber || '—'} mono />
        <DetailRow label="Status" value={statusStyle.label} />
        <DetailRow label="Recorded at" value={formatDateTime(record.createdAt)} />
      </DetailSection>

      {/* Order */}
      <DetailSection title="Order">
        {order.productName ? <DetailRow label="Product" value={order.productName} /> : null}
        {order.productCode ? <DetailRow label="Product code" value={order.productCode} mono /> : null}
        <DetailRow
          label="Quantity"
          value={`${totals.quantity} × ${formatCurrency(totals.unitPrice, {
            currency: order.currency,
          })}`}
        />
        <DetailRow
          label="Subtotal"
          value={formatCurrency(totals.subtotal, { currency: order.currency })}
        />
        <DetailRow
          label="Service fee"
          value={formatCurrency(totals.serviceFee, { currency: order.currency })}
        />
        <DetailRow
          label="Total payable"
          value={formatCurrency(totals.total, { currency: order.currency })}
        />
      </DetailSection>

      {/* Record */}
      <DetailSection title="Transaction record">
        <DetailRow label="Reference" value={record.transactionRef || '—'} mono />
        {record.gatewayReference ? (
          <DetailRow label="Gateway reference" value={record.gatewayReference} mono />
        ) : null}
        <DetailRow label="Record id" value={record.id || '—'} mono />
        {record.updatedAt ? (
          <DetailRow label="Last updated" value={formatDateTime(record.updatedAt)} />
        ) : null}
        {record.mode ? <DetailRow label="Mode" value={String(record.mode).toUpperCase()} /> : null}
        {record.simulated !== undefined ? (
          <DetailRow label="Simulated" value={record.simulated ? 'Yes' : 'No'} />
        ) : null}
        {record.reason ? (
          <div className="py-2">
            <dt className="text-[13px] text-slate-500">Reason</dt>
            <dd className="mt-1 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] leading-relaxed text-slate-700">
              {record.reason}
            </dd>
          </div>
        ) : null}
      </DetailSection>
    </Modal>
  )
}
