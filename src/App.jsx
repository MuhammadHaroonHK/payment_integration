import { BrowserRouter } from 'react-router-dom'
import { PaymentProvider } from './context/PaymentContext'
import Footer from './components/layout/Footer'
import Navbar from './components/layout/Navbar'
import AppRoutes from './routes/AppRoutes'

/**
 * App
 *
 * Application shell: router, shared payment state, layout and routes.
 */
export default function App() {
  return (
    <BrowserRouter>
      <PaymentProvider>
        <div className="flex min-h-screen flex-col bg-canvas">
          <Navbar />

          <main className="flex-1">
            <AppRoutes />
          </main>

          <Footer />
        </div>
      </PaymentProvider>
    </BrowserRouter>
  )
}
