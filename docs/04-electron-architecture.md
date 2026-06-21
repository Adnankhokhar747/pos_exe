# Electron Architecture (incl. Offline Sync Engine)

## 1. Process Model

```
Main Process (Node.js)
  - App lifecycle, window management, auto-updater, native menus, global shortcuts
  - Hosts the embedded Branch API (NestJS) as an in-process HTTP server bound to 127.0.0.1:<dynamic-port>
  - Owns the embedded Postgres lifecycle (start/stop/health-check the bundled Postgres binary)
  - Owns native integrations: USB HID barcode listener, ESC/POS printer/cash-drawer driver, license-key secure storage (OS keychain via `keytar`)
  - Owns the Sync Engine worker (push/pull loop, conflict resolution)
Preload Script (contextBridge)
  - Exposes a narrow, typed IPC API to the renderer (`window.vantage.*`) — no direct Node/fs/child_process access from renderer
  - contextIsolation: true, nodeIntegration: false, sandbox: true (locked down per Electron security checklist)
Renderer Process (Chromium)
  - React + TypeScript + Material UI + Tailwind SPA
  - Talks to the Branch API over HTTP (localhost) for data, and over IPC for native-only concerns (printing, scanner events, update prompts)
```

Why an embedded HTTP API rather than pure IPC for data access: it keeps the renderer's data layer (React Query/TanStack Query, fetch calls, DTO contracts) **identical** to how a future companion mobile app or browser-based admin view would talk to the same backend — the API design in [02-api-design.md](02-api-design.md) isn't a fiction for one client, it's the actual contract for both today's Electron renderer and tomorrow's other clients.

## 2. Embedded Postgres

- Ship a bundled, version-pinned Postgres binary (via `embedded-postgres` or an equivalent packaged distribution for Windows) inside the installer — the end user never installs Postgres themselves.
- Data directory lives under `%APPDATA%/VantagePOS/pgdata`, excluded from the auto-updater's purge/reinstall paths.
- On first run: initialize data directory, run Prisma migrations, seed reference data (currencies, default tax templates, default roles/permissions).
- On every app start: health-check the Postgres process before starting the Branch API; if Postgres fails to start (corrupt data dir, port conflict), show a recovery screen offering "Restore from last backup" (§ see [09-deployment-plan.md](09-deployment-plan.md) Backup & Recovery) rather than a raw crash.

## 3. Native Integrations

- **Barcode scanner**: USB HID scanners present as a keyboard. A global `keydown` listener (scoped to the POS screen) buffers keystrokes and flushes as a "scan" when inter-keystroke interval is below a threshold (~30ms) and ends in the scanner's configured terminator (commonly Enter) — distinguishes scanner bursts from human typing without a special driver.
- **Receipt/label printing**: ESC/POS commands sent via a native printing bridge (`node-thermal-printer` or direct raw USB/serial via `node-usb`/`node-serialport` depending on connection type); A4/PDF invoices rendered via a headless Chromium print-to-PDF (Electron's built-in `webContents.printToPDF`).
- **Cash drawer**: drawer-kick pulse sent as an ESC/POS command through the assigned receipt printer (standard RJ11 kick-out wiring) — no separate drawer driver needed for the common case; a generic serial/relay driver is plugin-extensible for non-standard drawers.
- **License key storage**: license token cached via `keytar` (OS-native credential store), never in plaintext on disk, never in `localStorage`.

## 4. Offline Sync Engine

### 4.1 Principles
- The Branch API and its local Postgres are **always the source of truth for the device's own writes** — the app never blocks a sale waiting on the cloud.
- Sync is **asynchronous, queued, and idempotent**. Every syncable write is recorded in a local `sync_jobs` outbox table in the same transaction as the business write (transactional outbox pattern) — guarantees no write is ever silently lost to a missed sync.

### 4.2 Push (device → cloud)
1. Sync worker polls `sync_jobs` (status = pending), batches up to N rows per table.
2. POSTs to `/api/v1/sync/push` with `{table, op, row, version, client_timestamp}[]`.
3. Cloud applies each row: if the row's `version` matches the cloud's last-known version for that id, apply and increment; if not, it's a **conflict**.
4. Cloud responds with per-row accepted/conflict; worker marks accepted rows `synced`, and for conflicts, applies the resolution policy (§4.4) and marks `resolved` or `conflict` (surfaced to a Branch Admin "Sync Issues" screen if it can't auto-resolve).

### 4.3 Pull (cloud → device)
1. Worker requests `/api/v1/sync/pull?since_cursor=<last>` periodically (default every 60s when online) and immediately on network-reconnect (detected via a `navigator.onLine`-style check plus an actual ping, since `onLine` is unreliable).
2. Applies incoming changes to local tables inside a transaction; tables under active local edit conflict-check against the same version field.

### 4.4 Conflict Resolution Policy

| Data class | Policy |
|---|---|
| Financial records (invoices, payments, stock ledger) | **Append-only, no conflict possible** — these are never updated after creation, only voided/reversed via a new row. Sync conflicts on these classes can't occur by construction. |
| Configuration/master data (products, customers, settings) | **Last-writer-wins by field-level timestamp**, not whole-row — editing a product's price on Device A and its description on Device B both survive. |
| Stock levels | Never synced directly — they're a local projection rebuilt from `stock_ledger`; only the ledger syncs, eliminating an entire class of quantity-drift conflicts. |
| Licenses/plugins/users/roles | **Cloud-authoritative, one-way pull** — device never pushes changes to these; local UI for editing them writes through the cloud API directly when online, queued-and-blocked (not queued-and-applied-optimistically) when offline, since identity/entitlement changes are too high-stakes for optimistic local application. |

This table is the single most important design decision in the sync layer: most "conflict resolution" complexity is eliminated up front by choosing append-only/projection-rebuild/cloud-authoritative patterns per data class, rather than building a generic CRDT-style merge engine for everything.

### 4.5 Background Sync & Connectivity Detection

Sync worker runs in the main process (not renderer) so it continues across renderer reloads/crashes. Connectivity detected via a lightweight authenticated heartbeat to the cloud API (not just DNS/ping, since corporate networks often have captive portals that "succeed" without real connectivity). Exponential backoff on repeated failures, capped at 5 minutes, reset immediately on a detected network-change OS event.

## 5. Local Storage Layer Summary

| Concern | Storage |
|---|---|
| Business data | Embedded Postgres |
| License token cache, refresh token | OS keychain (`keytar`) |
| UI preferences (theme, last screen, shortcut customization) | `electron-store` (JSON file, non-sensitive) |
| Sync outbox/inbox bookkeeping | Postgres `sync_jobs`/`sync_cursor` tables (transactional with business data, not a separate file store) |

## 6. Window & UX Shell

Single main window, kiosk-able (configurable fullscreen for dedicated POS terminals), secondary windows allowed for: customer-facing display (order summary, optionally on a second monitor), pole display driver output. Global shortcuts (e.g., `F2` new sale, `F9` payment) registered at the main-process level so they work even when focus is in a modal, mapped per [07-ui-wireframes.md](07-ui-wireframes.md).

## 7. Update & Crash Recovery touchpoints

Detailed in [10-update-mechanism.md](10-update-mechanism.md); the architectural hook here is that the auto-updater lives in the main process, downloads in the background, and never applies an update while a cash drawer session or held invoices exist unresolved without explicit confirmation — financial-data safety takes priority over update freshness.
