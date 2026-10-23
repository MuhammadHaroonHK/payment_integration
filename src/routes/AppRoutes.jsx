import { Route, Routes } from 'react-router-dom'
import Home from '../pages/Home'
import Checkout from '../pages/Checkout'
import PaymentReviewPage from '../pages/PaymentReviewPage'
import PaymentResult from '../pages/PaymentResult'
import TransactionHistory from '../pages/TransactionHistory'
import NotFound from '../pages/NotFound'

/**
 * AppRoutes
 *
 * All application routes in one place.
 *
 *   /                     Home / payment demo
 *   /checkout             Checkout (payment method + customer details)
 *   /payment/review       Payment review
 *   /payment/result/:id   Payment result (success / failure / cancelled / pending)
 *   /transactions         Demo transaction history
 *   *                     Not found
 */
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/payment/review" element={<PaymentReviewPage />} />
      <Route path="/payment/result/:transactionId" element={<PaymentResult />} />
      <Route path="/transactions" element={<TransactionHistory />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
