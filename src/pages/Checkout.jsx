import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowRight, Lock } from 'lucide-react'
import Button from '../components/common/Button'
import PageContainer from '../components/layout/PageContainer'
import CustomerForm from '../components/payment/CustomerForm'
import OrderSummary from '../components/payment/OrderSummary'
import PaymentMethodCard from '../components/payment/PaymentMethodCard'
import { GATEWAYS, getGatewayById } from '../data/gateways'
import { usePayment } from '../hooks/usePayment'
import { validateCustomerForm } from '../utils/validation'

/**
 * Checkout
 *
 * Step 1 of the demo journey: choose a gateway, enter the customer details
 * and continue to the review page.
 *
 * No gateway API is called from this page — it only collects and validates
 * the data that the mock service (or a future backend) will use.
 */
export default function Checkout() {
  const navigate = useNavigate()

  const {
    order,
    totals,
    customer,
    selectedGateway,
    setGateway,
    setCustomerField,
    setQuantity,
    isGatewaySelected,
    orderSource,
    orderStatus,
    orderError,
    loadDemoOrder,
  } = usePayment()

  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  /**
   * In backend mode the order (and its price) is created by the API, so the
   * checkout asks the server for a demo order the first time it is opened.
   */
  useEffect(() => {
    if (orderSource !== 'backend' && orderStatus !== 'loading') {
      loadDemoOrder(order.quantity)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCustomerChange = (field, value) => {
    setCustomerField(field, value)
    // Clear the error for this field as soon as the user starts correcting it.
    setErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!isGatewaySelected) return

    const validationErrors = validateCustomerForm(customer)
    setErrors(validationErrors)

    const firstInvalidField = Object.keys(validationErrors)[0]
    if (firstInvalidField) {
      const field = document.getElementById(firstInvalidField)
      if (field) field.focus()
      return
    }

    // Short processing delay so the loading state is visible in the demo.
    setIsSubmitting(true)
    await new Promise((resolve) => {
      setTimeout(resolve, 500)
    })
    navigate('/payment/review')
    setIsSubmitting(false)
  }

  const selectedGatewayDetails = getGatewayById(selectedGateway)
  const isOrderLoading = orderStatus === 'loading'
  const hasOrderError = orderStatus === 'error'

  return (
    <PageContainer className="py-6 sm:py-8">
      <header className="border-b border-slate-200 pb-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Checkout</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
          Select a payment method and add the customer details for this demo order.
        </p>
      </header>

      <form onSubmit={handleSubmit} noValidate className="mt-6">
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Left column: method + customer form */}
          <div className="order-2 space-y-5 lg:order-1 lg:col-span-7">
            <section className="panel" aria-labelledby="method-heading">
              <header className="panel-header">
                <h2 id="method-heading" className="text-sm font-semibold text-slate-900">
                  Payment method
                </h2>
                <p className="mt-0.5 text-[12px] text-slate-500">
                  Select one method to continue with the demo payment.
                </p>
              </header>

              <fieldset className="px-4 py-4">
                <legend className="sr-only">Choose a payment method</legend>
                <div className="space-y-2.5">
                  {GATEWAYS.map((gateway) => (
                    <PaymentMethodCard
                      key={gateway.id}
                      gateway={gateway}
                      selected={selectedGateway === gateway.id}
                      onSelect={setGateway}
                    />
                  ))}
                </div>
              </fieldset>
            </section>

            <CustomerForm values={customer} errors={errors} onChange={handleCustomerChange} />

            <div className="panel px-4 py-4">
              {hasOrderError ? (
                <div
                  role="alert"
                  className="mb-3 flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-800"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {orderError || 'The demo order could not be loaded from the payment service.'}
                  </span>
                </div>
              ) : null}

              <Button
                type="submit"
                size="lg"
                fullWidth
                disabled={!isGatewaySelected || isOrderLoading || hasOrderError}
                loading={isSubmitting || isOrderLoading}
              >
                {isSubmitting
                  ? 'Preparing review…'
                  : isOrderLoading
                    ? 'Loading demo order…'
                    : 'Continue to payment'}
                {!isSubmitting && !isOrderLoading ? (
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                ) : null}
              </Button>

              {!isGatewaySelected ? (
                <p className="mt-2.5 text-center text-[12px] text-slate-500">
                  Select a payment method to enable this button.
                </p>
              ) : null}

              <p className="mt-3 flex items-start gap-1.5 text-[12px] leading-relaxed text-slate-500">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                This demo never asks for a PIN, OTP, password or card details.
              </p>
            </div>
          </div>

          {/* Right column: order summary */}
          <div className="order-1 lg:order-2 lg:col-span-5">
            <div className="lg:sticky lg:top-20">
              <OrderSummary
                order={order}
                totals={totals}
                onQuantityChange={setQuantity}
                gateway={selectedGatewayDetails}
              />

              {selectedGatewayDetails ? (
                <div className="mt-3 flex items-start gap-2.5 rounded-md border border-slate-200 bg-white px-4 py-3">
                  <span
                    className="mt-1 h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: selectedGatewayDetails.markerColor }}
                    aria-hidden="true"
                  />
                  <p className="text-[12px] leading-relaxed text-slate-600">
                    Payment method selected:{' '}
                    <span className="font-medium text-slate-900">
                      {selectedGatewayDetails.name}
                    </span>
                    . The order will be reviewed on the next step.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </form>
    </PageContainer>
  )
}
