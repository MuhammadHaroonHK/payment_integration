# PayLab — Payment Gateway Integration Practice

**PayLab** is a practice project for learning how a mobile payment checkout is built.
It reproduces the shape of a real JazzCash / Easypaisa checkout — order summary,
payment method selection, customer form, review step, result screen and transaction
history — but **every payment is simulated**.

The project has two parts:

| Folder | What it is |
| --- | --- |
| `src/`, `public/`, `index.html` | The **React frontend** (Vite + React + Tailwind CSS) |
| `server/` | The **Express + MongoDB backend** that simulates the payment gateway |

Neither part contacts JazzCash or Easypaisa. The backend stores real records in
MongoDB and simulates the gateway response; the frontend can also run completely
offline with its own built-in simulator.

> **Full backend documentation → [`server/README.md`](server/README.md)**

---

## 1. Project purpose

| Goal | How it is met |
| --- | --- |
| Learn a realistic checkout flow | Six screens modelled on real payment apps (Home, Checkout, Review, Result, History, 404) |
| Practise both gateways | JazzCash and Easypaisa use the exact same UI and the same service interface |
| Practise every outcome | Success, failure, cancelled and pending are all reachable |
| Learn the server side too | A real Express + Mongoose API with validation, transactions, rate limits and tests |
| Be gateway-ready | A provider adapter interface means a real gateway can be added without touching the UI |

**What this project deliberately does NOT do**

* It does not process payments and does not move money.
* It does not contact JazzCash, Easypaisa or any other payment provider.
* It does not ask for a PIN, OTP, password, card number or any banking credential.
* It does not store or transmit payment secrets.

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
npm test             # 48 tests, Vitest + Supertest
```

See [`server/README.md`](server/README.md) for the full API reference, the
environment variables and the list of what a real gateway integration would
still need.

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
│   │   │       ├── gatewayFactory.js # picks the adapter
│   │   │       ├── mockGateway.js     # the working simulator
│   │   │       ├── jazzcashGateway.js # not implemented, documented
│   │   │       └── easypaisaGateway.js# not implemented, documented
│   │   ├── models/              # Order.js · Transaction.js
│   │   ├── routes/              # payment · transaction · order · health
│   │   ├── middleware/          # requestId · validateRequest · rateLimit · notFound · errorHandler
│   │   ├── validators/          # zod schemas
│   │   ├── utils/               # ApiError · asyncHandler · generateReference · money · logger
│   │   ├── app.js               # express app (helmet, cors, rate limit, routes)
│   │   └── server.js            # bootstrap (env -> db -> listen)
│   ├── tests/                  # health · payment · transaction · testControls
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

> **Four files were added** to the requested structure, because they keep a clear
> separation of concerns: `data/gateways.js` (gateway metadata), `context/PaymentStateContext.js`
> (the context object, so the provider file only exports a component),
> `services/transactionStore.js` (the localStorage demo store) and
> `components/payment/SimulatedOutcomeSelector.jsx` (the developer test control).

---

## 7. How the mock payment simulation works

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
   application decides between mock and backend:

   ```js
   export async function createPayment(payload) {
     if (PAYMENT_CONFIG.isMock) {
       return createMockPayment(payload)          // local simulator
     }
     const response = await apiClient.post('/payments/create', payload)
     return response.data                          // real backend
   }
   ```

4. **`mockPaymentService.js`** waits ~1.8 s (so the loading state is visible), then
   returns a transaction record with the status that was selected in the developer
   test control, and stores it in the local demo store.

### The developer test control

On the review page there is a clearly marked **"Developer test control — simulated
result"** panel (dashed amber border, flask icon). It lets you pick the outcome the
mock service returns:

| Outcome | Result status | What the result page shows |
| --- | --- | --- |
| Success | `SUCCESS` | "Demo payment successful" + reference, order, gateway, amount |
| Failure | `FAILED` | "Demo payment failed" + the simulated decline reason |
| Cancelled | `CANCELLED` | "Demo payment cancelled" |
| Pending | `PENDING` | "Demo payment pending" + explanation that it has no final state |

This control is a **testing aid of the local simulator only**. It is never sent to
or received from JazzCash or Easypaisa, and it is not a real gateway feature.

**In backend mode the browser cannot enable it.** The API reports
capabilities.testControlsEnabled when it creates the demo order, and the server
rejects any request that tries to force an outcome while its own controls are
off (TEST_CONTROLS_DISABLED). The controls are always switched off when
NODE_ENV=production.

### Where the mock logic lives

All of it is in `src/services/mockPaymentService.js`. **No React component contains
gateway-processing logic** — components only call `paymentApi.js`, which delegates to
the mock service or to the HTTP client.

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

Every outcome uses the **same** checkout and result UI — only the status changes.

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
| `POST` | `/api/payments/create` | Creates and processes a payment |
| `GET` | `/api/payments/:transactionId/status` | The status of one transaction |
| `GET` | `/api/payments/transactions` | Transaction history with filtering + pagination |
| `GET` | `/api/payments/transactions/:transactionId` | One transaction with its order summary |
| `POST` | `/api/payments/mock/:transactionId/outcome` | **Development only** — force a pending outcome |

### Response envelope

Success:

```json
{ "success": true, "mode": "MOCK", "message": "Simulated payment completed", "data": { } }
```

Error:

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "The request payload is invalid." } }
```

Error codes: `VALIDATION_ERROR`, `ORDER_NOT_FOUND`, `TRANSACTION_NOT_FOUND`,
`INVALID_GATEWAY`, `INVALID_STATUS_TRANSITION`, `DUPLICATE_PAYMENT`,
`GATEWAY_NOT_CONFIGURED`, `DATABASE_ERROR`, `RATE_LIMIT_EXCEEDED`,
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

Because of that layer, **no React component needed to change** when the backend
was added.

---

## 10. The two simulation modes

| | `VITE_PAYMENT_MODE=mock` | `VITE_PAYMENT_MODE=backend` |
| --- | --- | --- |
| Where the simulation runs | In the browser (`mockPaymentService.js`) | On the server (`mockGateway.js`) |
| Needs a server | No | Yes — the API and MongoDB |
| Where the data lives | `localStorage` on this device | MongoDB |
| Where the price comes from | `src/data/demoOrder.js` | `server/src/config/demoCatalogue.js` |
| Reference format | `JC-7F3K9Q` | `PAYLAB-TXN-7F3K9Q2` |
| Is the amount trusted? | n/a — nothing leaves the browser | **No** — the server recalculates every amount |

Both modes use the **same UI**, the same gateway selection and the same four
outcomes. Switching is a one line change in `.env`.

---

## 11. Security limitations

### The frontend

* **No real payment is possible.** The browser cannot talk to JazzCash or Easypaisa
  safely — the merchant secret would have to be shipped to the client. That is why
  every real gateway integration needs a server.
* **`localStorage` is not a database.** Demo records are plain text in the browser.
  They can be edited, copied or deleted by the user, and they are not protected.
* **`VITE_` variables are public.** Everything prefixed with `VITE_` ends up in the
  JavaScript bundle. Never put credentials there.
* **Never collect secrets in the frontend.** This project does not ask for a PIN,
  OTP, password, card number, CVV or banking credential.
* **Client-side validation is a convenience, not a guarantee.** The backend validates
  every field again.

### The backend

* **No authentication.** Anyone who can reach the API can see every demo
  transaction. A production system must scope every query to the authenticated
  customer or an authorised administrator.
* **The API is a demo.** It must not be exposed to the internet as it is: no HTTPS,
  no CSRF protection, an in-memory rate limiter and a hard coded price list.
* **The mock controls exist.** They are forced off in production by the
  configuration, but they must stay off.
* **The backend does not collect sensitive credentials** either — no PIN, OTP, card
  data or banking credentials are ever requested, stored or logged.
* **A `SUCCESS` status is not a verified payment.** It only means the simulator
  returned `SUCCESS`.

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
