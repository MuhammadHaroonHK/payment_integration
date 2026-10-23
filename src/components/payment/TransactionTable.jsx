import { Eye } from 'lucide-react'
import { formatCurrency, formatDateTime } from '../../utils/formatCurrency'
import { getGatewayById } from '../../data/gateways'
import { getTransactionCustomer } from '../../utils/transactionHelpers'
import Button from '../common/Button'
import StatusBadge from '../common/StatusBadge'

/**
 * TransactionTable
 *
 * Displays demo transactions.
 *   - medium screens and up: a real <table> (semantic + screen reader friendly)
 *   - small screens: a stacked list, so nothing is cramped or cut off
 *
 * Props:
 *   transactions  the records to show
 *   emptyState    rendered when there is nothing to show
 *   onViewDetails called with the transaction when the user asks for the
 *                 details. When it is missing, the action column is hidden.
 */

export default function TransactionTable({
  transactions = [],
  emptyState = null,
  onViewDetails = null,
}) {
  if (!transactions.length) {
    return emptyState
  }

  const canViewDetails = typeof onViewDetails === 'function'

  return (
    <>
      {/* Desktop / tablet table */}
      <div className="hidden overflow-x-auto md:block">
        <table
          className={`w-full border-collapse text-left text-sm ${
            canViewDetails ? 'min-w-[1040px]' : 'min-w-[720px]'
          }`}
        >
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th scope="col" className="px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                Reference
              </th>
              <th scope="col" className="px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                Order number
              </th>
              <th scope="col" className="px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                Customer
              </th>
              <th scope="col" className="px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                Gateway
              </th>
              <th scope="col" className="px-4 py-2.5 text-right text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                Amount
              </th>
              <th scope="col" className="px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                Date &amp; time
              </th>
              <th scope="col" className="px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                Status
              </th>
              {canViewDetails ? (
                <th scope="col" className="px-4 py-2.5 text-right text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {transactions.map((transaction) => {
              const customer = getTransactionCustomer(transaction)

              return (
                <tr key={transaction.id} className="bg-white transition-colors hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-[13px] font-medium text-slate-900">
                    {transaction.transactionRef}
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px] text-slate-600">
                    {transaction.orderNumber}
                  </td>
                  <td className="px-4 py-3 text-[13px]">
                    <span className="block font-medium text-slate-900">
                      {customer.fullName || '—'}
                    </span>
                    {customer.email ? (
                      <span className="block text-[12px] text-slate-500">{customer.email}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-slate-700">
                    {getGatewayById(transaction.gateway)?.name || transaction.gateway}
                  </td>
                  <td className="tabular px-4 py-3 text-right text-[13px] font-medium text-slate-900">
                    {formatCurrency(transaction.amount, { currency: transaction.currency })}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[13px] text-slate-600">
                    {formatDateTime(transaction.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={transaction.status} size="sm" />
                  </td>
                  {canViewDetails ? (
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onViewDetails(transaction)}
                        aria-label={`View details of transaction ${transaction.transactionRef}`}
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        View details
                      </Button>
                    </td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile list */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {transactions.map((transaction) => {
          const customer = getTransactionCustomer(transaction)

          return (
            <li key={transaction.id} className="px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-[13px] font-semibold text-slate-900">
                    {transaction.transactionRef}
                  </p>
                  <p className="truncate font-mono text-[12px] text-slate-500">
                    {transaction.orderNumber}
                  </p>
                </div>
                <StatusBadge status={transaction.status} size="sm" />
              </div>

              <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
                <div className="col-span-2">
                  <dt className="text-slate-500">Customer</dt>
                  <dd className="font-medium text-slate-800">{customer.fullName || '—'}</dd>
                  {customer.email ? (
                    <dd className="truncate text-slate-500">{customer.email}</dd>
                  ) : null}
                  {customer.phone ? (
                    <dd className="text-slate-500">{customer.phone}</dd>
                  ) : null}
                </div>
                <div>
                  <dt className="text-slate-500">Gateway</dt>
                  <dd className="font-medium text-slate-800">
                    {getGatewayById(transaction.gateway)?.name || transaction.gateway}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Amount</dt>
                  <dd className="tabular font-medium text-slate-800">
                    {formatCurrency(transaction.amount, { currency: transaction.currency })}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-slate-500">Date &amp; time</dt>
                  <dd className="font-medium text-slate-800">{formatDateTime(transaction.createdAt)}</dd>
                </div>
              </dl>

              {canViewDetails ? (
                <div className="mt-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    fullWidth
                    onClick={() => onViewDetails(transaction)}
                    aria-label={`View details of transaction ${transaction.transactionRef}`}
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    View details
                  </Button>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </>
  )
}
