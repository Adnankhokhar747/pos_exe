# Backend Architecture

NestJS, TypeScript, modular monolith with clean/hexagonal boundaries and DDD-flavored module structure — built so individual bounded contexts can be extracted to standalone services later without a rewrite.

## 1. High-Level Shape

```
apps/
  branch-api/         -- runs on-device, embedded in Electron's main process via a child process or in-process Nest app
  cloud-api/           -- control plane: licensing, plugin marketplace, admin portal backend
libs/
  domain/<context>/    -- pure domain layer per bounded context (entities, value objects, domain events, no framework deps)
  application/<context>/ -- use cases / command & query handlers, ports (interfaces) for persistence & external services
  infrastructure/<context>/ -- Postgres repositories (TypeORM or Prisma — see §6), adapters for printers, payment refs, etc.
  interface/<context>/  -- NestJS controllers, DTOs, validation, mapping to/from application layer
  shared-kernel/        -- cross-context primitives: Money, TenantId, AuditMetadata, DomainEvent base class
```

Each bounded context (Catalog, Inventory, Sales/POS, Purchasing, Customers, Suppliers, Accounting Lite, Identity/Access, Licensing-cache, Plugins, Sync, Notifications, Reporting) is a **NestJS module** assembled from its own `domain/application/infrastructure/interface` slices. A context never imports another context's domain or infrastructure layer directly — cross-context communication happens through:
- **Domain events** (in-process event bus for the modular monolith; same contract becomes a message-queue event if a context is later split out), e.g. `InvoiceCompletedEvent` → Inventory context decrements stock, Loyalty context accrues points, Notifications context checks low-stock thresholds.
- **Application-layer ports** for synchronous needs (e.g. Sales needs "current stock for product X" — exposed as a read port `InventoryReadPort`, implemented by the Inventory context, injected via DI token, not a direct repository import).

This is what "microservice ready" means in practice: the seam is the bounded-context boundary, drawn from day one, even while everything deploys as one process.

## 2. Request Flow (Clean Architecture layering)

```
HTTP Request
  -> Controller (interface layer): validates DTO, maps to a Command/Query
  -> CommandHandler/QueryHandler (application layer): orchestrates domain objects + ports, raises domain events
  -> Domain entities/aggregates (domain layer): invariants enforced here, e.g. Invoice.addLine() rejects negative qty
  -> Repository port implementation (infrastructure layer): persists via TypeORM/Prisma
  <- Result mapped back to a Response DTO
```

CQRS is used *structurally* (separate Command/Query handlers via `@nestjs/cqrs`) but not as full event-sourcing — state is stored as current rows + the append-only `stock_ledger`/`audit_log_entries` tables for the few aggregates that need a true event history (see [01-database-design.md](01-database-design.md)).

## 3. Example: Sales Context Internals

```
domain/sales/
  invoice.aggregate.ts         -- Invoice, InvoiceLine entities; enforces "can't add line to completed invoice", discount ceilings, etc.
  invoice-totals.value-object.ts
  events/invoice-completed.event.ts
application/sales/
  commands/create-invoice.handler.ts
  commands/void-invoice.handler.ts
  queries/get-invoice.handler.ts
  ports/inventory-read.port.ts          -- interface only
infrastructure/sales/
  invoice.repository.ts                  -- TypeORM repository implementing domain repository interface
  inventory-read.adapter.ts              -- implements ports/inventory-read.port.ts by calling Inventory context's exposed query
interface/sales/
  invoices.controller.ts
  dto/create-invoice.dto.ts              -- class-validator decorated
```

## 4. Multi-Tenancy Enforcement

Every request carries a tenant context (resolved from JWT claims) injected via a `TenancyMiddleware` into a request-scoped `TenantContext` provider. All TypeORM/Prisma queries go through a base repository that automatically applies `WHERE tenant_id = :tenantId` — there is no code path that queries without this filter, enforced by an ESLint rule banning direct `dataSource.query`/raw repository access outside the base repository class, and verified by an integration test that asserts cross-tenant queries return empty (see [12-testing-strategy.md](12-testing-strategy.md)).

## 5. Authorization

A `PermissionsGuard` (NestJS guard) checks the JWT's cached permission set against a `@RequirePermission('module.action')` decorator on each controller method. Branch-scoped permissions additionally compare the target resource's `branch_id` against the user's granted branch scope. Permission changes made centrally (cloud) are pushed down via the Sync Engine and take effect on next token refresh (max staleness = access-token TTL, 15 min).

## 6. Persistence Choice

**Prisma** for the Branch API (simpler migration story for an embedded, auto-updating, per-device Postgres; generated client gives strong typing without the ceremony of TypeORM entities, and Prisma Migrate's declarative schema is easier to version alongside the Electron auto-updater than TypeORM's migration classes). **TypeORM is acceptable as an alternative** if the team has deeper TypeORM experience — the decision isn't religious, but pick one per app and don't mix within `branch-api`. Cloud API can use either independently since it's a separate deployable.

## 7. Background Work

`@nestjs/schedule` for in-process cron (materialized view refreshes, license re-validation ping, low-stock scan). For the Sync Engine's push/pull, a dedicated long-running worker (not request-driven) using a local job queue table (`sync_jobs`) rather than Redis/BullMQ — a device shouldn't need a Redis instance just to sync; the queue table is polled by an in-process interval with backoff. Cloud API, which *does* have infra to run Redis, uses BullMQ for webhook delivery retries and report-export generation.

## 8. Validation & Error Handling

`class-validator` DTOs at the interface boundary; domain invariants throw typed domain exceptions (`InsufficientStockError`, `InvoiceAlreadyVoidedError`) caught by a global `NestJS ExceptionFilter` that maps them to RFC 7807 responses (§ see [02-api-design.md](02-api-design.md) §1). Domain exceptions are never raw strings — always a typed class so the filter mapping is exhaustive and testable.

## 9. Logging & Observability

Structured JSON logs (pino) with `tenant_id`/`branch_id`/`request_id` on every line. Branch API ships logs to local rotating files (for support diagnostics, exportable from Settings) and batches a redacted subset to the cloud's observability sink when online. Cloud API integrates with standard APM (OpenTelemetry traces) — vendor left open (Grafana stack or a hosted APM, decided at deployment time, not an architectural constraint).

## 10. Why Modular Monolith, Not Microservices, for v1

The Branch API runs on a single Windows desktop machine with no orchestrator — microservices there would mean running N processes against one SQLite-sized workload for no benefit, only overhead and failure modes (inter-process network calls on a cashier's PC). The Cloud API's load (license validation pings, plugin catalog, admin portal) is comparatively low-volume and benefits far more from simple deployment than from independent scaling at this stage. The bounded-context module boundaries (§1) are what preserve the *option* to extract a high-load context (e.g., Reporting, if a future analytics workload demands it) into its own service later, without that extraction requiring a rewrite — only a move of the `infrastructure` and `interface` layers behind a network boundary while `domain`/`application` stay intact.
