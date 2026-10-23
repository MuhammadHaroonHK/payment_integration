/**
 * Tiny HTML helpers for the redirect pages.
 *
 * The backend has to return a self-submitting form in two places:
 *   - the Easypaisa confirmation step (the customer must POST an auth token)
 *   - nothing else today, but the helper is shared so the markup stays in one
 *     place.
 *
 * Only values produced by the server or by the gateway are used here, and
 * every one of them is escaped — a redirect page must never become an XSS
 * vector.
 */

/**
 * Escape a value for use in an HTML attribute or text node.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/**
 * Build a minimal page that POSTs the given fields to the gateway as soon as
 * the browser has parsed it.
 *
 * The visible button is a fallback: if the inline script is blocked by a
 * Content-Security-Policy (or JavaScript is disabled), the customer can still
 * continue with one click.
 *
 * @param {{action: string, fields: Record<string, string>, title?: string, message?: string, nonce?: string}} input
 * @returns {string} a complete HTML document
 */
export function autoSubmitForm({
  action,
  fields,
  title = 'Redirecting…',
  message = 'Redirecting to the payment page…',
  nonce = '',
}) {
  const inputs = Object.entries(fields)
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`,
    )
    .join('\n      ')

  const nonceAttribute = nonce ? ` nonce="${escapeHtml(nonce)}"` : ''

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="font-family: system-ui, sans-serif; max-width: 32rem; margin: 4rem auto; padding: 0 1rem; line-height: 1.6; color: #0f172a;">
    <p>${escapeHtml(message)}</p>
    <form id="gateway-form" method="POST" action="${escapeHtml(action)}">
      ${inputs}
      <button
        type="submit"
        style="display: inline-flex; align-items: center; justify-content: center; padding: 0.65rem 1.1rem; border: 0; border-radius: 0.375rem; background: #1f6a4f; color: #fff; font: inherit; cursor: pointer;"
      >
        Continue
      </button>
    </form>
    <script${nonceAttribute}>document.getElementById('gateway-form').submit()</script>
  </body>
</html>`
}

export default { escapeHtml, autoSubmitForm }
