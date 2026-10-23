import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Clock3, Info, SearchX, Slash, XCircle } from 'lucide-react'
import Button from '../components/common/Button'
import Loader from '../components/common/Loader'
import PageContainer from '../components/layout/PageContainer'
import PaymentReview from '../components/payment/PaymentReview'
import StatusBadge from '../components/common/StatusBadge'
import { usePayment } from '../hooks/usePayment'
import { getGatewayById } from '../data/gateways'
import { getPaymentStatus } from '../services/paymentApi'
import { PAYMENT_CONFIG } from '../config/paymentConfig'
import { TRANSACTION_STATUS } from '../utils/transactionHelpers'

/**
 * PaymentResult
 *
 * Step 3 of the checkout journey. One layout serves every outcome: success,
 * failure, cancelled and pending.
 *
 * The status comes from the local simulator, the API's mock gateway or a real
 * gateway callback, depending on the configured mode. A live result that was
 * not cryptographically verified is labelled as such.
 */

const RESULT_STATES = {
  [TRANSACTION_STATUS.SUCCESS]: {
    icon: CheckCircle2,
    iconClass: 'border-brand-200 bg-brand-50 text-brand-700',
    title: 'Demo payment successful',
    description:
      'The simulated transaction completed successfully and was recorded in the demo transaction history.',
    note: 'This is a simulated result. No real money was transferred and no gateway account was used.',
    primary: { label: 'Return to home', to: '/' },
    secondary: { label: 'View transaction history', to: '/transactions' },
  },
  [TRANSACTION_STATUS.FAILED]: {
    icon: XCircle,
    iconClass: 'border-red-200 bg-red-50 text-red-700',
    title: 'Demo payment failed',
    description: 'The simulated gateway declined this transaction.',
    note: 'This is a simulated result. No money was transferred and no gateway was contacted.',
    primary: { label: 'Retry the demo', to: '/checkout' },
    secondary: { label: 'Return to home', to: '/' },
  },
  [TRANSACTION_STATUS.CANCELLED]: {
    icon: Slash,
    iconClass: 'border-slate-300 bg-slate-100 text-slate-600',
    title: 'Demo payment cancelled',
    description: 'The simulated payment was cancelled before it reached a final state.',
    note: 'This is a simulated result. Nothing was charged.',
    primary: { label: 'Return to checkout', to: '/checkout' },
    secondary: { label: 'Return to home', to: '/' },
  },
  [TRANSACTION_STATUS.PENDING]: {
    icon: Clock3,
    iconClass: 'border-slate-300 bg-slate-100 text-slate-600',
    title: 'Demo payment pending',
    description:
      'The simulated transaction has not reached a final state. In a real integration this is where a gateway would be polled for the final status.',
    note: 'This is a simulated result. PayLab does not verify real payment status.',
    primary: { label: 'Return to home', to: '/' },
    secondary: { label: 'View transaction history', to: '/transactions' },
  },
}

/**
 * Wording for a real gateway transaction. The layout is identical; only the
 * claims change, so the page never calls a real payment "simulated".
 */
const LIVE_STATES = {
  [TRANSACTION_STATUS.SUCCESS]: {
    title: 'Payment successful',
    description:
      'The gateway confirmed this payment and the order has been marked as paid.',
    note: 'Confirmed and verified by the server. Keep the transaction reference below for your records.',
    primary: { label: 'Return to home', to: '/' },
    secondary: { label: 'View transaction history', to: '/transactions' },
  },
  [TRANSACTION_STATUS.FAILED]: {
    title: 'Payment failed',
    description: 'The gateway declined or cancelled this payment.',
    note: 'The gateway did not complete the payment. If your account was debited, contact the gateway with the reference below before trying again.',
    primary: { label: 'Try again', to: '/checkout' },
    secondary: { label: 'Return to home', to: '/' },
  },
  [TRANSACTION_STATUS.CANCELLED]: {
    title: 'Payment cancelled',
    description: 'The payment was cancelled before the gateway confirmed it.',
    note: 'No verified successful payment exists for this order. You can start a new checkout.',
    primary: { label: 'Return to checkout', to: '/checkout' },
    secondary: { label: 'Return to home', to: '/' },
  },
  [TRANSACTION_STATUS.PENDING]: {
    title: 'Payment pending',
    description:
      'The gateway has not confirmed a final result yet. This page keeps checking and updates itself.',
    note: 'Do not pay again while this payment is pending. If it stays pending, check the transaction history or contact the gateway with the reference below.',
    primary: { label: 'Return to home', to: '/' },
    secondary: { label: 'View transaction history', to: '/transactions' },
  },
}

export default function PaymentResult() {
  const { transactionId } = useParams()
  const { order, totals, customer, selectedGatewayDetails, lastTransaction, setLastTransaction } =
    usePayment()

  // Decide the starting view once: we may already hold the transaction in
  // context (normal flow) or we may have to load it from the service
  // (deep link / page refresh).
  const [view, setView] = useState(() => {
    if (lastTransaction && lastTransaction.id === transactionId) {
      return { status: 'ready', transaction: lastTransaction }
    }
    if (!transactionId) return { status: 'missing', transaction: null }
    return { status: 'loading', transaction: null }
  })

  // Remembers which transaction id has already been requested, so React's
  // StrictMode double effect does not start two requests and drop the result.
  const requestedIdRef = useRef(null)

  // Load the transaction when the page is opened directly (deep link / refresh).
  useEffect(() => {
    if (view.status !== 'loading' || !transactionId) return
    if (requestedIdRef.current === transactionId) return

    requestedIdRef.current = transactionId

    getPaymentStatus(transactionId)
      .then((result) => setView({ status: 'ready', transaction: result }))
      .catch(() => setView({ status: 'missing', transaction: null }))
  }, [transactionId, view.status])

  const transaction = view.transaction
  const isLoading = view.status === 'loading'
  const isMissing = view.status === 'missing'

  /**
   * A live payment can still be PENDING when the customer lands here (the
   * gateway callback may arrive a moment later). Poll the API until it has a
   * final status, so the page does not tell the customer to pay twice.
   */
  useEffect(() => {
    if (PAYMENT_CONFIG.isMock) return undefined
    if (view.status !== 'ready') return undefined
    if (view.transaction?.status !== TRANSACTION_STATUS.PENDING) return undefined

    const id = view.transaction.id
    let attempts = 0
    let cancelled = false
    let timer = null

    const check = async () => {
      attempts += 1

      try {
        const result = await getPaymentStatus(id)
        if (cancelled) return

        setView({ status: 'ready', transaction: result })
        setLastTransaction(result)

        if (result.status !== TRANSACTION_STATUS.PENDING || attempts >= 24) {
          clearInterval(timer)
        }
      } catch {
        if (attempts >= 24) clearInterval(timer)
      }
    }

    // Check once immediately: the callback has often already completed by the
    // time the browser lands on this page.
    check()
    timer = setInterval(check, 5000)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [view.status, view.transaction?.id, view.transaction?.status, setLastTransaction])

  const isLiveTransaction = Boolean(transaction) && transaction.simulated === false

  const state = useMemo(() => {
    if (!transaction) return null

    const status = transaction.status
    const base = RESULT_STATES[status] || RESULT_STATES[TRANSACTION_STATUS.PENDING]

    if (transaction.simulated === false) {
      const live = LIVE_STATES[status] || LIVE_STATES[TRANSACTION_STATUS.PENDING]

      if (status === TRANSACTION_STATUS.SUCCESS && transaction.gatewayVerified === false) {
        return {
          ...base,
          ...live,
          note: 'The gateway reported success, but this result came from its unsigned return redirect. It is recorded without cryptographic verification — keep the reference below.',
        }
      }

      return { ...base, ...live }
    }

    return base
  }, [transaction])

  /**
   * The result page must describe the transaction itself, not whatever
   * happens to be in the checkout form right now. We therefore prefer the
   * snapshot stored with the transaction and only fall back to the live
   * context when the record has no snapshot (older demo records).
   */
  const view_ = useMemo(() => {
    const displayOrder = { ...order, ...(transaction?.order || {}) }
    if (transaction?.orderNumber) displayOrder.orderNumber = transaction.orderNumber

    const displayTotals = { ...totals, ...(transaction?.totals || {}) }
    if (transaction?.amount != null && !transaction.totals) displayTotals.total = transaction.amount

    const displayCustomer = { ...customer, ...(transaction?.customer || {}) }
    if (transaction?.customerName) displayCustomer.fullName = transaction.customerName
    if (transaction?.customerEmail) displayCustomer.email = transaction.customerEmail
    if (transaction?.customerPhone) displayCustomer.phone = transaction.customerPhone

    const displayGateway = transaction?.gateway
      ? getGatewayById(transaction.gateway)
      : selectedGatewayDetails

    return { displayOrder, displayTotals, displayCustomer, displayGateway }
  }, [transaction, order, totals, customer, selectedGatewayDetails])

  if (isLoading) {
    return (
      <PageContainer className="py-10" size="narrow">
        <div className="panel flex flex-col items-center justify-center px-6 py-14 text-center">
          <Loader size="lg" className="text-brand-600" />
          <p className="mt-3 text-sm text-slate-600">Loading transaction result…</p>
        </div>
      </PageContainer>
    )
  }

  if (isMissing || !transaction || !state) {
    return (
      <PageContainer className="py-10" size="narrow">
        <div className="panel px-6 py-10 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
            <SearchX className="h-5 w-5 text-slate-500" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-lg font-semibold text-slate-900">Transaction not found</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
            We could not find a transaction with reference{' '}
            <span className="font-mono text-slate-800">{transactionId || '—'}</span>. It may have been
            created in another browser, or the data was reset.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-2.5 sm:flex-row">
            <Button to="/checkout">Start a new payment</Button>
            <Button to="/" variant="secondary">
              Return to home
            </Button>
          </div>
        </div>
      </PageContainer>
    )
  }

  const Icon = state.icon

  return (
    <PageContainer className="py-6 sm:py-8">
      <div className="mx-auto max-w-3xl">
        {/* Status banner */}
        <section className="panel px-5 py-6 text-center sm:px-8 sm:py-8">
          <span
            className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full border ${state.iconClass}`}
          >
            <Icon className="h-6 w-6" aria-hidden="true" />
          </span>

          <div className="mt-4 flex justify-center">
            <StatusBadge status={transaction.status} />
          </div>

          <h1 className="mt-3 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
            {state.title}
          </h1>

          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-600">
            {state.description}
          </p>

          {transaction.reason ? (
            <p className="mx-auto mt-3 max-w-lg rounded border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-700">
              {transaction.reason}
            </p>
          ) : null}

          {isLiveTransaction && transaction.gatewayReference ? (
            <p className="mx-auto mt-3 max-w-lg text-[12px] text-slate-500">
              Gateway reference{' '}
              <span className="font-mono text-slate-700">{transaction.gatewayReference}</span>
            </p>
          ) : null}

          {isLiveTransaction && transaction.status === TRANSACTION_STATUS.PENDING ? (
            <p className="mx-auto mt-2 flex max-w-lg items-center justify-center gap-1.5 text-[12px] text-slate-500">
              <Loader size="sm" className="text-brand-600" />
              Waiting for the gateway confirmation…
            </p>
          ) : null}

          {isLiveTransaction &&
          transaction.status === TRANSACTION_STATUS.SUCCESS &&
          transaction.gatewayVerified === false ? (
            <p className="mx-auto mt-3 max-w-lg rounded border border-amber-200 bg-amber-50 px-3 py-2 text-left text-[12px] leading-relaxed text-amber-900">
              <span className="font-semibold">Unverified result.</span> Easypaisa&apos;s final redirect is
              not signed, so this success was accepted from the browser redirect. Configure the
              inquiry credentials to store a cryptographically verified result.
            </p>
          ) : null}
        </section>

        {/* Transaction details */}
        <div className="mt-5">
          <PaymentReview
            order={view_.displayOrder}
            totals={view_.displayTotals}
            customer={view_.displayCustomer}
            gateway={view_.displayGateway}
            transaction={transaction}
            subtitle={
              isLiveTransaction
                ? 'Details of this gateway transaction.'
                : 'Details of this simulated transaction.'
            }
          />
        </div>

        {/* Actions */}
        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
          <Button to={state.primary.to} size="lg" className="sm:flex-1">
            {state.primary.label}
          </Button>
          <Button to={state.secondary.to} variant="secondary" size="lg" className="sm:flex-1">
            {state.secondary.label}
          </Button>
        </div>

        <p className="mt-4 flex items-start gap-1.5 text-[12px] leading-relaxed text-slate-600">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {state.note}
        </p>
      </div>
    </PageContainer>
  )
}
