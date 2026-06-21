# Development Roadmap

Phased to ship a genuinely usable, non-placeholder product as early as possible (single-store cash-and-carry retail) and layer enterprise/franchise/plugin capability on top — rather than building all 27 modules in parallel to 20% completeness each. Phase boundaries below are scope gates, not fixed calendar dates — treat them as "what must be true before the next phase starts," and size the calendar against actual team capacity.

## Phase 0 — Foundations
- Monorepo scaffold ([08-folder-structure.md](08-folder-structure.md)), CI pipeline skeleton, lint/typecheck gates.
- Branch-local Prisma schema for Identity, Catalog, Inventory, Sales contexts ([01-database-design.md](01-database-design.md) §2, §5–§7).
- Electron shell with embedded Postgres lifecycle + embedded Branch API boot ([04-electron-architecture.md](04-electron-architecture.md) §1–§2).
- Auth (login, JWT/refresh, device fingerprint capture — cloud license validation can be stubbed initially) and the `PermissionsGuard` skeleton.
- **Exit criterion**: an empty app boots, a user logs in, the embedded DB initializes and migrates cleanly on a clean Windows VM.

## Phase 1 — Single-Store POS MVP
- Product CRUD (no variants/bundles/kits yet — flat products only), categories, barcode lookup.
- POS Terminal screen ([07-ui-wireframes.md](07-ui-wireframes.md) §1): cart, line discounts, invoice discount, cash + card (reference-capture) payment, receipt printing (80mm thermal).
- Stock ledger + stock levels for a single default warehouse per branch; stock decrements on sale.
- Hold/Resume invoice, basic Return (full return only).
- Daily closing / cash drawer session tracking (Accounting Lite minimal slice).
- Single hardcoded "Starter" license, no expiry enforcement yet (cloud license server not required to ship this phase to an internal pilot store).
- **Exit criterion**: a real pilot store can run a full day of sales on this build with no manual DB intervention.

## Phase 2 — Inventory & Purchasing Depth
- Multi-warehouse, stock transfer, stock adjustment/reconciliation.
- Batch & expiry tracking, reorder levels, low stock alerts (Notification Center MVP: in-app only, no email/SMS yet).
- Full Purchase flow: PO → Goods Receipt → Supplier Invoice → Supplier Payment, supplier ledger.
- Partial returns (sales + purchase side), void/cancellation approval workflow.
- FIFO valuation (Weighted Average deferred to Phase 3 — ship one correct method before adding a second, since both must agree with the stock ledger replay invariant from [12-testing-strategy.md](12-testing-strategy.md) §3).
- **Exit criterion**: inventory valuation report reconciles exactly against the stock ledger replay for a multi-week pilot dataset.

## Phase 3 — Multi-Branch, Customers, Credit, Reporting
- Branch management, inter-branch transfers, branch-scoped permissions.
- Customer profiles, ledger, credit sales + receivables aging.
- Supplier payables aging.
- Core Reporting module (Sales/Product/Inventory/Profit/Tax/Branch/Cashier reports, PDF/Excel/CSV export).
- Weighted Average valuation option added alongside FIFO.
- Multi-currency (transaction-level; base-currency rollup).
- **Exit criterion**: a 3-branch pilot tenant runs real operations and a Branch Admin can answer "what's my P&L this month" entirely from in-app reports.

## Phase 4 — Cloud Control Plane: Licensing & Subscriptions
- License Server ([05-license-server-architecture.md](05-license-server-architecture.md)) live: plan CRUD, license issuance, validation flow, device registration/quota, grace period/lockout state machine.
- Admin Portal v1: license lifecycle actions (create/suspend/extend/upgrade/downgrade/revoke), device approval queue.
- Desktop app wired to real validation (replacing the Phase 1 stub), renewal reminders.
- Offline Sync Engine v1 ([04-electron-architecture.md](04-electron-architecture.md) §4): push/pull for master data + financial append-only sync — this is also where multi-branch's "cloud holds tenant master data" promise from the functional spec actually gets implemented, not just designed.
- **Exit criterion**: a tenant's license can be fully managed end-to-end from the Admin Portal, and a branch can go offline for a business day and resync cleanly.

## Phase 5 — Loyalty, Advanced Product, Accounting Lite Completion
- Loyalty (points, membership levels, coupons, gift cards, cashback).
- Product variants, bundles, kits, serial number tracking.
- Accounting Lite completion: expense/income categorization, full P&L summary, cash reconciliation reporting.
- 2FA, audit log UI, login history UI (security features that were backend-only since Phase 0 now get front-end surfaces).
- **Exit criterion**: feature parity with the full [00-functional-specification.md](00-functional-specification.md) modules list except Plugin Marketplace and API Platform.

## Phase 6 — Plugin Marketplace & API Platform
- Plugin architecture runtime ([06-plugin-architecture.md](06-plugin-architecture.md)): Module Federation host, dynamic NestJS module loading, schema isolation, signature verification.
- Admin Portal plugin management (upload/publish/grant-to-plan).
- First reference plugins built end-to-end: WhatsApp Integration, Kitchen Display (chosen as the two most architecturally distinct — async external-API integration vs. real-time in-house UI extension — to stress-test the plugin contract from both angles).
- Public Integration API ([02-api-design.md](02-api-design.md) §12) with API-key auth, initial 3rd-party-facing docs.
- **Exit criterion**: a plugin can be installed/activated on a live tenant device without an app rebuild, end to end, by someone who didn't write the plugin architecture.

## Phase 7 — Hardening, Scale, Remaining Reference Plugins
- Remaining reference plugins (SMS, full Accounting/GL, E-Invoicing, Delivery Tracking, QR Ordering, AI Analytics interfaces).
- Performance hardening against the load-test targets in [12-testing-strategy.md](12-testing-strategy.md) §6 at realistic multi-year data volumes.
- Penetration test remediation pass.
- Franchise-specific reporting/rollup refinements based on real franchise pilot feedback.
- **Exit criterion**: platform is sellable across all target verticals in [00-functional-specification.md](00-functional-specification.md) §2 without "coming soon" placeholders in any core module.

## Explicitly Post-v1 (tracked, not scheduled)
- Native mobile companion app.
- Trained AI forecasting models (interfaces reserved in Phase 7, models trained once there's enough real tenant data to train on responsibly).
- Public third-party plugin developer program (SDK hardening, marketplace review process, revenue share tooling).
- Additional regional e-invoicing/tax-authority integrations beyond the first launch markets.
