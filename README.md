# PayLab — Payment Gateway Integration Practice

**PayLab** is a practice project for learning how a mobile payment checkout is built.
It reproduces the shape of a real JazzCash / Easypaisa checkout — order summary,
payment method selection, customer form, review step, hosted gateway page, result
screen and transaction history.

The project has two parts:

| Folder | What it is |
| --- | --- |
| `src/`, `public/`, `index.html` | The **React frontend** (Vite + React + Tailwind CSS) |
| `server/` | The **Express + MongoDB backend** with real hosted-checkout adapters |

The backend supports two modes:

| Server mode | What happens |
| --- | --- |
| `PAYMENT_MODE=mock` | The backend simulates the gateway. No provider is contacted. |
| `PAYMENT_MODE=live` | The backend builds a signed JazzCash / Easypaisa hosted-checkout request, the customer pays on the provider's page, and the backend records the result after verifying the callback (JazzCash signature, or the Easypaisa inquiry API when configured). |

The frontend can also run completely offline with its own built-in simulator
(`VITE_PAYMENT_MODE=mock`), with no server and no MongoDB.

> **Full backend documentation → [`server/README.md`](server/README.md)**

---

## 1. Project purpose

| Goal | How it is met |
| --- | --- |
| Learn a realistic checkout flow | Six screens modelled on real payment apps (Home, Checkout, Review, Result, History, 404) |
| Practise both gateways | JazzCash and Easypaisa use the exact same UI and the same service interface |
| Practise every outcome | Success, failure, cancelled and pending are all reachable in mock mode |
| Learn the server side too | A real Express + Mongoose API with validation, transactions, rate limits and tests |
| Use the real gateways | Signed hosted-checkout adapters, callback verification and sandbox/live switching |

**What this project deliberately does NOT do**

* It never asks for a PIN, OTP, password, card number or any banking credential.
  Those are entered on the gateway's own page.
* It never stores gateway secrets in the browser, in MongoDB, or in a log.
* It does not pretend a simulation is a real payment: every transaction records
  `mode` (`MOCK` / `LIVE`) and `simulated`, and the UI labels it.
* It is not production-ready: see [§11](#11-security-limitations) and the backend
  gap list.

---

## 2. Technologies used

### Frontend

| Layer | Technology |
| --- | --- |
| Build tool | Vite 8 |
| UI | React 19 (functional components + hooks) |
| Language | JavaScript (ES6+) — no TypeScript |
| Styling | Tailwind CSS 4 (`@tailwindcss/vite`, CSS-first `@theme` config) |
| Routing | React Router DOM 7 |
| Icons | Lucide React |
| HTTP client | Axios |
| Linting | ESLint 9 flat config (already included in the Vite template) |

### Backend

| Layer | Technology |
| --- | --- |
| Runtime | Node.js 20+ (ES modules) |
| Framework | Express 5 |
| Database | MongoDB with Mongoose 9 |
| Validation | Zod 4 |
| Security | Helmet, CORS, express-rate-limit |
| Logging | Morgan (access log) + Pino (structured application log) |
| Config | dotenv + a Zod validated environment module |
| Testing | Vitest + Supertest |
| Dev reload | `node --watch` (see `server/README.md` for why, not nodemon) |

---

## 3. Installation

### Backend

```bash
cd server
npm install
cp .env.example .env        # macOS / Linux
# copy .env.example .env     # Windows
npm run dev
```

The API starts on <http://localhost:5000/api> and needs a running MongoDB
(`mongodb://127.0.0.1:27017/paylab` by default).

### Frontend

```bash
# 1. install dependencies
npm install

# 2. create your local env file
copy .env.example .env        # Windows PowerShell / cmd
# cp .env.example .env        # macOS / Linux

# 3. start the dev server
npm run dev
```

Open <http://localhost:5173>.

> The frontend talks to the backend when `VITE_PAYMENT_MODE=backend`.
> Set `VITE_PAYMENT_MODE=mock` to run it completely offline with the
> built-in browser simulator (no server, no MongoDB needed).

Other scripts:

```bash
npm run build      # production build into dist/
npm run preview    # serve the production build locally
npm run lint       # run ESLint
```

**Requirements:** Node.js 20 or newer (developed on Node 22) and npm.

---

## 4. Running both parts locally

Two terminals:

```bash
# terminal 1 — the API (needs MongoDB running)
cd server
npm install
npm run dev          # http://localhost:5000/api

# terminal 2 — the frontend
npm install
npm run dev          # http://localhost:5173
```

The frontend `.env` must point at the API:

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_PAYMENT_MODE=backend
```

**Backend tests**

```bash
cd server
npm test             # 53 tests, Vitest + Supertest
```

See [`server/README.md`](server/README.md) for the full API reference,
the environment variables and the callback contract.

### Switching the backend to the real gateways

All merchant credentials live in **`server/.env`** (never in the frontend `.env`).

```env
# server/.env
PAYMENT_MODE=live
PUBLIC_BASE_URL=http://localhost:5000

JAZZCASH_ENVIRONMENT=sandbox
JAZZCASH_MERCHANT_ID=...
JAZZCASH_PASSWORD=...
JAZZCASH_INTEGRITY_SALT=...

EASYPAISA_ENVIRONMENT=sandbox
EASYPAISA_STORE_ID=...
EASYPAISA_HASH_KEY=...          # exactly 16, 24 or 32 characters
# Optional, for a cryptographically verified result:
EASYPAISA_USERNAME=...
EASYPAISA_PASSWORD=...
EASYPAISA_ACCOUNT_NUMBER=...
# Without the three values above: true accepts the unsigned redirect
# (gatewayVerified=false); false keeps an unverified SUCCESS pending.
EASYPAISA_TRUST_REDIRECT=true
```

Then restart `npm run dev` in `server/`. The server logs which gateway is missing
credentials and refuses only that gateway with `GATEWAY_NOT_CONFIGURED`; the other
one keeps working.

The gateway sends the customer's browser back to `PUBLIC_BASE_URL`, so
`http://localhost:5000` works for local testing. If your merchant portal requires a
publicly reachable return URL, expose the API with an HTTPS tunnel
(for example `ngrok http 5000`) and put that URL in `PUBLIC_BASE_URL`.

> The repo ships with **sandbox** hosts. Flip `JAZZCASH_ENVIRONMENT` or
> `EASYPAISA_ENVIRONMENT` to `production` only when the merchant account is live.
> Real money can move in production mode.

---

## 5. Environment configuration

`.env.example` is the template:

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_PAYMENT_MODE=backend
```

| Variable | Meaning |
| --- | --- |
| `VITE_API_BASE_URL` | Base URL of the Express API. |
| `VITE_PAYMENT_MODE` | `backend` → real HTTP calls to the API. `mock` → the built-in offline simulator. |

> ### ⚠️ Security note about `VITE_` variables
> Vite **inlines every `VITE_`-prefixed variable into the browser bundle**. Anyone who
> opens the browser can read them. They must never contain merchant IDs, signing keys,
> API secrets, webhook secrets, PINs or OTPs. Those belong on the backend only.
> `.env` is git-ignored; `.env.example` is committed because it only holds public placeholders.

The backend has its own `.env` — see [`server/README.md`](server/README.md#5-environment-variables).

---

## 6. Folder structure

```text
paylab/
├── public/
│   ├── assets/                 # static files served as-is
│   ├── favicon.svg
│   └── robots.txt
│
├── src/                        # ── the React frontend ──
│   ├── assets/
│   │   └── icons/              # reserved for future icon assets
│   │
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button.jsx      # one button for the whole app (variants, sizes, loading)
│   │   │   ├── Input.jsx       # labelled field + validation message (also exports Select)
│   │   │   ├── Loader.jsx      # small spinner
│   │   │   ├── Modal.jsx       # accessible dialog (Escape, backdrop, focus restore, scroll lock)
│   │   │   ├── StatusBadge.jsx # SUCCESS / FAILED / CANCELLED / PENDING badge
│   │   │   └── EmptyState.jsx  # "nothing to show" block
│   │   │
│   │   ├── layout/
│   │   │   ├── Navbar.jsx      # top navigation (collapses on small screens)
│   │   │   ├── Footer.jsx      # footer + "simulated payments" reminder
│   │   │   └── PageContainer.jsx
│   │   │
│   │   └── payment/
│   │       ├── PaymentMethodCard.jsx      # radio-based gateway selector
│   │       ├── OrderSummary.jsx           # order + live totals + quantity stepper
│   │       ├── CustomerForm.jsx           # name / email / mobile
│   │       ├── PaymentReview.jsx          # reusable payment summary panel
│   │       ├── SimulatedOutcomeSelector.jsx # developer test control (see §7)
│   │       ├── TransactionDetailsModal.jsx  # full record + gateway reference
│   │       └── TransactionTable.jsx       # table on desktop, cards on mobile
│   │
│   ├── pages/
│   │   ├── Home.jsx             # dashboard-style intro + "Start Payment Demo"
│   │   ├── Checkout.jsx         # method + customer form
│   │   ├── PaymentReviewPage.jsx# final review + confirm
│   │   ├── PaymentResult.jsx    # success / failure / cancelled / pending
│   │   ├── TransactionHistory.jsx
│   │   └── NotFound.jsx         # 404 for unknown URLs
│   │
│   ├── services/
│   │   ├── apiClient.js         # axios instance + error normaliser
│   │   ├── paymentApi.js        # createPayment / getPaymentStatus / getTransactionHistory
│   │   ├── apiAdapters.js       # translates the API contract into the UI shapes
│   │   ├── mockPaymentService.js# the offline simulator (no real gateway logic)
│   │   └── transactionStore.js  # localStorage demo store (mock mode only)
│   │
│   ├── config/
│   │   └── paymentConfig.js     # mode switch, base URL, storage keys
│   │
│   ├── data/
│   │   ├── demoOrder.js         # sample order + total calculation (mock mode)
│   │   ├── gateways.js          # JazzCash / Easypaisa definitions
│   │   └── mockTransactions.js  # seed demo records (mock mode)
│   │
│   ├── hooks/
│   │   └── usePayment.js        # single hook used by every page
│   │
│   ├── utils/
│   │   ├── formatCurrency.js    # PKR formatting + date helpers
│   │   ├── validation.js        # name / email / Pakistani mobile rules
│   │   └── transactionHelpers.js# status metadata, refs, filtering
│   │
│   ├── context/
│   │   ├── PaymentContext.jsx   # provider (single source of truth)
│   │   └── PaymentStateContext.js # the context object itself
│   │
│   ├── routes/
│   │   └── AppRoutes.jsx        # all routes in one file
│   │
│   ├── styles/
│   │   └── index.css            # Tailwind import + design tokens
│   │
│   ├── App.jsx
│   └── main.jsx
│
├── server/                     # ── the Express + MongoDB backend ──
│   ├── src/
│   │   ├── config/             # env.js (validated) · database.js · demoCatalogue.js
│   │   ├── controllers/         # payment · transaction · order · health
│   │   ├── services/
│   │   │   ├── paymentService.js     # the payment rules
│   │   │   ├── transactionService.js # listing + lookup
│   │   │   ├── orderService.js       # server controlled pricing
│   │   │   └── gateways/
│   │   │       ├── gatewayFactory.js # picks the adapter for the active mode
│   │   │       ├── mockGateway.js     # the simulator (PAYMENT_MODE=mock)
│   │   │       ├── jazzcashGateway.js # signed hosted checkout + callback verification
│   │   │       └── easypaisaGateway.js# AES-hashed hosted checkout + inquiry
│   │   ├── models/              # Order.js · Transaction.js
│   │   ├── routes/              # payment · transaction · order · health
│   │   ├── middleware/          # requestId · validateRequest · rateLimit · notFound · errorHandler
│   │   ├── validators/          # zod schemas
│   │   ├── utils/               # ApiError · asyncHandler · generateReference · money · logger · pkTime · html
│   │   ├── app.js               # express app (helmet, cors, rate limit, routes)
│   │   └── server.js            # bootstrap (env -> db -> listen)
│   ├── tests/                  # health · payment · transaction · testControls · livePayments
│   ├── .env.example
│   ├── eslint.config.js
│   ├── package.json
│   ├── vitest.config.js
│   └── README.md
│
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

> **A note on the structure:** `data/gateways.js` (gateway metadata),
> `context/PaymentStateContext.js` (the context object, so the provider file only
> exports a component), `services/transactionStore.js` (the localStorage demo store),
> `components/payment/SimulatedOutcomeSelector.jsx` (the developer test control),
> `components/common/Modal.jsx` (accessible dialog) and
> `components/payment/TransactionDetailsModal.jsx` (transaction details view) keep a
> clear separation of concerns instead of growing the page components.

---

## 7. How the payment flow works

### The flow

```
Home  →  Checkout  →  Payment review  →  Payment result  →  Transaction history
          (method +      (summary +        (success /
           customer)       confirm)          failure /
                                             cancelled /
                                             pending)
```

1. **Checkout** validates the form and stores the order, gateway and customer details.
2. **Payment review** shows the summary and calls `createPayment()` from `paymentApi.js`.
3. **`paymentApi.js` decides where the call goes** — this is the only place the
   application decides between the offline simulator and the API:

   ```js
   export async function createPayment(payload) {
     if (PAYMENT_CONFIG.isMock) {
       return { transaction: await createMockPayment(payload), redirect: null }
     }
     const response = await apiClient.post('/payments/create', payload)
     return {
       transaction: toFrontendTransaction(unwrap(response)),
       redirect: response.data.redirect ?? null,
     }
   }
   ```

4. **The backend decides between its own simulator and the real gateway**
   (`server/.env`: `PAYMENT_MODE=mock` or `PAYMENT_MODE=live`). The browser never
   decides that.

### Mock mode

* `VITE_PAYMENT_MODE=mock` — `mockPaymentService.js` waits ~1.8 s, returns the
  selected outcome and stores it in `localStorage`.
* `VITE_PAYMENT_MODE=backend` + server `PAYMENT_MODE=mock` — `mockGateway.js` on the
  server simulates the provider and writes a MongoDB transaction.

On the review page, a clearly marked **"Developer test control — simulated result"**
panel (dashed amber border, flask icon) lets you pick the outcome the mock service
returns:

| Outcome | Result status | What the result page shows |
| --- | --- | --- |
| Success | `SUCCESS` | "Demo payment successful" + reference, order, gateway, amount |
| Failure | `FAILED` | "Demo payment failed" + the simulated decline reason |
| Cancelled | `CANCELLED` | "Demo payment cancelled" |
| Pending | `PENDING` | "Demo payment pending" + explanation that it has no final state |

This control is a **testing aid of the local simulator only**. It is never sent to
or received from JazzCash or Easypaisa, and it is not a real gateway feature.

**The browser cannot enable it.** The API reports `capabilities.testControlsEnabled`
when it creates the demo order, and the server rejects any request that tries to
force an outcome while its own controls are off (`TEST_CONTROLS_DISABLED`). The
controls are always switched off when `NODE_ENV=production` or `PAYMENT_MODE=live`.

### Live hosted checkout

With `PAYMENT_MODE=live` the browser is only a messenger:

1. `POST /api/payments/create` validates the order and calculates the amount from
   server-side data. The transaction is stored as `PENDING`, `mode=LIVE`.
2. The adapter builds a signed form:
   * **JazzCash** — `pp_*` fields + `pp_SecureHash` (HMAC-SHA256 with the integrity
     salt), posted to the sandbox/production merchant form.
   * **Easypaisa** — `merchantHashedReq` (AES-ECB with the 16/24/32-character hash
     key), posted to the Easypay checkout page.
3. The frontend auto-submits that form and the customer pays on the gateway's own
   page. PayLab never sees the PIN, OTP or card details.
4. The gateway redirects the browser back to the API:
   * `POST /api/payments/jazzcash/return` — signature is verified before anything
     changes.
   * `GET/POST /api/payments/easypaisa/return` — the `auth_token` is forwarded to
     the confirmation page.
   * `GET/POST /api/payments/easypaisa/callback` — final status. When the optional
     inquiry credentials are configured, the server asks Easypaisa for the real
     state instead of trusting the unsigned redirect.
5. The server matches the callback to the transaction by `gatewayTxnRef`, checks the
   amount when the gateway supplies it, and only then moves the transaction (and the
   order) to its final state.
6. The browser is redirected to `/payment/result/:id`. A pending result page polls
   `GET /api/payments/:id/status` until the outcome is final.

A forged or tampered JazzCash callback is rejected with `400 INVALID_SIGNATURE` and
the transaction stays `PENDING`; there is an automated test for exactly that.

### Where the gateway logic lives

All gateway code is in `server/src/services/gateways/`. **No React component
contains gateway-processing logic** — components only call `paymentApi.js`, which
delegates to the offline simulator, the API client or the redirect.

---

## 8. Testing the four outcomes

1. `npm run dev` and open <http://localhost:5173>.
2. Click **Start Payment Demo**.
3. Pick **JazzCash** or **Easypaisa**.
4. Fill the form, e.g. `Ayesha Khan` / `ayesha.khan@example.com` / `03001234567`.
5. Click **Continue to payment**.
6. On the review page, choose an outcome in the **developer test control**.
7. Click **Confirm Demo Payment** and wait ~2 seconds for the simulated response.
8. The result page shows the matching status, the transaction reference
   (`JC-…` / `EP-…`), the order number, the gateway and the amount in PKR.
9. Open **Transactions** in the navbar — the new record is at the top of the list and
   can be filtered by gateway, filtered by status and searched by order number or
   reference.

Every mock outcome uses the **same** checkout and result UI — only the status changes.

### Testing the live sandbox flow

1. Put the sandbox credentials in `server/.env`, set `PAYMENT_MODE=live` and restart
   the API.
2. Keep the frontend on `VITE_PAYMENT_MODE=backend`.
3. Complete the checkout and press **Continue to JazzCash / Easypaisa**. The browser
   leaves PayLab for the provider's sandbox page.
4. Pay with the sandbox wallet / test credentials supplied by the provider.
5. The gateway returns you to the API, which processes the result (checking the
   JazzCash signature, and using the Easypaisa inquiry API when configured) and
   redirects to the result page. The transaction is stored with `mode: "LIVE"` and
   `simulated: false`.

The developer outcome control is hidden in live mode: the gateway decides the result,
not the browser. If a gateway has no credentials, its payment is refused with
`GATEWAY_NOT_CONFIGURED` before the browser leaves the site.

### Local demo data

**In offline mock mode** the transactions are stored in `localStorage` under
`paylab.demo.transactions.v1`. They are **local demo data only**: not secure, not
authoritative, not a payment record, and readable/editable by anyone with access
to the browser. The **Reset demo data** button on the history page clears them and
restores the seed records from `src/data/mockTransactions.js`.

**In backend mode** the transactions are real documents in MongoDB, written by the
API. The history page then shows what the server stored, with server side
filtering and pagination available on `GET /api/payments/transactions`.

---

## 9. The backend API

The API is **implemented** in the `server/` folder. The complete reference — every
endpoint, every error code and a request/response example for each — lives in
[`server/README.md`](server/README.md).

Base URL: `VITE_API_BASE_URL` (default `http://localhost:5000/api`).

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | API + database status (never exposes secrets) |
| `GET` | `/api/orders/demo` | Creates a demo order from the server price list |
| `POST` | `/api/payments/create` | Starts a payment; in live mode returns the signed gateway form |
| `GET` | `/api/payments/:transactionId/status` | The status of one transaction |
| `GET` | `/api/payments/transactions` | Transaction history with filtering + pagination |
| `GET` | `/api/payments/transactions/:transactionId` | One transaction with its order summary |
| `POST` | `/api/payments/jazzcash/return` | **Gateway callback** — signed result from JazzCash |
| `POST` | `/api/payments/jazzcash/ipn` | **Gateway callback** — optional server-to-server IPN |
| `GET/POST` | `/api/payments/easypaisa/return` | **Gateway callback** — `auth_token` from Easypaisa |
| `GET/POST` | `/api/payments/easypaisa/callback` | **Gateway callback** — final Easypaisa status |
| `POST` | `/api/payments/mock/:transactionId/outcome` | **Development only** — force a pending outcome |

The callback endpoints are called by the gateway (and the customer's browser), not by
the React app. They answer with a `303` redirect to the result page or with a small
HTML error page.

### Response envelope

Success:

```json
{ "success": true, "mode": "MOCK", "message": "Simulated payment completed", "data": { } }
```

`mode` is `MOCK` (simulator) or `LIVE` (real gateway). In live mode the create
response also contains:

```json
{
  "redirect": {
    "url": "https://sandbox.jazzcash.com.pk/...",
    "method": "POST",
    "fields": { "pp_TxnRefNo": "T...", "pp_SecureHash": "..." }
  }
}
```

Error:

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "The request payload is invalid." } }
```

Error codes: `VALIDATION_ERROR`, `ORDER_NOT_FOUND`, `TRANSACTION_NOT_FOUND`,
`INVALID_GATEWAY`, `INVALID_STATUS_TRANSITION`, `DUPLICATE_PAYMENT`,
`GATEWAY_NOT_CONFIGURED`, `INVALID_SIGNATURE`, `AMOUNT_MISMATCH`,
`GATEWAY_UNAVAILABLE`, `GATEWAY_ERROR`, `DATABASE_ERROR`, `RATE_LIMIT_EXCEEDED`,
`INTERNAL_SERVER_ERROR`, `TEST_CONTROLS_DISABLED`.

### How the frontend talks to it

`src/services/paymentApi.js` is the only module that performs payment calls.
`src/services/apiAdapters.js` reconciles the two contracts:

| API contract | Frontend shape |
| --- | --- |
| `{ success, data }` envelope | bare object |
| `transactionReference` | `transactionRef` |
| `failureReason` | `reason` |
| `JAZZCASH` | `jazzcash` |
| paisa (465000) | rupees (4650) |

The service layer also passes the gateway `redirect` through unchanged; the review
page submits it, while the result page only understands the adapted transaction.

---

## 10. The run modes

| | Offline simulator | Backend + mock | Backend + live |
| --- | --- | --- | --- |
| Frontend `.env` | `VITE_PAYMENT_MODE=mock` | `VITE_PAYMENT_MODE=backend` | `VITE_PAYMENT_MODE=backend` |
| Server `.env` | — (no server) | `PAYMENT_MODE=mock` | `PAYMENT_MODE=live` |
| Where the outcome is produced | In the browser (`mockPaymentService.js`) | On the server (`mockGateway.js`) | At JazzCash / Easypaisa |
| Needs a server + MongoDB | No | Yes | Yes |
| Where the data lives | `localStorage` | MongoDB | MongoDB |
| Where the price comes from | `src/data/demoOrder.js` | `server/src/config/demoCatalogue.js` | `server/src/config/demoCatalogue.js` |
| Reference format | `JC-7F3K9Q` | `PAYLAB-TXN-7F3K9Q2` | `PAYLAB-TXN-…` + `pp_TxnRefNo` / `orderRefNum` |
| Is the amount trusted? | n/a — nothing leaves the browser | **No** — the server recalculates it | **No** — the server recalculates it |
| Is a SUCCESS verified? | No — simulated | No — simulated | Yes, by a signed callback (or inquiry) |

All three modes use the **same UI**. Switching is a configuration change, not a code
change.

---

## 11. Security limitations

### The frontend

* **The browser never holds merchant credentials.** In live mode the server builds
  the signed request; the browser only submits it and later displays the record the
  server stored. A `VITE_` secret would be public, so none exists.
* **`localStorage` is not a database.** Offline demo records are plain text in the
  browser. They can be edited, copied or deleted by the user and are not protected.
* **`VITE_` variables are public.** Everything prefixed with `VITE_` ends up in the
  JavaScript bundle. Never put credentials there.
* **Never collect secrets in the frontend.** PayLab does not ask for a PIN, OTP,
  password, card number, CVV or banking credential; those are entered on the
  gateway's own hosted page.
* **Client-side validation is a convenience, not a guarantee.** The backend validates
  every field again.

### The backend

* **No authentication.** Anyone who can reach the API can see every transaction. A
  production system must scope every query to the authenticated customer.
* **The API is a demo.** It must not be exposed to the internet as it is: no HTTPS,
  no CSRF protection, an in-memory rate limiter and a hard coded price list.
* **The mock controls exist.** They are forced off in production and whenever
  `PAYMENT_MODE=live`, but they must stay off.
* **The backend does not collect sensitive credentials** either — no PIN, OTP, card
  data or banking credentials are ever requested, stored or logged.
* **A mock `SUCCESS` is not a payment.** It only means the simulator returned
  `SUCCESS`; the record is labelled `simulated: true`.
* **JazzCash successes are verified.** Callbacks are signed with HMAC-SHA256 and a
  forged hash is rejected before anything changes.
* **Easypaisa needs the inquiry API for a verified success.** Its final redirect is
  **not signed**. Configure `EASYPAISA_USERNAME`, `EASYPAISA_PASSWORD` and
  `EASYPAISA_ACCOUNT_NUMBER` to confirm the real state. Without them,
  `EASYPAISA_TRUST_REDIRECT=true` accepts the redirect and records
  `gatewayVerified: false` (the result page warns), while `false` keeps a SUCCESS
  claim `PENDING`.
* **An abandoned live checkout can stay `PENDING`.** There is no expiry or
  reconciliation job yet, so a customer who closes the gateway page leaves the order
  claimed. A production system needs a scheduled status inquiry plus an expiry policy.

See [`server/README.md`](server/README.md#14-security-limitations-and-production-readiness-gaps)
for the full production-readiness gap list.

---

## 12. Design notes

* No gradients, no glassmorphism, no decorative animation — a restrained,
  border-based financial UI.
* One accent colour: a muted green (`#1f6a4f`) for primary actions and success.
  Red is reserved for errors; pending and cancelled use neutral slate tones.
* Responsive from **320 px** upwards: the checkout becomes a single column, the
  transaction table turns into a card list, and the navigation collapses into a
  menu. No horizontal scrolling at any tested width.
* Accessible: labelled inputs, `aria-invalid` + `role="alert"` on validation
  messages, radio-based payment selection (arrow-key friendly), visible focus
  rings, and a Lighthouse accessibility score of 100 for every page.
* JazzCash and Easypaisa are identified by a text label and a small brand-coloured
  marker. No fabricated logo artwork is used.
