# Repository / Folder Structure

Monorepo via pnpm workspaces + Turborepo (build/task orchestration & caching across apps/libs — picked over Nx for lower ceremony; either is defensible, Turborepo's simplicity wins for a team that isn't already invested in Nx generators).

```
pos_exe/
├── apps/
│   ├── desktop/                      -- Electron shell (main + preload), packages branch-api + embedded pg
│   │   ├── main/
│   │   │   ├── index.ts
│   │   │   ├── postgres-lifecycle.ts
│   │   │   ├── sync-worker.ts
│   │   │   ├── native/               -- barcode listener, printer bridge, drawer kick, keytar wrapper
│   │   │   └── auto-updater.ts
│   │   ├── preload/
│   │   │   └── index.ts              -- contextBridge exposed API
│   │   └── electron-builder.yml
│   ├── renderer/                     -- React + TS + MUI + Tailwind SPA
│   │   ├── src/
│   │   │   ├── pages/                -- POS, Invoices, Products, Inventory, Purchasing, Customers,
│   │   │   │                            Suppliers, Reports, Accounting, Settings, Dashboard
│   │   │   ├── features/             -- feature-sliced modules (cart, payment, discount, scanner)
│   │   │   ├── components/           -- shared MUI-based components
│   │   │   ├── api/                  -- generated client from OpenAPI spec (see tooling/)
│   │   │   ├── plugin-host/          -- Module Federation host setup, extension-point registries
│   │   │   ├── theme/                -- design tokens, light/dark
│   │   │   └── shortcuts/            -- global shortcut map (mirrors 07-ui-wireframes.md §7)
│   │   └── vite.config.ts            -- Vite + Module Federation plugin
│   ├── branch-api/                   -- NestJS app, runs embedded inside apps/desktop/main at runtime
│   │   └── src/ (see libs/ layering below; this app is mostly composition root + module wiring)
│   ├── cloud-api/                    -- NestJS app: licensing, plugin marketplace, admin portal backend
│   │   └── src/
│   └── admin-portal/                 -- separate React app for platform-operator staff
│       └── src/
├── libs/
│   ├── domain/
│   │   ├── sales/  inventory/  catalog/  purchasing/  customers/  suppliers/
│   │   ├── accounting/  identity/  licensing/  plugins/  sync/
│   ├── application/<same context folders as domain>/
│   ├── infrastructure/<same context folders as domain>/
│   ├── interface/<same context folders as domain>/
│   ├── shared-kernel/                -- Money, TenantId, DomainEvent, AuditMetadata
│   └── ui-kit/                       -- cross-app MUI/Tailwind component library (shared by renderer + admin-portal)
├── plugins/                          -- first-party reference plugins, each independently buildable/publishable
│   ├── whatsapp-integration/
│   ├── sms-integration/
│   ├── accounting-full/
│   ├── kitchen-display/
│   └── qr-ordering/
├── prisma/
│   ├── branch/schema.prisma          -- branch-local schema (01-database-design.md §2-§13 minus cloud-owned tables)
│   └── cloud/schema.prisma           -- cloud control-plane schema
├── tooling/
│   ├── eslint-config/
│   ├── tsconfig-base/
│   └── openapi/                      -- OpenAPI spec (source of truth, see 02-api-design.md) + client codegen
├── e2e/                               -- Playwright (renderer) + supertest (API) end-to-end suites
├── docs/                             -- this set of documents
├── .github/workflows/                -- CI pipelines (see 09-deployment-plan.md, 12-testing-strategy.md)
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Conventions

- Every `libs/<layer>/<context>` package has its own `package.json` and is referenced via workspace protocol (`workspace:*`) — this is what makes the "module never imports another context's domain/infrastructure" rule in [03-backend-architecture.md](03-backend-architecture.md) §1 mechanically enforceable: cross-context imports that bypass the allowed ports simply don't resolve, caught at build time, not just by code review.
- `apps/branch-api` and `apps/cloud-api` are thin composition roots: they import the `interface` layer packages for the contexts they host and wire up the Nest `AppModule` — no business logic lives directly in `apps/`.
- Plugins live outside `libs/` deliberately, even first-party ones, to keep them buildable/publishable independently through the exact same pipeline a future third-party plugin developer would use (per [06-plugin-architecture.md](06-plugin-architecture.md) §9).
