import { ArrowRight, Info, ShieldCheck, Smartphone, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import Button from '../components/common/Button'
import PageContainer from '../components/layout/PageContainer'
import { GATEWAYS } from '../data/gateways'
import { PAYMENT_CONFIG } from '../config/paymentConfig'

/**
 * Home
 *
 * A short dashboard-style introduction to the practice project.
 * It deliberately stays task focused: pick a gateway, run a demo payment.
 */

const GATEWAY_ICONS = {
  jazzcash: Smartphone,
  easypaisa: Wallet,
}

const STEPS = [
  {
    title: 'Select payment method',
    description: 'Choose JazzCash or Easypaisa and enter the customer details.',
  },
  {
    title: 'Review payment',
    description: 'Check the order, the gateway and the total amount before confirming.',
  },
  {
    title: 'Complete the payment',
    description:
      'In mock mode the gateway returns success, failure, cancelled or pending. In live mode the result comes from JazzCash or Easypaisa.',
  },
]

export default function Home() {
  return (
    <PageContainer className="py-6 sm:py-8">
      {/* Page header */}
      <header className="border-b border-slate-200 pb-6">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          Payment Gateway Integration Practice
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          PayLab is a practice environment for learning how a checkout flow is built. Pick one of the
          supported gateways, complete the order form and continue to the payment to see the full
          checkout, review and result flow.
        </p>
      </header>

      {/* Simulation notice */}
      <div className="mt-5 flex items-start gap-2.5 rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
        <p className="text-[13px] leading-relaxed text-amber-900">
          {PAYMENT_CONFIG.isMock ? (
            <>
              <span className="font-semibold">All transactions are simulated.</span> No real money
              is transferred, no gateway account is used and no JazzCash or Easypaisa API is
              contacted. The app is running in local mock mode.
            </>
          ) : (
            <>
              <span className="font-semibold">The payment mode is controlled by the server.</span>{' '}
              In mock mode nothing leaves the app and no money moves. In live mode you are
              redirected to JazzCash or Easypaisa (sandbox by default) and the server records the
              result when you return from the gateway.
            </>
          )}
        </p>
      </div>

      {/* Gateway options */}
      <section className="mt-6" aria-labelledby="gateways-heading">
        <h2 id="gateways-heading" className="text-sm font-semibold text-slate-900">
          Supported payment gateways
        </h2>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {GATEWAYS.map((gateway) => {
            const Icon = GATEWAY_ICONS[gateway.id] || Wallet

            return (
              <article key={gateway.id} className="panel p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-600">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">{gateway.name}</h3>
                      <span className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: gateway.markerColor }}
                          aria-hidden="true"
                        />
                        {gateway.identifier}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                      {gateway.description}
                    </p>
                    <p className="mt-1.5 text-[11px] uppercase tracking-wide text-slate-500">
                      {gateway.detail}
                    </p>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {/* Primary action */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button to="/checkout" size="lg">
          Start Payment Demo
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Link
          to="/transactions"
          className="text-sm font-medium text-slate-600 underline underline-offset-4 transition-colors hover:text-brand-700"
        >
          View demo transaction history
        </Link>
      </div>

      {/* Practice flow */}
      <section className="mt-8" aria-labelledby="flow-heading">
        <h2 id="flow-heading" className="text-sm font-semibold text-slate-900">
          Practice flow
        </h2>

        <ol className="mt-3 grid gap-3 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="panel p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-[12px] font-semibold text-brand-700">
                  {index + 1}
                </span>
                <h3 className="text-[13px] font-semibold text-slate-900">{step.title}</h3>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-600">{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Safety note */}
      <section className="mt-8 flex items-start gap-2.5 rounded-md border border-slate-200 bg-white px-4 py-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
        <p className="text-[13px] leading-relaxed text-slate-600">
          This practice project never asks for a PIN, OTP, password, card number or any banking
          credential. Only a name, an email address and a mobile number are collected, and in mock
          mode nothing leaves your browser.
        </p>
      </section>
    </PageContainer>
  )
}
