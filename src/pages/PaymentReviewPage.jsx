import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Info } from 'lucide-react'
import Button from '../components/common/Button'
import PageContainer from '../components/layout/PageContainer'
import PaymentReview from '../components/payment/PaymentReview'
import SimulatedOutcomeSelector from '../components/payment/SimulatedOutcomeSelector'
import { usePayment } from '../hooks/usePayment'
import { createPayment } from '../services/paymentApi'

/**
 * PaymentReviewPage
 *
 * Step 2 of the demo journey: the user checks the order one last time and
 * confirms the simulated payment.
 *
 * The actual "gateway call" happens here and goes through `createPayment()`
 * from the service layer. In mock mode that is the local simulator; with a
 * backend it becomes a real POST request. No gateway logic lives in this file.
 */
export default function PaymentReviewPage() {
  const navigate = useNavigate()

  const {
    order,
    totals,
    customer,
    selectedGatewayDetails,
    selectedGateway,
    simulatedOutcome,
    setSimulatedOutcome,
    setLastTransaction,
    resetOrder,
    isCustomerValid,
    testControlsEnabled,
  } = usePayment()

  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Missing or incomplete data should never leave the user on a blank page.
  useEffect(() => {
    if (!selectedGateway || !isCustomerValid) {
      navigate('/checkout', { replace: true })
    }
  }, [selectedGateway, isCustomerValid, navigate])

  const handleConfirm = async () => {
    setErrorMessage('')
    setIsProcessing(true)

    try {
      const transaction = await createPayment({
        order,
        totals,
        customer,
        gateway: selectedGateway,
        // The simulated outcome is only sent when the development test
        // controls are available. The server decides that, not the browser.
        simulatedOutcome: testControlsEnabled ? simulatedOutcome : undefined,
      })

      setLastTransaction(transaction)
      // A backend order can only be paid once, so the next checkout starts
      // with a fresh demo order. The customer details are kept.
      resetOrder()
      navigate(`/payment/result/${transaction.id}`)
    } catch (error) {
      setErrorMessage(error?.message || 'The demo payment could not be processed. Please try again.')
      setIsProcessing(false)
    }
  }

  return (
    <PageContainer className="py-6 sm:py-8">
      <header className="border-b border-slate-200 pb-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Review payment</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
          Check the order details below, then confirm the demo payment.
        </p>
      </header>

      <div className="mt-6 grid gap-5 lg:grid-cols-12">
        <div className="order-2 space-y-5 lg:order-1 lg:col-span-7">
          <PaymentReview
            order={order}
            totals={totals}
            customer={customer}
            gateway={selectedGatewayDetails}
          />

          {testControlsEnabled ? (
            <SimulatedOutcomeSelector
              value={simulatedOutcome}
              onChange={setSimulatedOutcome}
              disabled={isProcessing}
            />
          ) : (
            <div className="rounded-md border border-slate-200 bg-white px-4 py-3">
              <p className="text-[12px] leading-relaxed text-slate-600">
                The simulated outcome control is disabled on this server. The mock gateway decides
                the outcome by itself.
              </p>
            </div>
          )}

          <div className="flex items-start gap-2.5 rounded-md border border-slate-200 bg-white px-4 py-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            <p className="text-[12px] leading-relaxed text-slate-600">
              Confirming runs a local simulation only. No JazzCash or Easypaisa service is contacted
              and no money is transferred. The result page always labels the outcome as simulated.
            </p>
          </div>
        </div>

        <div className="order-1 lg:order-2 lg:col-span-5">
          <div className="panel px-4 py-4 lg:sticky lg:top-20">
            {errorMessage ? (
              <div
                role="alert"
                className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800"
              >
                {errorMessage}
              </div>
            ) : null}

            <Button onClick={handleConfirm} size="lg" fullWidth loading={isProcessing}>
              {isProcessing ? 'Processing demo payment…' : 'Confirm Demo Payment'}
            </Button>

            <Button
              to="/checkout"
              variant="secondary"
              size="lg"
              fullWidth
              className="mt-2.5"
              disabled={isProcessing}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Go Back and Edit
            </Button>

            <p className="mt-3 text-[12px] leading-relaxed text-slate-500">
              Going back keeps everything you entered — you only change what you need to.
            </p>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
