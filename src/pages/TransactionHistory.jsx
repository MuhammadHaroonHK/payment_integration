import { useCallback, useEffect, useMemo, useState } from 'react'
import { Database, RotateCcw, Search } from 'lucide-react'
import Button from '../components/common/Button'
import EmptyState from '../components/common/EmptyState'
import Loader from '../components/common/Loader'
import PageContainer from '../components/layout/PageContainer'
import TransactionDetailsModal from '../components/payment/TransactionDetailsModal'
import TransactionTable from '../components/payment/TransactionTable'
import { Select } from '../components/common/Input'
import { GATEWAYS } from '../data/gateways'
import { getTransactionHistory } from '../services/paymentApi'
import { PAYMENT_CONFIG } from '../config/paymentConfig'
import { clearTransactions } from '../services/transactionStore'
import {
  STATUS_OPTIONS,
  filterTransactions,
  sortByNewest,
} from '../utils/transactionHelpers'

/**
 * TransactionHistory
 *
 * Shows how payment records are displayed: reference, order number, the
 * customer who paid, gateway, amount, date and status — with gateway / status
 * / search filters.
 *
 * Every row has a "View details" action that opens a dialog with the full
 * record: customer information, order, money breakdown and the transaction
 * itself.
 *
 * The records come from the payment service: the local store in offline mock
 * mode, or the API in backend mode (which may in turn be running its own mock
 * gateway or the real hosted checkout).
 */
export default function TransactionHistory() {
  const [transactions, setTransactions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [gateway, setGateway] = useState('all')
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')

  // The transaction whose details are open in the dialog (null = closed).
  const [selectedTransaction, setSelectedTransaction] = useState(null)

  // Load the list once, when the page opens. The state updates happen inside
  // the promise callbacks so the effect body itself stays side-effect free.
  useEffect(() => {
    let cancelled = false

    getTransactionHistory()
      .then((data) => {
        if (cancelled) return
        setTransactions(sortByNewest(data))
        setLoadError('')
        setIsLoading(false)
      })
      .catch((error) => {
        if (cancelled) return
        setLoadError(error?.message || 'The transaction list could not be loaded.')
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const loadTransactions = useCallback(async () => {
    const data = await getTransactionHistory()
    setTransactions(sortByNewest(data))
    setLoadError('')
    setIsLoading(false)
  }, [])

  const filtered = useMemo(
    () => filterTransactions(transactions, { gateway, status, search }),
    [transactions, gateway, status, search],
  )

  const hasActiveFilters = gateway !== 'all' || status !== 'all' || search.trim() !== ''

  const clearFilters = () => {
    setGateway('all')
    setStatus('all')
    setSearch('')
  }

  const openDetails = useCallback((transaction) => {
    setSelectedTransaction(transaction)
  }, [])

  const closeDetails = useCallback(() => {
    setSelectedTransaction(null)
  }, [])

  const resetDemoData = async () => {
    setIsLoading(true)
    clearTransactions()
    await loadTransactions()
  }

  const gatewayOptions = [
    { value: 'all', label: 'All gateways' },
    ...GATEWAYS.map((item) => ({ value: item.id, label: item.name })),
  ]

  return (
    <PageContainer className="py-6 sm:py-8">
      <header className="border-b border-slate-200 pb-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Transaction history</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
          Every recorded transaction, newest first — with the customer who made the payment and a
          details action for every record.
        </p>
      </header>

      {/* Filters */}
      <section className="panel mt-5 px-4 py-4" aria-label="Transaction filters">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="filter-search" className="text-[13px] font-medium text-slate-700">
              Search
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                aria-hidden="true"
              />
              <input
                id="filter-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Order number, reference or customer"
                className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-500 transition-colors duration-150 hover:border-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          <Select
            label="Gateway"
            name="filter-gateway"
            value={gateway}
            onChange={(event) => setGateway(event.target.value)}
            options={gatewayOptions}
          />

          <Select
            label="Status"
            name="filter-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            options={STATUS_OPTIONS}
          />

          <div className="flex items-end gap-2">
            <Button variant="secondary" onClick={clearFilters} disabled={!hasActiveFilters} fullWidth>
              Clear filters
            </Button>
          </div>
        </div>

        <p className="mt-3 text-[12px] text-slate-500">
          Showing {filtered.length} of {transactions.length} demo transactions
        </p>
      </section>

      {/* List */}
      <section className="panel mt-4 overflow-hidden" aria-label="Transaction list">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <Loader size="lg" className="text-brand-600" />
            <p className="mt-3 text-sm text-slate-600">Loading transactions…</p>
          </div>
        ) : loadError ? (
          <div
            role="alert"
            className="m-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800"
          >
            {loadError}
          </div>
        ) : (
          <TransactionTable
            transactions={filtered}
            onViewDetails={openDetails}
            emptyState={
              <EmptyState
                icon={Database}
                title={hasActiveFilters ? 'No matching transactions' : 'No transactions yet'}
                description={
                  hasActiveFilters
                    ? 'No transaction matches the current filters. Try a different search term or clear the filters.'
                    : 'Complete a payment and it will be listed here straight away.'
                }
                action={
                  hasActiveFilters ? (
                    <Button variant="secondary" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : (
                    <Button to="/checkout">Start a payment</Button>
                  )
                }
              />
            }
          />
        )}
      </section>

      {/* Local data notice + reset */}
      <section className="mt-4 flex flex-col gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <Database className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          <p className="max-w-2xl text-[12px] leading-relaxed text-slate-600">
            {PAYMENT_CONFIG.isMock ? (
              <>
                <span className="font-medium text-slate-800">Local demo data.</span> These records
                are stored in this browser only (localStorage). They are not secure, not
                authoritative and are not real payment records — a real backend would keep them in
                a database.
              </>
            ) : (
              <>
                <span className="font-medium text-slate-800">Records from the API.</span> These
                transactions are stored in MongoDB by the PayLab server. Depending on the server&apos;s
                PAYMENT_MODE they are simulated or come from the real gateway (sandbox by default).
                The API has no authentication, so it must not be exposed publicly.
              </>
            )}
          </p>
        </div>

        {PAYMENT_CONFIG.isMock ? (
          <Button variant="secondary" size="sm" onClick={resetDemoData} disabled={isLoading}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Reset demo data
          </Button>
        ) : null}
      </section>

      {/* Details of the selected transaction */}
      <TransactionDetailsModal
        transaction={selectedTransaction}
        open={Boolean(selectedTransaction)}
        onClose={closeDetails}
      />
    </PageContainer>
  )
}
