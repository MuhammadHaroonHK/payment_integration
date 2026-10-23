import { useCallback, useContext, useMemo } from 'react'
import { PaymentContext } from '../context/PaymentStateContext'
import { getGatewayById } from '../data/gateways'
import { isCustomerFormValid, validateCustomerForm } from '../utils/validation'

/**
 * usePaymentContext
 *
 * Access the shared payment state. Always call this inside a component that
 * is wrapped in <PaymentProvider>.
 */
export function usePaymentContext() {
  const context = useContext(PaymentContext)
  if (!context) {
    throw new Error('usePaymentContext must be used inside <PaymentProvider>.')
  }
  return context
}

/**
 * usePayment
 *
 * A small hook that keeps the pages tidy: it exposes the checkout state plus
 * a few ready-made helpers (validation, gateway lookup, totals) so no page
 * has to reach into the context and re-implement them.
 */
export function usePayment() {
  const context = usePaymentContext()

  const {
    order,
    totals,
    selectedGateway,
    customer,
    simulatedOutcome,
    lastTransaction,
    orderSource,
    orderStatus,
    orderError,
    testControlsEnabled,
    serverMode,
    gatewayCapabilities,
  } = context

  const selectedGatewayDetails = useMemo(
    () => getGatewayById(selectedGateway),
    [selectedGateway],
  )

  const customerErrors = useMemo(() => validateCustomerForm(customer), [customer])

  const isCustomerValid = useMemo(
    () => isCustomerFormValid(customer),
    [customer],
  )

  const isGatewaySelected = Boolean(selectedGateway)

  /** True when the user may move to the review step. */
  const canContinue = isGatewaySelected && isCustomerValid

  const validate = useCallback(() => validateCustomerForm(customer), [customer])

  return {
    // state
    order,
    totals,
    customer,
    selectedGateway,
    selectedGatewayDetails,
    simulatedOutcome,
    lastTransaction,
    orderSource,
    orderStatus,
    orderError,
    testControlsEnabled,
    serverMode,
    gatewayCapabilities,
    // derived
    customerErrors,
    isCustomerValid,
    isGatewaySelected,
    isOrderReady: orderStatus === 'ready',
    canContinue,
    // actions
    validate,
    setGateway: context.setGateway,
    setCustomerField: context.setCustomerField,
    setCustomer: context.setCustomer,
    setQuantity: context.setQuantity,
    setSimulatedOutcome: context.setSimulatedOutcome,
    setLastTransaction: context.setLastTransaction,
    resetCheckout: context.resetCheckout,
    resetOrder: context.resetOrder,
    loadDemoOrder: context.loadDemoOrder,
  }
}

export default usePayment
