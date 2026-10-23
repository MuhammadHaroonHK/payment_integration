# PayLab API — Backend

The backend for **PayLab**, a practice project for learning how a JazzCash / Easypaisa
payment checkout works.

It exposes a small, well defined REST API that the React frontend in the parent
folder talks to. Every payment it processes is **simulated**: no gateway is
contacted, no money moves and no merchant account is needed.

---

## 1. What this backend is (and is not)

| ✅ It does | ❌ It does not |
| --- | --- |
| Run a complete checkout flow against a real database | Contact JazzCash or Easypaisa |
| Store orders and transactions in MongoDB | Move money or verify a real payment |
| Decide the payable amount from server-side pricing | Trust a price sent by the browser |
| Simulate success, failure, cancelled and pending | Accept a success message from the browser |
| Provide a stable gateway adapter interface | Pretend that a real integration is finished |
| Reject unsupported gateways and unsafe requests | Collect PINs, OTPs, card data or passwords |

> **Mock mode does not prove that the official gateways will accept a real
> transaction.** It only proves that *this* application handles a payment
> lifecycle correctly.

---

## 2. Architecture

```text
HTTP request
    │
    ▼
middleware/  requestId → security headers → CORS → body parser → validation
    │
    ▼
routes/      paymentRoutes · transactionRoutes · orderRoutes · healthRoutes
    │
    ▼
controllers/ read the request, call a service, shape the response  (no logic)
    │
    ▼
services/    paymentService · transactionService · orderService   (the rules)
    │
    ├── gateways/  gatewayFactory → mockGateway | jazzcashGateway | easypaisaGateway
    │
    ▼
models/      Order · Transaction   (Mongoose schemas)
```

**The layering rule:** a controller never touches Mongoose, and a service never
touches `req` / `res`. That keeps the payment rules in one place and makes them
testable without HTTP.

### The gateway adapter interface

Every provider implements the same three functions, so the rest of the code is
provider agnostic:

```js
createPayment({ amount, currency, order, customer, outcome })
  -> { status, gatewayReference, failureReason, message }

getStatus(gatewayReference, currentStatus)
  -> { status, gatewayReference, failureReason }

describe()
  -> { name, displayName, simulated, supportedOutcomes }
```

| Adapter | State | Behaviour |
| --- | --- | --- |
| `mockGateway.js` | **working** | Simulates both JazzCash and Easypaisa, all four outcomes |
| `jazzcashGateway.js` | not implemented | Throws `GATEWAY_NOT_CONFIGURED` (501) |
| `easypaisaGateway.js` | not implemented | Throws `GATEWAY_NOT_CONFIGURED` (501) |

---

## 3. Requirements

| Software | Version | Notes |
| --- | --- | --- |
| Node.js | 20 or newer | developed on Node 22 |
| npm | 10 or newer | |
| MongoDB | 6 or newer | any local or Atlas instance |

Check your installation:

```bash
node --version
npm --version
mongosh --version      # or: mongo --version
```

---

## 4. MongoDB setup

The API needs a running MongoDB with a database it may write to.

**Local MongoDB (default)**

```bash
# macOS (Homebrew)
brew install mongodb-community
brew services start mongodb-community

# Windows (installer) — the service starts automatically
# Ubuntu/Debian
sudo systemctl start mongod
```

The default connection string is `mongodb://127.0.0.1:27017/paylab`, which
matches the shipped `.env.example`.

**No MongoDB installed?** Either install it as above, or point `MONGODB_URI` at
a free MongoDB Atlas cluster.

**Check the connection**

```bash
mongosh "mongodb://127.0.0.1:27017/paylab" --eval "db.runCommand({ ping: 1 })"
```

---

## 5. Environment variables

Copy the example file and adjust it:

```bash
cp .env.example .env      # macOS / Linux
copy .env.example .env    # Windows PowerShell / cmd
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development` · `test` · `production` |
| `PORT` | `5000` | Port the API listens on |
| `CLIENT_URL` | `http://localhost:5173` | The **only** origin allowed to call the API from a browser |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/paylab` | Database connection string |
| `PAYMENT_MODE` | `mock` | `mock` is the only supported mode. `live` makes the server refuse to start |
| `ENABLE_TEST_CONTROLS` | `true` | Allows forcing a transaction outcome. Always ignored in production |
| `MOCK_GATEWAY_DELAY_MS` | `600` | Simulated gateway latency |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window |
| `RATE_LIMIT_MAX` | `20` | Payment creations per window |
| `LOG_LEVEL` | `info` | `fatal` · `error` · `warn` · `info` · `debug` · `trace` · `silent` |

### Configuration safety

* **Missing or invalid values stop the server at startup** with a readable
  message — the API never starts half configured.
* `PAYMENT_MODE=live` **refuses to start**. No authorised adapter exists yet,
  and silently simulating a "real" payment would be the worst possible
  failure mode.
* `ENABLE_TEST_CONTROLS` is **forced off** when `NODE_ENV=production` or when
  `PAYMENT_MODE` is not `mock`, whatever the `.env` file says.

> ### ⚠️ Never put a real secret in `.env` and commit it
> `.env` is git-ignored. `.env.example` is committed and may only contain
> public or local values.

---

## 6. Installation and running

```bash
cd server
npm install
cp .env.example .env      # optional, the defaults already work
npm run dev
```

The API is then available at <http://localhost:5000/api>.

Check that it is alive:

```bash
curl http://localhost:5000/api/health
```

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the API with file watching (`node --watch`) |
| `npm start` | Starts the API normally |
| `npm test` | Runs the automated test suite once |
| `npm run test:watch` | Runs the tests in watch mode |
| `npm run lint` | Runs ESLint |
| `npm run dev:nodemon` | Starts the API with `npx nodemon` instead |

> **Why `node --watch` instead of nodemon?**
> The latest `nodemon` still depends on `chokidar@3`, which pulls in a
> `braces` version with a known high severity denial-of-service advisory
> (`GHSA-vfj7-8cjw-p6xm`). Node's built-in watcher does the same job with no
> vulnerable dependency, so `npm audit` stays clean. The nodemon command is
> still available if you prefer it.

---

## 7. API reference

Base URL: `http://localhost:5000/api`

Every successful response uses the same envelope:

```json
{
  "success": true,
  "mode": "MOCK",
  "message": "Simulated payment completed",
  "data": { }
}
```

Every error uses the same envelope:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request payload is invalid.",
    "details": [{ "field": "gateway", "message": "Too small: expected string to have >=1 characters" }]
  }
}
```

`mode` is always `MOCK` today. It exists so the frontend can label every
record as simulated without guessing.

### Error codes

| Code | HTTP | When |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | The request body, query or params are invalid |
| `TEST_CONTROLS_DISABLED` | 400 | Someone tried to force an outcome while the test controls are off |
| `INVALID_GATEWAY` | 400 | The gateway name is not JazzCash or Easypaisa |
| `ORDER_NOT_FOUND` | 404 | No order with that order number |
| `TRANSACTION_NOT_FOUND` | 404 | No transaction with that reference |
| `NOT_FOUND` | 404 | Unknown route |
| `DUPLICATE_PAYMENT` | 409 | The order was already paid, or is being paid right now |
| `INVALID_STATUS_TRANSITION` | 409 | The status change is not allowed |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many payment requests |
| `GATEWAY_NOT_CONFIGURED` | 501 | A real gateway adapter was requested but is not implemented |
| `DATABASE_ERROR` | 503 | The database is unreachable |
| `INTERNAL_SERVER_ERROR` | 500 | Anything unexpected |

---

### `GET /api/health`

```bash
curl http://localhost:5000/api/health
```

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "api": "PayLab API",
    "version": "0.1.0",
    "environment": "development",
    "uptimeSeconds": 42,
    "timestamp": "2026-10-22T10:15:00.000Z",
    "database": { "connected": true, "state": "connected", "name": "paylab" },
    "payments": {
      "mode": "MOCK",
      "simulated": true,
      "testControlsEnabled": true,
      "gateways": [
        { "gateway": "JAZZCASH", "provider": "MOCK", "displayName": "JazzCash (simulated)", "simulated": true, "implemented": true, "supportedOutcomes": ["PENDING", "SUCCESS", "FAILED", "CANCELLED"] },
        { "gateway": "EASYPAISA", "provider": "MOCK", "displayName": "Easypaisa (simulated)", "simulated": true, "implemented": true, "supportedOutcomes": ["PENDING", "SUCCESS", "FAILED", "CANCELLED"] }
      ],
      "note": "Simulated responses only. No real payment provider is contacted."
    }
  }
}
```

Returns `200` when the database is reachable and `503` when it is not.
**It never exposes the connection string, the host or any credential.**

---

### `GET /api/orders/demo`

Creates a **new, single use demo order** from the server controlled price list
and returns it.

```bash
curl "http://localhost:5000/api/orders/demo?quantity=2"
```

```json
{
  "success": true,
  "mode": "MOCK",
  "message": "Demo order created from the server catalogue.",
  "data": {
    "id": "6ad9ba4c1b2c3d4e5f60718",
    "orderNumber": "PAYLAB-DEMO-ERDWHVEG",
    "status": "PENDING",
    "currency": "PKR",
    "quantity": 2,
    "items": [
      {
        "productCode": "PAYLAB-FE-04",
        "name": "Frontend Engineering Practice — Module 04",
        "description": "Checkout flow, form validation and result states",
        "quantity": 2,
        "unitPrice": 450000,
        "unitPriceFormatted": "PKR 4,500",
        "lineTotal": 900000,
        "lineTotalFormatted": "PKR 9,000"
      }
    ],
    "subtotal": 900000,
    "subtotalFormatted": "PKR 9,000",
    "serviceFee": 15000,
    "serviceFeeFormatted": "PKR 150",
    "totalAmount": 915000,
    "totalAmountFormatted": "PKR 9,150",
    "customer": { "name": "", "email": "", "mobile": "" },
    "createdAt": "2026-10-22T10:15:00.000Z",
    "updatedAt": "2026-10-22T10:15:00.000Z"
  },
  "capabilities": { "testControlsEnabled": true }
}
```

> **All amounts are integer paisa.** `450000` = PKR 4,500. The
> `…Formatted` fields are the same amount for humans.
>
> `capabilities.testControlsEnabled` tells the frontend whether the
> development-only outcome control may be shown. **The browser can never
> enable it by itself.**

---

### `POST /api/payments/create`

Creates and processes a payment.

```bash
curl -X POST http://localhost:5000/api/payments/create \
  -H "Content-Type: application/json" \
  -d '{ "orderNumber": "PAYLAB-DEMO-ERDWHVEG", "gateway": "JAZZCASH" }'
```

**Request**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `orderNumber` | string | yes¹ | The order to pay |
| `gateway` | string | yes | `JAZZCASH` or `EASYPAISA` (case insensitive) |
| `customer` | object | no | `{ fullName, email, phone }` |
| `quantity` | number | no | 1–20. The price always comes from the server |
| `simulatedOutcome` | string | no | **Development only.** `SUCCESS` · `FAILED` · `CANCELLED` · `PENDING` |

¹ `orderNumber` may also be sent as `order: { orderNumber }` — that is the
shape the React frontend uses.

> ⚠️ **The browser never decides the amount.** Any `amount`, `total` or
> `subtotal` sent by the client is ignored. The server recalculates the
> payable amount from the stored order and the requested quantity.

**Response `201`**

```json
{
  "success": true,
  "mode": "MOCK",
  "message": "Simulated payment completed",
  "data": {
    "id": "6ad9ba0001327212921a95b8",
    "transactionReference": "PAYLAB-TXN-Q8L29T38",
    "orderId": "6ad9ba0001327212921a95b7",
    "orderNumber": "PAYLAB-DEMO-ERDWHVEG",
    "gateway": "JAZZCASH",
    "gatewayName": "JazzCash",
    "amount": 465000,
    "amountFormatted": "PKR 4,650",
    "currency": "PKR",
    "status": "SUCCESS",
    "mode": "MOCK",
    "failureReason": null,
    "gatewayReference": "SIM-MOCK-JAZZCASH-QYEB5GJJ",
    "simulated": true,
    "breakdown": {
      "unitPrice": 450000,
      "subtotal": 450000,
      "subtotalFormatted": "PKR 4,500",
      "serviceFee": 15000,
      "serviceFeeFormatted": "PKR 150",
      "total": 465000,
      "totalFormatted": "PKR 4,650",
      "quantity": 1
    },
    "customer": { "name": "Ayesha Khan", "email": "ayesha.khan@example.com", "mobile": "03001234567" },
    "createdAt": "2026-10-22T10:15:00.000Z",
    "updatedAt": "2026-10-22T10:15:01.000Z"
  }
}
```

> `gatewayReference` always starts with `SIM-MOCK-`. It is a **clearly
> labelled simulated reference** and can never be mistaken for an official
> JazzCash or Easypaisa transaction id. The internal reference is
> `PAYLAB-TXN-…`.

**Errors**

| Situation | Response |
| --- | --- |
| Unknown order | `404 ORDER_NOT_FOUND` |
| Unknown gateway | `400 INVALID_GATEWAY` |
| Invalid body | `400 VALIDATION_ERROR` |
| Order already paid | `409 DUPLICATE_PAYMENT` |
| `simulatedOutcome` while the test controls are off | `400 TEST_CONTROLS_DISABLED` |
| Too many requests | `429 RATE_LIMIT_EXCEEDED` |

---

### `GET /api/payments/:transactionId/status`

```bash
curl http://localhost:5000/api/payments/PAYLAB-TXN-Q8L29T38/status
```

Returns the same transaction record as above, with `updatedAt` showing the
last change. The identifier may be a transaction reference **or** a Mongo
id. An unknown identifier returns `404 TRANSACTION_NOT_FOUND`.

---

### `GET /api/payments/transactions`

```bash
curl "http://localhost:5000/api/payments/transactions?page=1&limit=10&gateway=JAZZCASH&status=SUCCESS"
```

| Parameter | Default | Notes |
| --- | --- | --- |
| `page` | `1` | Page number |
| `limit` | `20` | 1–100 items per page |
| `gateway` | all | `JAZZCASH` · `EASYPAISA` · `all` |
| `status` | all | `PENDING` · `SUCCESS` · `FAILED` · `CANCELLED` · `all` |
| `search` | — | Matches the order number or the transaction reference |

```json
{
  "success": true,
  "mode": "MOCK",
  "data": {
    "transactions": [ { "transactionReference": "PAYLAB-TXN-Q8L29T38", "...": "..." } ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 7,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPreviousPage": false
    }
  },
  "transactions": [ ],
  "pagination": { }
}
```

> ⚠️ **This endpoint has no authentication.** The practice project has no
> users, so every demo transaction is visible to anyone who can reach the API.
> In production the query must be scoped to the authenticated customer or to an
> authorised administrator. See §10.

---

### `GET /api/payments/transactions/:transactionId`

Returns one transaction **including its order summary** (`data.order` with
the items and the totals).

---

### `POST /api/payments/mock/:transactionId/outcome` — development only

Forces the outcome of a transaction that is still `PENDING`.

```bash
curl -X POST http://localhost:5000/api/payments/mock/PAYLAB-TXN-Q8L29T38/outcome \
  -H "Content-Type: application/json" \
  -d '{ "outcome": "SUCCESS" }'
```

This route **is not registered at all** unless `NODE_ENV` is `development` (or
`test`), `PAYMENT_MODE=mock` and `ENABLE_TEST_CONTROLS=true`. In production it
returns `404`.

---

## 8. How the mock payment works

1. The client posts an order number and a gateway.
2. The server loads the order and checks that it is `PENDING`.
3. The server recalculates the payable amount from the **stored** unit price
   and service fee (the client's numbers are ignored).
4. The server claims the order with an atomic update, so two simultaneous
   requests cannot both charge it.
5. The server creates a `PENDING` transaction.
6. The mock gateway waits `MOCK_GATEWAY_DELAY_MS` and returns a status.
7. The server updates the transaction and moves the order to a matching state:

| Transaction | Order | Note |
| --- | --- | --- |
| `SUCCESS` | `PAID` | final — a second attempt returns `DUPLICATE_PAYMENT` |
| `FAILED` | `PENDING` | the customer may try again |
| `CANCELLED` | `CANCELLED` | final |
| `PENDING` | `PENDING` | not final — use the mock control to finish it |

> A `PENDING` transaction is **never** quietly turned into a success. It stays
> pending until a trusted backend action (the mock control) changes it.

### How to test each outcome

Use the development test control on the review page of the frontend, or call
the API directly:

```bash
# FAILED
curl -X POST http://localhost:5000/api/payments/create \
  -H "Content-Type: application/json" \
  -d '{ "orderNumber": "PAYLAB-DEMO-ERDWHVEG", "gateway": "JAZZCASH", "simulatedOutcome": "FAILED" }'
```

Replace `FAILED` with `SUCCESS`, `CANCELLED` or `PENDING`.


### How the frontend selects an outcome

The outcome is deliberately kept **out of the payment request that a real
integration would use**. The frontend uses two separate, clearly labelled paths:

1. **The developer test control** on the review page. It is only rendered when the
   API reports `capabilities.testControlsEnabled: true`, which the server only does
   when `NODE_ENV` is `development` (or `test`), `PAYMENT_MODE=mock` and
   `ENABLE_TEST_CONTROLS=true`. The browser can therefore never turn the controls on
   by itself.
2. **The development-only endpoint**
   `POST /api/payments/mock/:transactionId/outcome`. The route is not even
   registered unless the same conditions are met, so in production it answers
   `404`. This is what lets a `PENDING` transaction be finished later, exactly the
   way a real gateway callback would finish it — without pretending that a real
   callback was received.

The `simulatedOutcome` field on `POST /api/payments/create` is the third path and
is the least interesting one: it exists so a test can ask for a specific outcome in
a single call. It is only honoured while the test controls are enabled, and a
request that tries to use it while they are off is rejected with
`TEST_CONTROLS_DISABLED` rather than being silently ignored.

When a real gateway is implemented, the first two paths disappear from the
production build and the third is rejected, because the adapter decides the
outcome — not the browser.
If the controls are disabled the request is **rejected** with
`TEST_CONTROLS_DISABLED` — the outcome can never be forced silently.

---

## 9. Running the tests

```bash
cd server
npm test
```

The suite uses **Vitest + Supertest** and covers:

| # | Test |
| --- | --- |
| 1 | Health endpoint response |
| 2 | Database connection failure handling (503 / degraded) |
| 3 | Successful JazzCash mock payment |
| 4 | Successful Easypaisa mock payment |
| 5 | Failed payment simulation |
| 6 | Cancelled payment simulation |
| 7 | Pending payment simulation |
| 8 | Invalid gateway rejection |
| 9 | Missing order rejection |
| 10 | Invalid request validation |
| 11 | Transaction status retrieval |
| 12 | Transaction history filtering and pagination |
| 13 | Duplicate payment prevention |
| 14 | Invalid status transition rejection |
| 15 | Development test controls disabled |
| 16 | Real gateway mode rejected when no real adapter is configured |
| 17 | The server never trusts an amount sent by the browser |
| 18 | The health endpoint never leaks the connection string |

### Test data strategy

The tests use a **separate database** so your development data is never
touched:

```text
MONGODB_URI_TEST=mongodb://127.0.0.1:27017/paylab_test
```

If that variable is not set, the suite uses `MONGODB_URI` with the database
name replaced by `paylab_test`. Every collection is emptied before each test,
and the database is dropped when the run finishes.

**The tests need a running MongoDB.** They never call a real payment service
and never write to the `paylab` development database.

---

## 10. Connecting the React frontend

1. Start the backend:

   ```bash
   cd server
   npm run dev
   ```

2. In the **frontend** folder (the project root), create `.env`:

   ```env
   VITE_API_BASE_URL=http://localhost:5000/api
   VITE_PAYMENT_MODE=backend
   ```

3. Start the frontend:

   ```bash
   npm install
   npm run dev
   ```

4. Open <http://localhost:5173>.

### How the two sides fit together

The frontend talks to the API through `src/services/paymentApi.js`, which is
the only module allowed to perform payment calls. `src/services/apiAdapters.js`
translates the API contract into the shapes the React components expect, so
**no component had to be rewritten**.

| API contract | Frontend shape | Handled by |
| --- | --- | --- |
| `{ success, data }` envelope | bare object | `unwrap()` |
| `transactionReference` | `transactionRef` | `toFrontendTransaction()` |
| `failureReason` | `reason` | `toFrontendTransaction()` |
| `JAZZCASH` | `jazzcash` | `toFrontendGateway()` |
| paisa (465000) | rupees (4650) | `toRupees()` |

The frontend can also run completely offline:

```env
VITE_PAYMENT_MODE=mock
```

In that mode the built-in browser simulator takes over and the server is not
needed at all.

---

## 11. Why merchant credentials are not needed

* The mock gateway is a local function. It fabricates a result, adds a small
  delay and returns a clearly labelled `SIM-MOCK-…` reference. There is no
  network call and no account behind it.
* The price list lives in `src/config/demoCatalogue.js`, so the server can
  create realistic orders without a product database.
* The whole point of the practice project is to learn the **flow** — create →
  pending → final → record → list — without being blocked by merchant
  onboarding.

---

## 12. What is still required for a real JazzCash integration

The `jazzcashGateway.js` adapter is a documented placeholder. To complete it
you need, **from JazzCash's official merchant documentation**:

* the documented payment-session endpoint, its path, method and version;
* the request field names, formats and which of them are mandatory;
* the response field names and the status / error code table;
* the hosted checkout (redirect) URL and the full list of return parameters;
* the server-to-server verification endpoint and its payload;
* the signature algorithm, the fields it covers and the secret used to compute it;
* the webhook / callback contract and its verification rules;
* which status values are final.

**And these credentials, issued by JazzCash:**

* merchant ID (username);
* password / secret;
* integrity salt / signing key;
* the sandbox and production base URLs;
* a verified merchant return URL and server notification URL.

**And these implementation rules:**

* every credential stays on the server — `VITE_` variables are public;
* the amount sent to the gateway is the amount the server calculated;
* a transaction is only marked `SUCCESS` after the server verified the
  gateway response or callback;
* the signature is compared with a constant-time comparison.

---

## 13. What is still required for a real Easypaisa integration

The `easypaisaGateway.js` adapter needs the same things from Easypaisa's
official merchant / staging documentation:

* the payment initiation endpoint, path, method and version;
* the request and response field names and the status / error code table;
* the hosted mobile-web checkout URL and the return parameter list;
* the server-to-server verification endpoint and payload;
* the signature algorithm, the covered fields and the shared secret;
* the webhook / callback contract;
* which status values are final.

**And these credentials, issued by Easypaisa:**

* the merchant / store account id;
* the Easypaisa username;
* the Easypaisa password;
* the integrity salt used for signing;
* the sandbox / staging and production base URLs;
* a verified merchant return URL and server notification URL.

The same implementation rules as JazzCash apply.

---

## 14. Security limitations and production readiness gaps

This API is a **learning project**. It is not safe to expose to the internet.

| Gap | What is missing for production |
| --- | --- |
| **No authentication** | Every transaction is visible to anyone who can reach the API. Add sessions or JWTs and scope every query to the authenticated customer |
| **No authorisation** | There is no notion of "own order". Scoping must be added with the authentication |
| **Demo pricing** | `demoCatalogue.js` is a hard coded price list. A real shop needs a product catalogue or an order intake service |
| **No HTTPS** | Run behind a reverse proxy that terminates TLS |
| **No CSRF protection** | Add it once cookie based sessions are used |
| **Rate limits are per IP and in memory** | Use a shared store (Redis) behind more than one instance |
| **No audit log** | A production system needs an immutable record of every state change |
| **Customer data is stored in plain text** | Decide on a retention policy, and encrypt or hash what you do not need |
| **The mock controls exist** | They are forced off in production by the configuration, but they must stay off |
| **No webhook endpoint** | A real integration needs a signed callback endpoint and a reconciliation job |
| **No idempotency keys** | Add an `Idempotency-Key` header so a retried request cannot create a second transaction |

### What this API deliberately does **not** collect

No password, PIN, OTP, CVV, card number or banking credential is ever
requested, stored or logged. A real integration collects those inside the
gateway's own hosted page, never inside an application form.

Customer names, email addresses and mobile numbers are stored because the demo
needs them, and the structured logger redacts them so they do not end up in
the log files.
