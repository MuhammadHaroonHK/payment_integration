import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Info } from 'lucide-react'
import Button from '../components/common/Button'
import PageContainer from '../components/layout/PageContainer'
import PaymentReview from '../components/payment/PaymentReview'
import SimulatedOutcomeSelector from '../components/payment/SimulatedOutcomeSelector'
import { usePayment } from '../hooks/usePayment'
import { createPayment } from '../services/paymentApi'

/**
 * PaymentReviewPage
 *
 * Step 2 of the journey. In mock mode this runs the local simulation; in live
 * mode it returns a signed form which the browser posts to the gateway's
 * hosted checkout. The customer then pays on the gateway page and comes back
 * through the backend callback.
 *
 * No gateway logic lives in this file — only the redirect mechanics.
 */

/**
 * POST the gateway form. A plain link cannot be used because both gateways
 * expect a form submission with signed fields.
 *
 * @param {{url: string, method?: string, fields: Record<string, string>}} redirect
 */
function submitGatewayForm(redirect) {
  const form = document.createElement('form')
  form.method = redirect.method || 'POST'
  form.action = redirect.url
  form.style.display = 'none'

  Object.entries(redirect.fields || {}).forEach(([name, value]) => {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    form.appendChild(input)
  })

  document.body.appendChild(form)
  form.submit()
}

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
    serverMode,
    gatewayCapabilities,
  } = usePayment()

  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [redirect, setRedirect] = useState(null)

  const isLive = serverMode === 'LIVE'
  const gatewayName = selectedGatewayDetails?.name || 'the gateway'
  const isGatewayConfigured = selectedGateway
    ? gatewayCapabilities?.[selectedGateway] !== false
    : true

  // Missing or incomplete data should never leave the user on a blank page.
  useEffect(() => {
    if (!selectedGateway || !isCustomerValid) {
      navigate('/checkout', { replace: true })
    }
  }, [selectedGateway, isCustomerValid, navigate])

  // Leave for the gateway as soon as the signed request is ready.
  useEffect(() => {
    if (!redirect) return
    submitGatewayForm(redirect)
  }, [redirect])

  const handleConfirm = async () => {
    setErrorMessage('')
    setIsProcessing(true)

    try {
      const { transaction, redirect: gatewayRedirect } = await createPayment({
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

      if (gatewayRedirect?.url) {
        // Live mode: keep `isProcessing` true and send the browser on.
        setRedirect(gatewayRedirect)
        return
      }

      navigate(`/payment/result/${transaction.id}`)
    } catch (error) {
      setErrorMessage(
        error?.message || 'The payment could not be processed. Please try again.',
      )
      setIsProcessing(false)
    }
  }

  return (
    <PageContainer className="py-6 sm:py-8">
      <header className="border-b border-slate-200 pb-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Review payment</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
          {isLive
            ? `Check the order below. You will be redirected to ${gatewayName} to complete the payment.`
            : 'Check the order details below, then confirm the demo payment.'}
        </p>
      </header>

      <div className="mt-6 grid gap-5 lg:grid-cols-12">
        <div className="order-2 space-y-5 lg:order-1 lg:col-span-7">
          <PaymentReview
            order={order}
            totals={totals}
            customer={customer}
            gateway={selectedGatewayDetails}
            subtitle={
              isLive
                ? `You will pay ${gatewayName} on its own secure page.`
                : 'Review the details before the demo payment is processed.'
            }
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
                {isLive
                  ? `Live gateway mode — the outcome is decided by ${gatewayName} and confirmed by the server when you return.`
                  : 'The simulated outcome control is disabled on this server. The mock gateway decides the outcome by itself.'}
              </p>
            </div>
          )}

          <div className="flex items-start gap-2.5 rounded-md border border-slate-200 bg-white px-4 py-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            <p className="text-[12px] leading-relaxed text-slate-600">
              {isLive ? (
                <>
                  You will leave PayLab and finish the payment on {gatewayName}&apos;s page.
                  Your PIN, OTP and card details are entered there and are never sent to or
                  stored by PayLab. The result is confirmed on the server when you return.
                </>
              ) : (
                <>
                  Confirming runs a local simulation only. No JazzCash or Easypaisa service is
                  contacted and no money is transferred. The result page always labels the
                  outcome as simulated.
                </>
              )}
            </p>
          </div>

          {isLive ? (
            <p className="flex items-center gap-1.5 text-[12px] text-slate-500">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              The payment page opens on the gateway&apos;s own domain.
            </p>
          ) : null}
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

            {!isGatewayConfigured ? (
              <div
                role="alert"
                className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900"
              >
                {gatewayName} is not configured on this server. Add its credentials to{' '}
                <span className="font-mono">server/.env</span> and restart the API, or choose the
                other method.
              </div>
            ) : null}

            <Button
              onClick={handleConfirm}
              size="lg"
              fullWidth
              loading={isProcessing}
              disabled={isProcessing || !isGatewayConfigured}
            >
              {isProcessing
                ? isLive
                  ? `Redirecting to ${gatewayName}…`
                  : 'Processing demo payment…'
                : isLive
                  ? `Continue to ${gatewayName}`
                  : 'Confirm Demo Payment'}
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
