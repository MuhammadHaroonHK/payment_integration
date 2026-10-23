import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { PAYMENT_CONFIG } from '../config/paymentConfig'
import { DEMO_ORDER, calculateOrderTotals } from '../data/demoOrder'
import { DEFAULT_OUTCOME } from '../services/mockPaymentService'
import { getDemoOrder } from '../services/paymentApi'
import { EMPTY_CUSTOMER } from '../utils/validation'
import { PaymentContext } from './PaymentStateContext'

/**
 * PaymentContext
 *
 * The single source of truth for the whole checkout journey:
 *   - the order being paid for (and its live totals)
 *   - the selected payment gateway
 *   - the customer details
 *   - the simulated outcome used by the mock service
 *   - the last simulated transaction (so the result page survives a refresh)
 *
 * The state is mirrored into localStorage so that "Go back and edit" — or a
 * page refresh — never loses what the user already typed. Those stored values
 * are demo data only and are not secure records of anything.
 */

const PaymentContextValue = PaymentContext

const CHECKOUT_KEY = PAYMENT_CONFIG.storageKeys.checkout
const LAST_TRANSACTION_KEY = PAYMENT_CONFIG.storageKeys.lastTransaction

const initialState = {
  order: { ...DEMO_ORDER },
  selectedGateway: null,
  customer: { ...EMPTY_CUSTOMER },
  simulatedOutcome: DEFAULT_OUTCOME,
  lastTransaction: null,
  /**
   * Where the order comes from.
   *   'local'   -> the built-in demo order (mock mode, no server involved)
   *   'backend' -> an order created by the API from its own price list
   */
  orderSource: 'local',
  /** 'idle' | 'loading' | 'ready' | 'error' */
  orderStatus: 'ready',
  orderError: '',
  /** Whether the development-only outcome control may be used. */
  testControlsEnabled: true,
}

/* -------------------------------------------------------------------------- */
/* Reducer                                                                    */
/* -------------------------------------------------------------------------- */

function reducer(state, action) {
  switch (action.type) {
    case 'SET_GATEWAY':
      return { ...state, selectedGateway: action.gateway }

    case 'SET_CUSTOMER_FIELD':
      return {
        ...state,
        customer: { ...state.customer, [action.field]: action.value },
      }

    case 'SET_CUSTOMER':
      return { ...state, customer: { ...state.customer, ...action.values } }

    case 'SET_QUANTITY': {
      const quantity = Math.min(20, Math.max(1, Number(action.quantity) || 1))
      return { ...state, order: { ...state.order, quantity } }
    }

    case 'SET_SIMULATED_OUTCOME':
      return { ...state, simulatedOutcome: action.outcome }

    case 'SET_LAST_TRANSACTION':
      return { ...state, lastTransaction: action.transaction }

    case 'SET_ORDER':
      return {
        ...state,
        order: action.order,
        orderSource: action.source,
        orderStatus: 'ready',
        orderError: '',
      }

    case 'SET_ORDER_STATUS':
      return {
        ...state,
        orderStatus: action.status,
        orderError: action.error || '',
      }

    case 'SET_TEST_CONTROLS':
      return { ...state, testControlsEnabled: action.enabled }

    /**
     * Start a new checkout session.
     *
     * The order is dropped so the next checkout asks the server for a fresh
     * demo order (a backend order can only be paid once). The customer
     * details and the selected gateway are kept, so a retry does not mean
     * typing everything again.
     */
    case 'RESET_ORDER':
      return {
        ...state,
        order: { ...DEMO_ORDER },
        orderSource: 'local',
        orderStatus: 'ready',
        orderError: '',
      }

    case 'RESET_CHECKOUT':
      return {
        ...initialState,
        order: { ...DEMO_ORDER },
        customer: { ...EMPTY_CUSTOMER },
        lastTransaction: null,
      }

    case 'HYDRATE':
      return { ...state, ...action.payload }

    default:
      return state
  }
}

/* -------------------------------------------------------------------------- */
/* Storage helpers (demo data only)                                          */
/* -------------------------------------------------------------------------- */

function readStorage(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage is optional — the app works without it */
  }
}

function removeStorage(key) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

function loadInitialState() {
  const saved = readStorage(CHECKOUT_KEY, null)
  const lastTransaction = readStorage(LAST_TRANSACTION_KEY, null)

  if (!saved) return { ...initialState, lastTransaction }

  return {
    ...initialState,
    order: { ...DEMO_ORDER, ...(saved.order || {}) },
    orderSource: saved.orderSource ?? 'local',
    selectedGateway: saved.selectedGateway ?? null,
    customer: { ...EMPTY_CUSTOMER, ...(saved.customer || {}) },
    simulatedOutcome: saved.simulatedOutcome ?? DEFAULT_OUTCOME,
    lastTransaction,
  }
}

/* -------------------------------------------------------------------------- */
/* Provider                                                                   */
/* -------------------------------------------------------------------------- */

export function PaymentProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState)

  // Persist the in-progress checkout so a refresh keeps the user's input.
  useEffect(() => {
    writeStorage(CHECKOUT_KEY, {
      order: state.order,
      orderSource: state.orderSource,
      selectedGateway: state.selectedGateway,
      customer: state.customer,
      simulatedOutcome: state.simulatedOutcome,
    })
  }, [
    state.order,
    state.orderSource,
    state.selectedGateway,
    state.customer,
    state.simulatedOutcome,
  ])

  // Persist the last simulated transaction for the result page.
  useEffect(() => {
    if (state.lastTransaction) {
      writeStorage(LAST_TRANSACTION_KEY, state.lastTransaction)
    } else {
      removeStorage(LAST_TRANSACTION_KEY)
    }
  }, [state.lastTransaction])

  /**
   * Load the demo order from the backend.
   *
   * In backend mode the price list lives on the server, so the order (and
   * therefore the payable amount) is created by the API instead of the
   * browser. The order is only fetched once per checkout session — going
   * back to the checkout keeps the same order.
   *
   * @param {number} [quantity]
   */
  const loadDemoOrder = useCallback(async (quantity = 1) => {
    if (PAYMENT_CONFIG.isMock) {
      // The offline simulator uses the built-in demo order, so there is
      // nothing to fetch and nothing to reset.
      return null
    }

    dispatch({ type: 'SET_ORDER_STATUS', status: 'loading' })

    try {
      const { order, testControlsEnabled } = await getDemoOrder(quantity)

      if (!order) {
        throw new Error('The server did not return a demo order.')
      }

      dispatch({ type: 'SET_TEST_CONTROLS', enabled: testControlsEnabled })
      dispatch({ type: 'SET_ORDER', order, source: 'backend' })

      return order
    } catch (error) {
      dispatch({
        type: 'SET_ORDER_STATUS',
        status: 'error',
        error: error?.message || 'The demo order could not be loaded.',
      })
      return null
    }
  }, [])

  const actions = useMemo(
    () => ({
      setGateway: (gateway) => dispatch({ type: 'SET_GATEWAY', gateway }),
      setCustomerField: (field, value) => dispatch({ type: 'SET_CUSTOMER_FIELD', field, value }),
      setCustomer: (values) => dispatch({ type: 'SET_CUSTOMER', values }),
      setQuantity: (quantity) => dispatch({ type: 'SET_QUANTITY', quantity }),
      setSimulatedOutcome: (outcome) => dispatch({ type: 'SET_SIMULATED_OUTCOME', outcome }),
      setLastTransaction: (transaction) => dispatch({ type: 'SET_LAST_TRANSACTION', transaction }),
      resetCheckout: () => dispatch({ type: 'RESET_CHECKOUT' }),
      resetOrder: () => dispatch({ type: 'RESET_ORDER' }),
      loadDemoOrder,
    }),
    [loadDemoOrder],
  )

  const totals = useMemo(() => calculateOrderTotals(state.order), [state.order])

  const value = useMemo(
    () => ({
      // state
      order: state.order,
      totals,
      selectedGateway: state.selectedGateway,
      customer: state.customer,
      simulatedOutcome: state.simulatedOutcome,
      lastTransaction: state.lastTransaction,
      orderSource: state.orderSource,
      orderStatus: state.orderStatus,
      orderError: state.orderError,
      testControlsEnabled: state.testControlsEnabled,
      // actions
      ...actions,
    }),
    [state, totals, actions],
  )

  return <PaymentContextValue.Provider value={value}>{children}</PaymentContextValue.Provider>
}

export default PaymentProvider
