# Functional Specification — Enterprise POS & Inventory Management Platform

Codename: **Vantage POS** (placeholder product name — rename freely before launch)

## 1. Purpose & Scope

Vantage POS is a subscription-licensed, offline-first, plugin-extensible Point of Sale and Inventory Management platform delivered as a Windows desktop application (Electron), backed by a multi-tenant cloud control plane (license/subscription server + admin SaaS portal). It targets single-store through multi-branch/franchise retail operators across grocery, retail, electronics, pharmacy, cosmetics, mobile, and fashion verticals.

This document defines *what* the system does. Companion documents define *how* (architecture, schema, API, security, deployment).

## 2. Tenancy & Deployment Model

- **Tenant** = one paying customer organization (a business). A tenant owns one or more **Branches** (physical stores/warehouses).
- **Device** = one installed copy of the Electron app, bound to exactly one Branch at a time, registered against the tenant's license.
- Each Branch runs against a **local PostgreSQL instance** (bundled, embedded via a managed Postgres service on the device) that is the system of record for that branch's day-to-day operation. The **cloud** holds the tenant's master/shared data (catalog master, licensing, cross-branch reporting) and is reconciled via the Sync Engine (see [04-electron-architecture.md](04-electron-architecture.md) §Sync Engine and the offline-first design in §21 below).
- A tenant on a "Single Store" plan has exactly one branch and device-per-branch limits enforced by license; "Multi Branch"/"Franchise" plans raise branch and device caps.

## 3. Actors / Roles

| Role | Scope | Typical Permissions |
|---|---|---|
| Super Admin | Tenant-wide | Full access: all branches, billing, plugin management, user management |
| Branch Admin | Single branch | Full access within their branch; cannot see other branches' financials |
| Manager | Single branch | Sales, inventory, reports, approvals (returns/voids); no settings/user mgmt |
| Cashier | POS terminal only | Create sales, process payments, hold/resume invoices, open drawer (no voids without approval) |
| Inventory Manager | Single/multi branch | Products, stock adjustments, purchase orders, transfers |
| Accountant | Tenant or branch | Cash book, expenses, P&L, tax reports, no POS access required |

Roles are **templates**; actual access is governed by a granular permission matrix (see §15 and [11-security-design.md](11-security-design.md)). Custom roles can be created by Super Admin by cloning and editing a permission set.

## 4. Module Inventory

This is the authoritative list of functional modules. Each maps to a bounded context in the backend (see [03-backend-architecture.md](03-backend-architecture.md)).

1. Authentication & Session Management
2. License & Subscription Management
3. Plugin / Addon Marketplace
4. POS Terminal & Checkout
5. Payment Processing
6. Discount Engine
7. Invoice Management (sales, returns, voids)
8. Product & Catalog Management
9. Purchase Management
10. Inventory Management & Valuation
11. Customer Management & Loyalty
12. Supplier Management
13. Credit & Receivables / Payables
14. Reporting & Analytics
15. Accounting Lite
16. User & Role Management
17. System Settings
18. Printer Management
19. Barcode Management
20. Multi-Branch Management
21. Offline Sync Engine
22. Security & Audit
23. Notification Center
24. Multi-Currency
25. Tax Engine
26. Backup & Recovery
27. API Platform (REST + Webhooks)

## 5. Authentication & Session Management

- Login via username/PIN (fast cashier login at terminal) or email/password (admin/back-office).
- JWT access token (short-lived, 15 min) + refresh token (long-lived, 30 days, rotated on use, stored encrypted on device).
- **Device Registration**: first login on a new machine registers a Device record (hardware fingerprint + OS + app version) against the tenant's device quota. Device must be approved by a Super Admin/Branch Admin if quota exceeded or if "require device approval" setting is on.
- Session timeout configurable per role (e.g., cashier auto-logout after N minutes idle).
- Multi-factor authentication (TOTP) optional per user, enforceable per role by Super Admin.
- Offline login supported: cached credential hash + last-synced permission set allow login when cloud license server is unreachable, subject to grace period rules (§6).

## 6. License & Subscription Management

### 6.1 Plans
Monthly, Quarterly, Yearly, Lifetime (optional, one-time fee, no recurring billing but still subject to plugin subscriptions).

### 6.2 License Attributes
- License key (signed, see [05-license-server-architecture.md](05-license-server-architecture.md))
- Start date, expiry date
- Device limit, branch limit, user limit
- Plan tier (Starter / Professional / Enterprise) controlling which modules/plugins are entitled
- Status: Active, Suspended, Expired, Revoked

### 6.3 Admin Portal Capabilities
Create, Suspend, Extend, Upgrade, Downgrade, Revoke license — all from the Admin Cloud Portal (full Admin Portal API surface in [05-license-server-architecture.md](05-license-server-architecture.md) §6). Every action is audit-logged with actor, timestamp, before/after state.

### 6.4 Validation Flow
- On app launch and every N hours thereafter, device calls the License Server's `/license/validate` endpoint with device fingerprint + license key.
- Server returns signed validation token (JWT, short TTL) cached locally; app trusts the cached token if offline, up to the **grace period**.
- Grace period (default 7 days, tenant-configurable by platform operator, not by tenant): app remains fully functional.
- After grace period with no successful validation: **Disable Login** (existing sessions may finish, e.g. up to end of day, configurable) and **Disable Synchronization** (local operations continue logging but won't push to cloud) — see §6.5.
- **Renewal Reminder**: notification banner + email at 14/7/3/1 days before expiry.

### 6.5 Post-Expiry Behavior State Machine

```
ACTIVE --(expiry date passed)--> GRACE_PERIOD --(grace expires)--> LOCKED
ACTIVE --(admin suspends)------> SUSPENDED
GRACE_PERIOD --(renewal payment)--> ACTIVE
SUSPENDED --(admin reinstates)----> ACTIVE
LOCKED --(renewal payment)--------> ACTIVE
ANY --(admin revokes)-------------> REVOKED (terminal, requires new license)
```

In `LOCKED`: app opens to a "License Expired" screen only; no POS, no data entry. Existing local data is preserved (never deleted) and exportable so the tenant isn't held hostage.

## 7. Plugin / Addon Marketplace

- Plugins are versioned packages (signed zip/tarball) containing a manifest (`plugin.json`): id, name, version, entry points (frontend module federation remote + backend module), required host app version range, required permissions, billing model (included-in-plan vs. paid add-on).
- Admin Portal: Upload, Install (per tenant), Activate/Deactivate, Assign to Plan, set standalone price.
- Loaded dynamically at runtime — frontend via Module Federation remotes fetched from a plugin CDN URL; backend via NestJS dynamic module loading reading from a tenant's entitlement list at boot and on a "plugins changed" event (no full redeploy).
- Plugin sandboxing: plugins declare required permission scopes (e.g. `pos.cart.read`, `customer.write`); host enforces via the same RBAC gate used for core modules.
- Reference plugin catalog (built as first-class plugins to dogfood the architecture, not core): WhatsApp Integration, SMS Integration, Loyalty Program (note: a baseline loyalty capability also ships in core, see §11; the plugin extends it with campaigns), E-Invoicing, Accounting (full GL, beyond Accounting Lite), HR, Delivery Tracking, QR Ordering, Kitchen Display, AI Analytics, Customer Mobile App (companion app, separate deliverable).

Full design: [06-plugin-architecture.md](06-plugin-architecture.md).

## 8. POS Terminal & Checkout

### 8.1 Layout
- **Left rail**: product search (text + barcode scan input focus-trap), category tree, favorites/quick-pick grid.
- **Center**: product grid (image, name, price, stock badge), paginated/virtualized for large catalogs.
- **Right rail — Cart**: line items with product name, qty (+/- stepper), unit price (editable if permitted), per-line discount, tax, line total; running subtotal, discount, tax, grand total footer.
- **Bottom action bar**: Cash, Card, Bank Transfer, Mobile Wallet, Credit Sale, Return Invoice, Hold Invoice, Resume Invoice, Open Drawer.

### 8.2 Core Interactions
- Barcode scan (USB HID scanner emulating keyboard) adds/increments line item; unknown barcode prompts "create product?" (permission-gated).
- Hold Invoice: parks current cart with a label/customer tag, frees terminal for next customer; Resume Invoice lists held invoices for recall.
- Return Invoice: lookup by invoice number/customer/date range; supports full or partial (per-line, partial-quantity) return; restocks inventory per item's restock policy; triggers refund (cash/card reversal/store credit, configurable).
- Keyboard-first operation: every action has a shortcut (configurable, see [07-ui-wireframes.md](07-ui-wireframes.md) for the shortcut map); barcode field always focused by default.
- Multiple concurrent open carts (multi-tab) per terminal for environments with one cashier serving several queues (configurable on/off).

### 8.3 Cancellation / Void Workflow
- A completed invoice cannot be silently deleted. "Void" creates a reversing entry, requires a reason code, and — if past a configurable time/amount threshold — requires Manager/Branch Admin approval (approval request queued, cashier notified on decision). Full audit trail retained.

## 9. Payment Processing

- Payment dialog shows Invoice Total, Discount, Tax, Grand Total, Received Amount (numeric keypad input), Change Amount (auto-computed).
- Methods: Cash, Debit Card, Credit Card, Bank Transfer, Mobile Wallet, Credit Sale (against customer credit limit), **Mixed Payment** (split across N methods until grand total satisfied; each split row stores method + amount + reference).
- Card/Bank/Wallet methods support a reference/transaction-id field for reconciliation against external statements; integration with physical card terminals is plugin-extensible (not core), core records the result manually or via a generic payment-gateway plugin interface.
- On completion: invoice finalized (immutable), receipt printed/queued, cash drawer pulse sent if cash or "always open drawer" setting is on, stock decremented, customer ledger/credit updated if Credit Sale, loyalty points accrued.

## 10. Discount Engine

- Per-product discount: percentage or fixed amount, applied at line level, optionally constrained by a max-discount-percent policy per role.
- Per-invoice discount: percentage or fixed amount applied to subtotal before tax (configurable: before/after tax via Tax Engine settings, see §25... i.e. [Tax Engine in this doc §25]).
- Discounts can stack with promotional rules (coupons/loyalty — see §11) unless a "no-stack" flag is set on the promo.
- All discounts require the applying user to have `discount.apply` permission; discounts beyond a configured ceiling require manager override (PIN prompt).

## 11. Customer Management & Loyalty

- Customer profile: name, phone, email, address, tax/VAT number (B2B), credit limit, default price tier, tags.
- Ledger: running balance from credit sales, payments received, returns, opening balance.
- Purchase history, top customers (by revenue/frequency/recency — RFM), reward points balance, membership level (tiered via cumulative spend or explicit assignment).
- Loyalty mechanics: points-per-currency-unit earn rate (configurable per category), redemption rules, membership-level perks (e.g., bonus multiplier), coupons (single-use/multi-use, code or auto-applied), gift cards (stored-value, sellable as a product, redeemable as a payment method), cashback rules (percentage of spend returned as wallet credit or points).

## 12. Supplier Management

- Supplier profile, purchase history, outstanding payable balance, payment history (against purchase invoices), supplier reports (on-time delivery, price trend per product).

## 13. Purchase & Inventory Management

### 13.1 Purchase Flow
Purchase Order → Goods Receipt (partial receipt supported, generates Purchase Receipt) → Supplier Invoice (matched against PO + receipt, three-way match) → Supplier Payment (full/partial, multiple invoices per payment).
Purchase Return: against a receipt, reduces stock and supplier payable, optionally generates a debit note.

### 13.2 Inventory
- Multi-warehouse, each branch has ≥1 warehouse; stock tracked per (product, warehouse, batch?).
- Valuation methods: FIFO and Weighted Average Cost, selectable per tenant (affects COGS calculation across all reports — see [13-development-roadmap.md](13-development-roadmap.md) for phasing; changing valuation method mid-life requires a one-time recosting job, flagged as a high-risk operation requiring confirmation).
- Stock Ledger: immutable append-only movement log (every receipt, sale, return, adjustment, transfer writes a ledger row); current stock is a materialized projection, never hand-edited.
- Stock Adjustment (with reason code: damage, shrinkage, recount, etc.), Stock Reconciliation (count sheet vs system, generates adjustment), Stock Transfer (branch/warehouse to branch/warehouse, two-step: dispatch then receive, in-transit state in between).
- Batch tracking and Expiry tracking opt-in per product category; expiring/expired batches flagged in alerts and blocked (or warned, configurable) from sale past expiry.
- Reorder levels per (product, warehouse); Low Stock Alerts feed the Notification Center.

### 13.3 Product Advanced Features
- Variants (e.g., size/color matrix generating child SKUs from an attribute set on a parent product).
- Bundles (fixed set of components sold as one SKU, stock decremented on components at sale time) vs. Kits (assembled ahead of time into stock as its own trackable item, via a "kit assembly" transaction that consumes components and produces kit stock) — both supported, distinguished by *when* decomposition happens.
- Serial numbers for serialized goods (electronics) — one stock unit per serial, sale requires serial selection/scan.

## 14. Credit & Receivables / Payables

- Customer Outstanding & due dates (per invoice aging), Supplier Payables & due dates — both surfaced on the dashboard and in dedicated aging reports (current / 1-30 / 31-60 / 61-90 / 90+).
- Payment history per party; settlement allocation (FIFO-against-invoices by default, manual allocation override permitted).

## 15. User & Role Management

- Roles (§3) are starting templates; the actual enforcement unit is a **permission matrix**: `(module, action)` → boolean, per role, per branch-scope flag (a permission can be branch-scoped or tenant-wide).
- Granular permissions example set: `pos.sale.create`, `pos.sale.void`, `invoice.return.full`, `invoice.return.partial`, `discount.apply`, `discount.override`, `product.write`, `stock.adjust`, `purchase.approve`, `report.financial.view`, `settings.write`, `user.manage`, `plugin.manage`. Full matrix in [11-security-design.md](11-security-design.md).

## 16. System Settings

Company profile (name, logo, address, registration/tax IDs), receipt header/footer text, currency (base + enabled list), tax templates, printer assignments, barcode symbology/format, backup schedule, email/SMS provider credentials (for notifications and plugins), notification preferences.

## 17. Printer Management

80mm/58mm thermal receipt printers, A4/Letter invoice printing (PDF-based), PDF export of any document, cash drawer kick via printer's drawer-pulse pin or a generic ESC/POS command, printer test utility (prints a calibration/test receipt and reports printer status).

## 18. Barcode Management

Generate (Code128, EAN-13, QR for non-retail-standard use cases), print single-label or bulk (sheet layouts, configurable label size), USB HID scanner support (no special driver — keyboard-wedge input captured via a global input listener that distinguishes fast scanner input from human typing by inter-keystroke timing).

## 19. Reporting & Analytics

Sales, Product, Inventory, Profit, Customer, Supplier, Tax, Branch, Cashier, Audit reports. Each supports date-range, branch, and category filters and exports to PDF/Excel/CSV. Dashboard (Analytics Dashboard module): Today's Sales/Profit, Monthly/Yearly Profit, Top Products, Top Customers, Outstanding Receivables/Payables, Low Stock Alerts — all computed from materialized aggregate tables refreshed on a schedule + on-demand for "today" figures (see [02-database-design.md](02-database-design.md) §Reporting Schema).

## 20. Accounting Lite

Cash Book (all cash in/out incl. POS cash sales, expenses, drawer float), Expense & Income tracking (categorized), Daily Closing (drawer count vs expected, variance recorded), Cash Reconciliation, P&L Summary (revenue − COGS − expenses, by period). This is intentionally *not* a full general ledger/double-entry system — that capability is the "Accounting" plugin (§7) for tenants who need it.

## 21. Multi-Branch

Branch CRUD, inter-branch stock transfers (§13.2), branch-scoped vs. tenant-wide reporting, per-branch settings overrides (e.g., receipt footer can differ by branch) layered on tenant defaults.

## 22. Multi-Currency

Base currency selection per tenant; supported transaction currencies from {PKR, QAR, AED, SAR, USD, EUR, GBP}; exchange rates maintained manually or via a scheduled FX-rate-provider plugin; all reporting rolls up to base currency using the rate effective at transaction time (rate snapshot stored on the transaction, never recomputed retroactively).

## 23. Tax Engine

Tax templates (VAT/GST/Sales Tax/custom), each a named set of tax components (e.g., "VAT 5%", "VAT 5% + Excise 2%") attachable to products/categories. Inclusive or exclusive pricing mode per tenant (and override per product where legally required, e.g. mixed-VAT jurisdictions). Tax reports break down collected tax by template/jurisdiction for filing.

## 24. Notification Center

In-app + email/SMS (via plugin) channels for: Low Stock, Customer Due, Supplier Due, Subscription Expiry, Daily Sales Summary. User-level preferences for channel + frequency (immediate/digest).

## 25. Security & Audit

2FA (TOTP), audit logs (who/what/when/before-after for all writes to financial and master data), device binding, login history, permission matrix (§15), activity tracking (session-level: screens visited, not keystroke logging). Full design in [11-security-design.md](11-security-design.md).

## 26. API Platform

REST API mirroring all core operations (read for all modules, write where business-safe — e.g., sales can be created via API for e-commerce order injection but financial closing entries are UI/role-gated). Webhooks for event-driven integration (`invoice.created`, `stock.low`, `payment.received`, etc.). Designed for: third-party integration, a future official mobile app, and e-commerce connectors. Full design: [02-api-design.md](02-api-design.md).

## 27. Out of Scope (v1)

To keep "production-ready" honest rather than diluted across 27 modules at once, the following are explicitly deferred to plugins or later phases (see roadmap):
- Full double-entry general ledger (Accounting Lite only in core)
- Native mobile apps (API is ready; apps are a separate deliverable)
- AI forecasting (interfaces reserved, models not trained in v1)
- Card-terminal payment gateway certifications (manual reference capture only in core; certified integrations are per-gateway plugins)
