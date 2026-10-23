/**
 * PageContainer
 *
 * Consistent page width and padding for every route, so pages line up and
 * never scroll sideways on small screens.
 */
export default function PageContainer({ children, className = '', size = 'default' }) {
  const widths = {
    default: 'max-w-5xl',
    narrow: 'max-w-3xl',
    wide: 'max-w-6xl',
  }

  return (
    <div className={`mx-auto w-full ${widths[size]} px-4 sm:px-6 ${className}`}>{children}</div>
  )
}
