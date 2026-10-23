import { Link } from 'react-router-dom'
import { FileQuestion } from 'lucide-react'
import Button from '../components/common/Button'
import PageContainer from '../components/layout/PageContainer'

/**
 * NotFound
 *
 * Handles any unknown URL so the user always has a way back into the app.
 */
export default function NotFound() {
  return (
    <PageContainer className="py-16" size="narrow">
      <div className="panel px-6 py-12 text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
          <FileQuestion className="h-5 w-5 text-slate-500" aria-hidden="true" />
        </span>

        <p className="mt-4 text-[12px] font-medium uppercase tracking-wide text-slate-500">
          Error 404
        </p>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">Page not found</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
          The page you were looking for does not exist. It may have been moved, or the link may be
          incorrect.
        </p>

        <div className="mt-6 flex flex-col justify-center gap-2.5 sm:flex-row">
          <Button to="/">Return to home</Button>
          <Button to="/checkout" variant="secondary">
            Start demo payment
          </Button>
        </div>

        <p className="mt-6 text-[12px] text-slate-500">
          Looking for records?{' '}
          <Link to="/transactions" className="font-medium text-brand-700 underline underline-offset-4">
            Open the transaction history
          </Link>
          .
        </p>
      </div>
    </PageContainer>
  )
}
