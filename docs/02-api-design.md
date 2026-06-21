# API Design

Two distinct API surfaces exist — keep them architecturally separate even though both are NestJS:

1. **Branch API** — runs locally on each device (NestJS embedded in the Electron main process or as a sidecar process), serves the local renderer UI and is the target of the Offline Sync Engine. This is the "real" POS API and is what §2 onward documents in detail.
2. **Cloud Control-Plane API** — runs on independent cloud infra, serves the Admin Portal and the License/Plugin marketplace, documented in [05-license-server-architecture.md](05-license-server-architecture.md).

Both expose REST + JSON, versioned via URL prefix (`/api/v1/...`), authenticated with JWT bearer tokens, and follow the same conventions below.

## 1. Conventions

- **Pagination**: cursor-based (`?cursor=<opaque>&limit=50`), response includes `next_cursor`. Offset pagination is *not* used for invoice/ledger lists — these grow unbounded and offset pagination degrades badly.
- **Filtering**: `?filter[field]=value`, range filters `?filter[created_at][gte]=...`.
- **Errors**: RFC 7807 Problem Details — `{ type, title, status, detail, instance, errors?: [{field, code, message}] }`.
- **Idempotency**: all POST endpoints that create financial records (invoices, payments, stock adjustments) require an `Idempotency-Key` header; server deduplicates on `(tenant_id, idempotency_key)` for 24h. This is what makes safe client-side retry possible on a flaky/offline connection.
- **Money**: always transmitted as strings (`"1234.5000"`), never floats, to avoid precision loss.
- **Optimistic concurrency**: mutating endpoints accept `If-Match: <version>`; mismatch → `409 Conflict` with current server state, consumed by the Sync Engine's conflict resolution.

## 2. Auth

```
POST   /api/v1/auth/login                 { username|email, password|pin, device_fingerprint } -> { access_token, refresh_token, user, permissions }
POST   /api/v1/auth/refresh                { refresh_token } -> { access_token, refresh_token }
POST   /api/v1/auth/logout
POST   /api/v1/auth/totp/verify
GET    /api/v1/auth/me
```

## 3. Products & Catalog

```
GET    /api/v1/products?filter[barcode]=...           -- single fastest-path lookup, indexed
GET    /api/v1/products?filter[category_id]=...&cursor=...
POST   /api/v1/products
PATCH  /api/v1/products/:id
DELETE /api/v1/products/:id                            -- soft delete
POST   /api/v1/products/:id/variants                   -- generate variant matrix from attribute set
GET    /api/v1/categories
POST   /api/v1/categories
GET    /api/v1/price-lists/:id/items
```

## 4. POS / Invoices

```
POST   /api/v1/invoices                                -- create+complete in one call (typical POS flow), idempotent
POST   /api/v1/invoices/hold                           -- park a cart
POST   /api/v1/invoices/:id/resume
POST   /api/v1/invoices/:id/void                       { reason }    -- may return 202 + pending_approval if over threshold
POST   /api/v1/invoices/:id/returns                    { lines: [{invoice_line_id, quantity}] }   -- partial or full
GET    /api/v1/invoices?filter[status]=completed&filter[created_at][gte]=...
GET    /api/v1/invoices/:id
POST   /api/v1/invoices/:id/payments                   -- add a payment (supports mixed payment via repeated calls within one client transaction)
GET    /api/v1/invoices/:id/receipt.pdf
```

`POST /api/v1/invoices` request shape (representative):

```json
{
  "customer_id": "uuid|null",
  "lines": [
    { "product_id": "uuid", "quantity": "2.0000", "unit_price": "499.0000", "discount": { "type": "percent", "value": "10" } }
  ],
  "invoice_discount": { "type": "fixed", "value": "50.0000" },
  "payments": [
    { "method": "cash", "amount": "900.0000", "received_amount": "1000.0000" }
  ]
}
```

## 5. Inventory & Purchasing

```
GET    /api/v1/stock-levels?filter[warehouse_id]=...&filter[product_id]=...
POST   /api/v1/stock-adjustments
POST   /api/v1/stock-adjustments/:id/post
POST   /api/v1/stock-transfers
POST   /api/v1/stock-transfers/:id/dispatch
POST   /api/v1/stock-transfers/:id/receive
POST   /api/v1/purchase-orders
POST   /api/v1/purchase-orders/:id/send
POST   /api/v1/goods-receipts
POST   /api/v1/goods-receipts/:id/post
POST   /api/v1/supplier-invoices
POST   /api/v1/supplier-payments
```

## 6. Customers / Suppliers / Credit

```
GET    /api/v1/customers?filter[search]=...
GET    /api/v1/customers/:id/ledger
GET    /api/v1/customers/:id/statement.pdf
POST   /api/v1/coupons/validate                        { code, invoice_subtotal } -> { valid, discount }
GET    /api/v1/suppliers/:id/ledger
```

## 7. Reports

```
GET    /api/v1/reports/sales?from=...&to=...&branch_id=...&format=json|pdf|csv|xlsx
GET    /api/v1/reports/inventory-valuation
GET    /api/v1/reports/profit
GET    /api/v1/reports/tax
GET    /api/v1/dashboard/summary                        -- today's sales/profit, low stock count, receivables/payables totals
```

## 8. Settings / Admin (branch-local administration, distinct from cloud Admin Portal)

```
GET/PATCH /api/v1/settings/company
GET/PATCH /api/v1/settings/tax-templates
GET/PATCH /api/v1/settings/printers
GET/POST  /api/v1/users
GET/POST  /api/v1/roles
PATCH     /api/v1/roles/:id/permissions
```

## 9. Sync Engine Endpoints (device ↔ cloud)

```
POST   /api/v1/sync/push       { changes: [{ table, op, row, version, client_timestamp }] } -> { accepted, conflicts: [...] }
POST   /api/v1/sync/pull       { since_cursor } -> { changes: [...], next_cursor }
GET    /api/v1/sync/status
```
Full protocol in [04-electron-architecture.md](04-electron-architecture.md) §Sync Engine.

## 10. Webhooks (outbound, tenant-configured endpoints)

Events: `invoice.created`, `invoice.voided`, `payment.received`, `stock.low`, `customer.credit_limit_exceeded`, `license.expiring`. Delivery: signed payload (`X-Vantage-Signature: sha256=...` over raw body + shared secret), retried with exponential backoff up to 24h, dead-lettered with a re-deliver action in Admin Portal.

## 11. Rate Limiting & Quotas

Branch API: generous limits (it's mostly single-tenant local traffic) but still rate-limited per-device to absorb a runaway plugin or integration (`120 req/min` default, configurable). Cloud Control-Plane API: per-tenant quotas tied to plan tier, documented per-endpoint in the Admin Portal's API settings screen.

## 12. API Platform for 3rd Parties

A reduced, more stable subset of the Branch API (Products read, Invoices create/read, Customers CRUD, Stock read) is exposed as the public "Integration API," versioned independently and with its own API-key auth (separate from the internal JWT scheme) so internal refactors don't break external e-commerce/mobile integrations. Internal endpoints are not guaranteed-stable; Integration API endpoints carry a deprecation policy (minimum 6 months notice).
