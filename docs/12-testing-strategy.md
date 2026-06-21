# Testing Strategy

## 1. Pyramid Shape

Weighted toward unit + integration over E2E, since the domain logic (discount engine, tax calculation, inventory valuation, sync conflict resolution) carries the highest correctness risk and is cheapest to test in isolation; E2E is reserved for the handful of true golden-path journeys where wiring, not logic, is the risk.

```
        ▲  E2E (Playwright) — ~30-50 critical user journeys
       ╱ ╲
      ╱   ╲  Integration (Supertest + real Postgres via Testcontainers) — per-module API contract tests
     ╱     ╲
    ╱       ╲ Unit (Jest) — domain layer, application handlers, pure functions
   ╱─────────╲
```

## 2. Unit Tests

- **Domain layer** ([03-backend-architecture.md](03-backend-architecture.md) §1): every aggregate invariant gets a direct test with no framework/DB involved — e.g. `Invoice.addLine()` rejecting negative quantity, `Invoice.applyDiscount()` enforcing a role's discount ceiling, `StockLedger` replay producing the same `stock_levels` as the materialized projection.
- **Money/Tax/Discount math**: property-based tests (`fast-check`) for the Tax Engine and Discount Engine specifically — these are the modules where a rounding edge case (e.g. stacked tax components, percentage discount on an already-discounted line) causes real financial discrepancies, so randomized input testing catches edge cases example-based tests miss.
- Target: domain and application layers at ≥85% line coverage, enforced in CI as a floor (not a vanity ceiling — coverage on `interface`/DTO mapping code is far less valuable and not separately gated).

## 3. Integration Tests

- Every NestJS module's controllers tested against a **real ephemeral Postgres** (Testcontainers), not mocks — this is a deliberate choice given how much of this system's correctness lives in DB constraints, transactions, and the tenant-scoping filter ([03-backend-architecture.md](03-backend-architecture.md) §4); mocking the DB would test nothing about the property that actually matters.
- Explicit **cross-tenant isolation test**: seed two tenants, assert every list/get endpoint returns zero leakage across tenant boundaries — run as a generic parameterized test iterating all registered routes, not hand-written per endpoint, so a newly added endpoint is covered automatically rather than only when someone remembers to write its isolation test.
- Explicit **permission matrix test**: for every `@RequirePermission` decorated route, assert a caller without that permission gets `403` and a caller with it gets past the guard (business-logic correctness is a separate test; this one only proves the gate works).
- **Stock ledger replay invariant**: integration test that takes an arbitrary sequence of purchase/sale/adjustment/transfer operations, replays `stock_ledger` from scratch, and asserts the replayed `stock_levels` matches the live projection exactly — this is the test that keeps the "rebuildable projection" design promise in [01-database-design.md](01-database-design.md) §6 honest rather than aspirational.

## 4. Sync Engine Tests

The highest-risk subsystem gets its own dedicated test category beyond generic integration tests:
- **Conflict simulation harness**: spins up two local Postgres instances representing two devices plus a mock cloud, drives concurrent edits, and asserts the resolution policy table in [04-electron-architecture.md](04-electron-architecture.md) §4.4 holds for every data class — financial records never conflict (by construction — test asserts no conflict path is even reachable for these tables), master data resolves last-writer-wins at field granularity, stock levels are never pushed/pulled at all (only the ledger is).
- **Offline/reconnect simulation**: queue N writes while "offline" (sync worker paused), reconnect, assert all N apply in order and the outbox drains to empty with no duplicate application (idempotency key reuse tested explicitly here, not just at the API layer).
- **Partial-failure mid-batch**: kill the sync worker mid-push-batch, restart, assert no row is double-applied and no row is lost — exercises the transactional-outbox guarantee end to end.

## 5. End-to-End Tests (Playwright, against the full Electron app)

Golden-path journeys, kept few and stable since these are the slowest and most brittle layer:
1. Cash sale: search/scan product → add to cart → apply line discount → cash payment with change → receipt printed (assert print job dispatched, not actual paper).
2. Mixed-payment sale with a registered customer accruing loyalty points.
3. Hold → resume → complete a parked invoice.
4. Full return against a prior invoice, restocking inventory, refund issued.
5. Stock receipt via Purchase Order → Goods Receipt → stock level increases → sale decrements it correctly (cross-module journey, deliberately spanning Purchasing + Inventory + POS in one test since that's the real-world flow).
6. Offline sale → reconnect → sync confirms server-side.
7. License expiry → grace period → locked screen → renewal → unlocked (run against a test license server, not production).
8. Plugin install → activate → its UI extension point renders → deactivate → UI extension point disappears cleanly.

## 6. Non-Functional Testing

- **Performance**: load test the Branch API's POS-critical endpoints (`create invoice`, `barcode lookup`, `stock level read`) against a catalog of 100k+ SKUs and an invoice history of millions of rows — the realistic ceiling for a busy multi-year store — asserting p95 latency budgets (e.g. barcode lookup < 50ms) since these are on the cashier's critical path and any regression is felt immediately at checkout.
- **Migration safety**: every schema migration runs in CI against a snapshot of a "large realistic" fixture database, not just an empty dev DB, to catch migrations that would lock or take unacceptably long on real data volumes.
- **Backup/restore drill**: automated as described in [09-deployment-plan.md](09-deployment-plan.md) §5 — not a manual checklist item.
- **Security**: dependency vulnerability scanning (`npm audit`/Snyk) gated in CI; an annual third-party penetration test once the platform has paying tenants, covering both the desktop app's local attack surface and the cloud API.

## 7. Plugin Testing Contract

Because plugins (including first-party ones) load dynamically, the platform publishes a **plugin test harness** (a lightweight host-app stub implementing the extension-point contracts from [06-plugin-architecture.md](06-plugin-architecture.md) §3) so any plugin — first- or third-party — can be tested for manifest validity, permission-declaration honesty (static analysis flags any API call a plugin makes outside its declared `requiredPermissions`), and UI extension-point rendering, without needing the full host app running.

## 8. CI Gating

Every PR: lint + typecheck + unit + integration (Testcontainers) must pass. E2E suite runs on merge to `main` and nightly (not per-PR, to keep PR feedback fast) plus mandatorily before any tagged release per the release checklist in [09-deployment-plan.md](09-deployment-plan.md) §6. No merge bypasses required-status-checks, including for hotfixes — a broken-test hotfix is a contradiction the pipeline shouldn't allow through silently.
