# Vantage POS

Enterprise POS & inventory management platform — Electron desktop app + NestJS branch API + Postgres, offline-first, multi-tenant licensing-ready. See [docs/README.md](docs/README.md) for the full architecture set; see [docs/13-development-roadmap.md](docs/13-development-roadmap.md) for what's built vs. planned.

**Current state: Phase 0 / early Phase 1** — single-store POS vertical slice (login, product catalog, barcode-ready product grid, cart, cash sale with stock decrement) is real and working end to end against a real Postgres database. Most of the 27 modules in the functional spec are not yet built — see the roadmap for sequencing.

## Prerequisites

- Node.js 20+
- pnpm (via `corepack use pnpm@latest`, or `npx pnpm`)

## First-time setup

```sh
pnpm install

# Start a local embedded Postgres for development (keeps running across sessions)
pnpm --filter @vantage/branch-api db:dev:start

# Point branch-api at it (copy the example env once)
cp apps/branch-api/.env.example apps/branch-api/.env

# Create the schema and seed demo data (tenant, branch, warehouse, admin user, 3 products)
pnpm --filter @vantage/branch-api prisma:migrate
pnpm --filter @vantage/branch-api seed
```

Seeded login: username `admin`, password `Admin123!`.

## Running in development

Three pieces run independently in dev (see [docs/04-electron-architecture.md](docs/04-electron-architecture.md) §1 for why dev and packaged builds differ here):

```sh
# Terminal 1 — Branch API (NestJS), http://127.0.0.1:4000
pnpm --filter @vantage/branch-api dev

# Terminal 2 — Renderer (Vite dev server), http://localhost:5173
pnpm --filter @vantage/renderer dev

# Terminal 3 — Electron shell (loads the renderer dev server)
pnpm --filter @vantage/desktop dev
```

## Building

```sh
pnpm build   # turbo runs build across all apps
```

Each app also has its own `build`: `nest build` (branch-api), `tsc && vite build` (renderer), `tsc` (desktop main/preload). Packaging the Windows installer (`electron-builder`) is documented in [docs/14-windows-exe-build-strategy.md](docs/14-windows-exe-build-strategy.md) and not yet wired into CI.

## What's been verified

- `branch-api` boots, connects to Postgres, and serves all registered routes.
- Login issues a real JWT carrying a permission set computed from seeded roles.
- POS product grid returns live stock levels joined from `stock_levels`.
- Creating an invoice: validates stock, computes subtotal/discount/tax/grand total with `Prisma.Decimal`, writes the invoice + lines + payments + an append-only `stock_ledger` row in one transaction, and decrements `stock_levels` — confirmed by direct DB inspection after a real sale.
- Guard rails: insufficient-stock and invalid-credentials return RFC 7807 problem details; missing/invalid bearer tokens return 401.
- `renderer` and `desktop` both typecheck and build their production bundles.

## Known gaps (not yet done)

- No ESLint config wired up yet (`lint` scripts exist but there's no shared config) — the tenant-scoping/no-raw-query lint rule described in [docs/03-backend-architecture.md](docs/03-backend-architecture.md) §4 doesn't exist yet, that invariant is only enforced by code review right now.
- No automated tests yet (unit/integration/E2E per [docs/12-testing-strategy.md](docs/12-testing-strategy.md) is all still to be written).
- Electron app has not been visually verified in a GUI (this environment is headless); the API/DB layers were verified directly via HTTP and SQL.
- Embedded Postgres lifecycle code in `apps/desktop/main/postgres-lifecycle.ts` is written but only exercised via the standalone dev script, not through a packaged Electron build yet.
- No CI pipeline, no code signing, no auto-updater wiring yet.
