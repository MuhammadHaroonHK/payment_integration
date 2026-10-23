# PayLab API — Backend

The backend for **PayLab**, a practice project for learning how a JazzCash / Easypaisa
payment checkout works.

It exposes a small, well defined REST API that the React frontend in the parent
folder talks to. It can run in two modes:

* `PAYMENT_MODE=mock` — a local simulator; no provider is contacted.
* `PAYMENT_MODE=live` — real hosted-checkout adapters for JazzCash and Easypaisa
  (sandbox by default), with signed requests and verified callbacks.

---

## 1. What this backend is (and is not)

| ✅ It does | ❌ It does not |
| --- | --- |
| Run a complete checkout flow against a real database | Ask for a PIN, OTP, card number or password |
| Store orders and transactions in MongoDB | Trust a price sent by the browser |
| Decide the payable amount from server-side pricing | Accept a success message from the browser |
| Simulate success, failure, cancelled and pending in mock mode | Pretend a simulation is a real payment |
| Build signed JazzCash / Easypaisa hosted-checkout requests | Store gateway secrets in MongoDB or logs |
| Verify a JazzCash signature (and Easypaisa via the inquiry API) before `SUCCESS` | Claim an unverified Easypaisa result is verified |
| Reject unsupported gateways and unsafe requests | Move money in sandbox mode |

> **Mock mode does not prove that the official gateways will accept a real
> transaction.** It only proves that *this* application handles a payment
> lifecycle correctly. Live sandbox mode is the step that exercises the provider.

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

Two adapter shapes exist, because a hosted checkout is not an immediate result:

```js
// Mock provider — answers immediately
createPayment({ amount, currency, order, customer, outcome })
  -> { status, gatewayReference, failureReason, message }

// Live provider — returns a signed form the browser must POST
createPayment({ amount, currency, order, customer,
                transactionReference, gatewayTxnRef })
  -> { status: 'PENDING', gatewayTxnRef, redirect: { url, method, fields } }

// Both live adapters
verifyCallback(payload) -> { status, gatewayTxnRef, gatewayReference,
                             failureReason, amountPaisa, verified }
getStatus(gatewayTxnRef) -> { status, gatewayReference, amountPaisa, verified }

describe()
  -> { name, implemented, configured, environment, flow, requiredEnv, ... }
```

`gatewayFactory.js` only returns a live adapter when `PAYMENT_MODE=live`.

| Adapter | State | Behaviour |
| --- | --- | --- |
| `mockGateway.js` | **working** | Simulates both gateways, all four outcomes |
| `jazzcashGateway.js` | **implemented** | Hosted checkout, HMAC-SHA256 signing, signed return + IPN, status inquiry |
| `easypaisaGateway.js` | **implemented** | Easypay hosted checkout, AES/ECB hashing, confirmation step, optional inquiry |

Both live adapters throw `GATEWAY_NOT_CONFIGURED` (HTTP 503) when their credentials
are missing, and log which variables are missing at startup.

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
| `CLIENT_URL` | `http://localhost:5173` | The **only** origin allowed to call the API from a browser. Also where the gateway callbacks send the customer back to |
| `PUBLIC_BASE_URL` | `http://localhost:5000` | Public origin of the API, used to build the gateway return URLs. Use an HTTPS tunnel when the gateway portal demands one |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/paylab` | Database connection string |
| `PAYMENT_MODE` | `mock` | `mock` = local simulator · `live` = real hosted checkout |
| `ENABLE_TEST_CONTROLS` | `true` | Allows forcing a transaction outcome. Always ignored outside mock mode |
| `MOCK_GATEWAY_DELAY_MS` | `600` | Simulated gateway latency |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window |
| `RATE_LIMIT_MAX` | `20` | Payment creations per window |
| `LOG_LEVEL` | `info` | `fatal` · `error` · `warn` · `info` · `debug` · `trace` · `silent` |
| `JAZZCASH_ENVIRONMENT` | `sandbox` | `sandbox` · `production` |
| `JAZZCASH_MERCHANT_ID` | — | Merchant ID from JazzCash |
| `JAZZCASH_PASSWORD` | — | Merchant password from JazzCash |
| `JAZZCASH_INTEGRITY_SALT` | — | HMAC-SHA256 signing key from JazzCash |
| `JAZZCASH_TXN_TYPE` | — | `""` (customer chooses) · `MWALLET` · `MPAY` · `OTC` |
| `JAZZCASH_RETURN_URL` | derived | Optional override of the registered return URL |
| `EASYPAISA_ENVIRONMENT` | `sandbox` | `sandbox` · `production` |
| `EASYPAISA_STORE_ID` | — | Store / merchant id from the Easypay portal |
| `EASYPAISA_HASH_KEY` | — | 16, 24 or 32 character hash key from Easypay |
| `EASYPAISA_USERNAME` | — | Optional REST API username (enables inquiry verification) |
| `EASYPAISA_PASSWORD` | — | Optional REST API password |
| `EASYPAISA_ACCOUNT_NUMBER` | — | Optional merchant account number (inquiry) |
| `EASYPAISA_PAYMENT_METHOD` | — | `""` · `MA_PAYMENT_METHOD` · `OTC_PAYMENT_METHOD` · `CC_PAYMENT_METHOD` |
| `EASYPAISA_RETURN_URL` | derived | Optional override of the registered return URL |
| `EASYPAISA_TRUST_REDIRECT` | `false` in code, `true` in `.env.example` | Accept an unsigned SUCCESS redirect when the inquiry credentials are absent. The record is stored with `gatewayVerified: false` |

### Configuration safety

* **Missing or invalid values stop the server at startup** with a readable
  message — the API never starts half configured.
* `PAYMENT_MODE=live` is supported. A gateway whose credentials are missing
  does not stop the server, but every payment request for it is refused with
  `GATEWAY_NOT_CONFIGURED`, and the missing variable names are logged at
  startup.
* `ENABLE_TEST_CONTROLS` is **forced off** when `NODE_ENV=production` or when
  `PAYMENT_MODE` is not `mock`, whatever the `.env` file says.
* Easypaisa's final redirect is **not signed**. When no inquiry credentials are
  configured, a SUCCESS claim is kept `PENDING` by default. Setting
  `EASYPAISA_TRUST_REDIRECT=true` accepts it and records
  `gatewayVerified: false`; the UI then shows an explicit unverified warning.

> ### ⚠️ Never put a real secret in `.env` and commit it
> `.env` is git-ignored (including `server/.env`). `.env.example` is committed
> and may only contain public or local values. Never copy a gateway credential
> into the frontend `.env` — every `VITE_` variable is bundled into the browser.

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

`mode` is `MOCK` (simulator) or `LIVE` (real hosted checkout). It exists so the
frontend can label every record correctly without guessing.

### Error codes

| Code | HTTP | When |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | The request body, query or params are invalid |
| `TEST_CONTROLS_DISABLED` | 400 | Someone tried to force an outcome while the test controls are off |
| `INVALID_GATEWAY` | 400 | The gateway name is not JazzCash or Easypaisa |
| `INVALID_SIGNATURE` | 400 | A gateway callback failed signature verification |
| `AMOUNT_MISMATCH` | 400 | The gateway reported an amount different from the stored amount |
| `ORDER_NOT_FOUND` | 404 | No order with that order number |
| `TRANSACTION_NOT_FOUND` | 404 | No transaction with that reference |
| `NOT_FOUND` | 404 | Unknown route |
| `DUPLICATE_PAYMENT` | 409 | The order was already paid, or is being paid right now |
| `INVALID_STATUS_TRANSITION` | 409 | The status change is not allowed |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many payment requests |
| `GATEWAY_NOT_CONFIGURED` | 503 | A live gateway is missing its credentials |
| `GATEWAY_UNAVAILABLE` | 502 | The provider could not be reached for an inquiry |
| `GATEWAY_ERROR` | 502 | The provider returned an unusable/unsigned response |
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

Creates a payment.

* In **mock mode** it is processed immediately and the response contains the final
  transaction.
* In **live mode** it creates a `PENDING` transaction and returns a `redirect`
  object; the browser must POST those fields to the gateway's hosted page.

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
| `simulatedOutcome` | string | no | **Mock + development only.** `SUCCESS` · `FAILED` · `CANCELLED` · `PENDING` |

¹ `orderNumber` may also be sent as `order: { orderNumber }` — that is the
shape the React frontend uses.

> ⚠️ **The browser never decides the amount.** Any `amount`, `total` or
> `subtotal` sent by the client is ignored. The server recalculates the
> payable amount from the stored order and the requested quantity.

**Response `201` — mock mode**

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
    "gatewayTxnRef": null,
    "gatewayVerified": false,
    "gatewayEnvironment": null,
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
  },
  "redirect": null
}
```

> `gatewayReference` from the mock always starts with `SIM-MOCK-`. It can never be
> mistaken for an official JazzCash or Easypaisa transaction id.

**Response `201` — live mode**

```json
{
  "success": true,
  "mode": "LIVE",
  "message": "Redirecting to the payment gateway",
  "data": {
    "transactionReference": "PAYLAB-TXN-Q8L29T38",
    "status": "PENDING",
    "mode": "LIVE",
    "simulated": false,
    "gatewayTxnRef": "T2026102210150012345",
    "gatewayEnvironment": "sandbox",
    "gatewayVerified": false
  },
  "redirect": {
    "url": "https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/",
    "method": "POST",
    "fields": {
      "pp_Version": "1.1",
      "pp_TxnRefNo": "T2026102210150012345",
      "pp_Amount": "465000",
      "pp_SecureHash": "…64 upper-case hex characters…"
    }
  }
}
```

The frontend creates a hidden form with those fields and submits it.

> **What the browser sees.** The signing secret (JazzCash `JAZZCASH_INTEGRITY_SALT`,
> Easypaisa `EASYPAISA_HASH_KEY`) never leaves the server. JazzCash's hosted form
> does include `pp_Password`, because that field is part of JazzCash's own protocol;
> it is sent by the browser to JazzCash, not stored by PayLab. Easypaisa only
> receives `merchantHashedReq`.

**Errors**

| Situation | Response |
| --- | --- |
| Unknown order | `404 ORDER_NOT_FOUND` |
| Unknown gateway | `400 INVALID_GATEWAY` |
| Invalid body | `400 VALIDATION_ERROR` |
| Order already paid | `409 DUPLICATE_PAYMENT` |
| `simulatedOutcome` while the test controls are off | `400 TEST_CONTROLS_DISABLED` |
| Live gateway missing credentials | `503 GATEWAY_NOT_CONFIGURED` |
| Too many requests | `429 RATE_LIMIT_EXCEEDED` |

---

### `GET /api/payments/:transactionId/status`

```bash
curl http://localhost:5000/api/payments/PAYLAB-TXN-Q8L29T38/status
```

Returns the same transaction record as above, with `updatedAt` showing the
last change. The identifier may be a transaction reference **or** a Mongo
id. An unknown identifier returns `404 TRANSACTION_NOT_FOUND`.

When a live transaction is still `PENDING`, the result page polls this endpoint
until the gateway callback has produced a final status.

---

### Gateway callback endpoints

These routes belong to the gateway and the customer's browser, not to the React
app. They are never called with JSON and are not rate limited (the provider must
be able to deliver them).

| Route | Who calls it | What it does |
| --- | --- | --- |
| `POST /api/payments/jazzcash/return` | JazzCash → customer's browser | Verifies `pp_SecureHash`, matches `pp_TxnRefNo`, checks the amount, then `303` to the result page |
| `POST /api/payments/jazzcash/ipn` | JazzCash → server | Same verification; answers with a signed `{ pp_ResponseCode: "000", pp_SecureHash }` acknowledgement |
| `GET\|POST /api/payments/easypaisa/return` | Easypaisa → customer's browser | Receives `auth_token` and forwards it to Easypaisa's `Confirm.jsf` page |
| `GET\|POST /api/payments/easypaisa/callback` | Easypaisa → customer's browser | Reads the final `status` / `orderRefNumber`; uses the inquiry API when configured |

**Security rules**

* A JazzCash callback is accepted only if the HMAC-SHA256 signature matches.
  A missing or wrong signature returns `400 INVALID_SIGNATURE` and the transaction
  stays `PENDING`.
* The amount in the callback must equal the amount stored on the transaction
  (`AMOUNT_MISMATCH` otherwise). The browser cannot lower the price.
* A final transaction is **never** changed by a repeated callback; the second
  callback simply returns the existing record.
* Easypaisa's final redirect is **not signed**. If `EASYPAISA_USERNAME`,
  `EASYPAISA_PASSWORD` and `EASYPAISA_ACCOUNT_NUMBER` are configured, the server
  ignores the redirect's claim and asks the inquiry API for the real status. Without
  them, `EASYPAISA_TRUST_REDIRECT=true` accepts the redirect and records
  `gatewayVerified: false`; with `false` a SUCCESS claim stays `PENDING`.

The callback URLs are built from `PUBLIC_BASE_URL`:

```text
${PUBLIC_BASE_URL}/api/payments/jazzcash/return
${PUBLIC_BASE_URL}/api/payments/easypaisa/return?tx=…
${PUBLIC_BASE_URL}/api/payments/easypaisa/callback?tx=…
```

`JAZZCASH_RETURN_URL` and `EASYPAISA_RETURN_URL` can override the first URL when a
merchant portal requires an exact registered value.

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

The live gateway path uses none of these controls. The outcome comes from the
provider, and a `PENDING` transaction is finished by the gateway callback (signature
verified for JazzCash, inquiry-verified for Easypaisa when configured).

### The live hosted-checkout flow

```text
POST /api/payments/create
   │  server: validate order → calculate amount → save PENDING transaction
   ▼
{ redirect: { url, method, fields } }   ← signed by the server
   │  browser: auto-submit the form
   ▼
JazzCash / Easypaisa hosted page        ← customer pays here
   │  redirect back
   ▼
/api/payments/<gateway>/return           ← verify, match, check amount
   │
   ▼
303 → /payment/result/:id               ← frontend reads the stored record
```

* The transaction keeps `paymentInProgress: true` on the order while the customer
  is at the gateway, so a second attempt cannot start a parallel payment.
* `gatewayTxnRef` is the reference PayLab sent to the provider and is the key the
  callback is matched against.
* A callback for a transaction that is already final is ignored (idempotent).
* A callback with a different amount is rejected and the transaction stays pending.
* Provider failures while *starting* a payment mark the transaction `FAILED` and
  release the order, so the customer can try again.

> **Abandoned checkouts:** if the customer closes the gateway page, the transaction
> stays `PENDING` and the order stays claimed. There is no expiry/reconciliation job
> yet; use the inquiry calls or clear the pending record manually in development.

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
| 16 | Live mode starts with missing credentials and refuses that gateway with `GATEWAY_NOT_CONFIGURED` |
| 17 | The server never trusts an amount sent by the browser |
| 18 | The health endpoint never leaks the connection string |
| 19 | JazzCash signature round trip and tamper rejection |
| 20 | Easypaisa `merchantHashedReq` is deterministic and validates the key length |
| 21 | Full live flow: signed create request → signed callback → `SUCCESS` |
| 22 | A forged JazzCash callback is rejected and the transaction stays `PENDING` |
| 23 | Full Easypaisa live flow (trusted unsigned redirect, `gatewayVerified: false`) |
| 24 | An unsigned Easypaisa success stays `PENDING` unless `EASYPAISA_TRUST_REDIRECT` is enabled |

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

## 11. Live gateway integration

Both live adapters implement **hosted checkout**: the server signs a request, the
customer pays on the provider's page, and the server verifies the callback. All
credentials are read from `server/.env`; none are stored in MongoDB or returned to
the browser (except JazzCash's protocol-mandated `pp_Password` form field, explained
below).

### JazzCash

| Item | Value |
| --- | --- |
| Sandbox host | `https://sandbox.jazzcash.com.pk` |
| Production host | `https://payments.jazzcash.com.pk` |
| Checkout path | `/CustomerPortal/transactionmanagement/merchantform/` |
| Inquiry path | `/ApplicationAPI/API/PaymentInquiry/Inquire` |

**Request** — the adapter builds the standard `pp_*` fields, including:

* `pp_TxnRefNo` — PayLab's `gatewayTxnRef`, at most 20 letters/digits;
* `pp_Amount` — **paisa**, not rupees (PKR 4,650 → `465000`);
* `pp_TxnDateTime` / `pp_TxnExpiryDateTime` — Pakistan time, `yyyyMMddHHmmss`;
* `pp_BillReference` — a letters/digits version of the order number;
* `pp_ReturnURL` — `PUBLIC_BASE_URL` + `/api/payments/jazzcash/return`;
* `ppmpf_1` / `ppmpf_2` — the PayLab transaction reference and order number;
* `pp_SecureHash` — the signature.

**Signature**

```text
1. take every field whose name starts with "pp" (pp_* and ppmpf_*)
2. drop pp_SecureHash and every empty value
3. sort the field names
4. put the integrity salt first and join all values with "&"
5. HMAC-SHA256 with the salt as key (ISO-8859-1), upper-case hex
```

The constant-time comparison lives in `verifySecureHash()`. The return callback and
the optional IPN use the same check. Response code `000` = success, `124` / `157` =
pending, anything else = failed; the amount must also match the stored amount.

**Required environment**

```env
JAZZCASH_ENVIRONMENT=sandbox
JAZZCASH_MERCHANT_ID=...
JAZZCASH_PASSWORD=...
JAZZCASH_INTEGRITY_SALT=...
```

> JazzCash's hosted form includes `pp_Password`; that field is part of the protocol
> and is posted by the browser to JazzCash. **The integrity salt — the value that
> actually signs the request — never leaves the server.**

### Easypaisa

| Item | Value |
| --- | --- |
| Sandbox host | `https://easypaystg.easypaisa.com.pk` |
| Production host | `https://easypay.easypaisa.com.pk` |
| Checkout path | `/easypay/Index.jsf` |
| Confirmation path | `/easypay/Confirm.jsf` |
| Inquiry path | `/easypay-service/rest/v4/inquire-transaction` |

**Flow**

```text
POST /easypay/Index.jsf
  → redirect to our /return with ?auth_token=…&tx=…
  → server renders a self-submitting form to /easypay/Confirm.jsf
  → Easypaisa redirects to /callback with status, desc, orderRefNumber
```

**Request fields** — `storeId`, `amount` (decimal, e.g. `4650.0`), `postBackURL`,
`orderRefNum`, `expiryDate` (`yyyyMMdd HHmmss`), `autoRedirect`, optional
`paymentMethod`, `emailAddr`, `mobileNum`, and `merchantHashedReq`.

**Hash**

```text
amount=…&autoRedirect=…&emailAddr=…&expiryDate=…&mobileNum=…
&orderRefNum=…&paymentMethod=…&postBackURL=…&storeId=…
```

Empty optional fields are omitted. The string is encrypted with **AES/ECB/PKCS#5**
using the portal hash key (16, 24 or 32 characters) and base64-encoded.

**Required environment**

```env
EASYPAISA_ENVIRONMENT=sandbox
EASYPAISA_STORE_ID=...
EASYPAISA_HASH_KEY=...          # exactly 16, 24 or 32 characters
```

**Verification and trust**

```env
# Preferred: verify every result with the inquiry API
EASYPAISA_USERNAME=...
EASYPAISA_PASSWORD=...
EASYPAISA_ACCOUNT_NUMBER=...

# Fallback: accept the unsigned redirect when no inquiry credentials exist
EASYPAISA_TRUST_REDIRECT=true
```

Easypaisa's final redirect is **not signed**. With the inquiry credentials the
adapter calls the inquiry API and trusts its answer instead of the redirect
parameters. Without them there are two options:

* `EASYPAISA_TRUST_REDIRECT=true` — accept the redirect. The record is stored
  with `gatewayVerified: false`, and the result page shows an explicit unverified
  warning.
* `EASYPAISA_TRUST_REDIRECT=false` (the code default) — a SUCCESS claim stays
  `PENDING` until a server-side verification is available.

A production deployment should configure the inquiry credentials.

---

## 12. Going live — checklist

1. **Get the credentials** from the JazzCash and Easypaisa merchant portals.
2. **Fill `server/.env`** (not the root `.env`) and keep `*_ENVIRONMENT=sandbox`
   for the first run.
3. **Set `PUBLIC_BASE_URL`** to the origin the gateway can reach. Localhost works
   for a browser redirect; use an HTTPS tunnel for a public/IPN URL.
4. **Register or confirm the return URLs** in each merchant portal if it requires
   an exact match:
   * `…/api/payments/jazzcash/return`
   * `…/api/payments/easypaisa/return`
   * `…/api/payments/easypaisa/callback`
5. **Set `PAYMENT_MODE=live`** and restart. Check `GET /api/health`: each gateway
   should report `configured: true` and `environment: "sandbox"`.
6. **Pay a small sandbox amount** end to end. Check the MongoDB transaction:
   `mode: "LIVE"`, `simulated: false`, `gatewayTxnRef` set, and
   `gatewayVerified: true` (for JazzCash, or for Easypaisa when inquiry is
   configured).
7. **Only then switch to production** (`*_ENVIRONMENT=production`), use HTTPS, and
   watch the first real transactions.
8. **Never commit `server/.env`.** It is git-ignored; rotate any key that leaks.

---

## 13. Known limitations of the live adapters

* **No refunds or voids.** Only the sale/hosted-checkout direction is implemented.
* **No reconciliation or expiry job.** A customer who abandons the gateway page
  leaves the transaction `PENDING` and the order claimed. Production needs a
  scheduled inquiry plus an expiry policy.
* **No webhook retry queue.** Callbacks are processed inline; a failed delivery is
  only recovered by a later inquiry or manual reconciliation.
* **Easypaisa redirect is unsigned.** Configure the inquiry credentials for a
  cryptographically verified result, set `EASYPAISA_TRUST_REDIRECT=true` to accept
  `gatewayVerified: false`, or leave it false and keep SUCCESS pending.
* **Status-code mapping** follows the published JazzCash/Easypaisa sandbox
  behaviour. Re-check the final code tables in the merchant documentation before
  production.
* **PKR only**, one payment per order, no partial payments.
* **JazzCash `pp_Password` is visible in the form**, because the hosted-checkout
  protocol requires the browser to post it. The signing salt remains server-side.

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
| **The mock controls exist** | They are forced off whenever `NODE_ENV=production` or `PAYMENT_MODE=live`, but they must stay off |
| **No reconciliation or expiry job** | A `PENDING` live transaction has no timeout. Add a scheduled inquiry and an expiry policy so abandoned checkouts release the order |
| **Easypaisa's redirect is unsigned** | Configure the inquiry credentials. Without them, `EASYPAISA_TRUST_REDIRECT=true` accepts the redirect (`gatewayVerified: false`) or `false` keeps SUCCESS pending |
| **JazzCash's form contains `pp_Password`** | Required by JazzCash's hosted-checkout protocol; the signing salt stays server-side. Treat the merchant password as a sensitive value |
| **No idempotency keys** | Add an `Idempotency-Key` header so a retried request cannot create a second transaction |

### What this API deliberately does **not** collect

No customer password, PIN, OTP, CVV, card number or banking credential is ever
requested, stored or logged by PayLab. They are entered inside the gateway's own
hosted page. (The JazzCash form does carry the merchant's `pp_Password` because the
provider's protocol requires it; PayLab does not store or log it.)

Customer names, email addresses and mobile numbers are stored because the demo
needs them, and the structured logger redacts them so they do not end up in
the log files.
