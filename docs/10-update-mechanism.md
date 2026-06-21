# Update Mechanism

## 1. Mechanism

`electron-updater` (the `electron-builder` companion library) using the generic provider pointed at the platform's own release feed (not GitHub Releases, to keep distribution fully under the platform operator's control and avoid coupling release infra to a third party). Delta updates where supported (NSIS blockmap diffing) to minimize download size for cashiers on modest store-network connections.

## 2. Modes

### 2.1 Auto Update (default)
- App checks the release feed on launch and every 4 hours thereafter (configurable).
- New version downloads **in the background** without interrupting the active POS session.
- Once downloaded, the app does **not** silently relaunch — it shows a non-blocking "Update ready" indicator and applies the update at the next natural app restart, *or* immediately if the app is idle (no open cash drawer session, no held invoices mid-edit, no active payment dialog) — the safety gate described in [04-electron-architecture.md](04-electron-architecture.md) §7.
- If the app has been left running for an extended period without a natural restart point (common on a terminal that never gets shut down), a soft prompt appears once-daily: "Restart to apply update" with a snooze option, escalating to a more insistent prompt after a configurable number of snoozes (default 3 days) so updates don't get deferred indefinitely.

### 2.2 Manual Update
- Settings → About screen shows current version, channel, and a "Check for updates" button for on-demand checks (useful for support troubleshooting: "did the fix actually land").
- A tenant/device can be set to `manual` mode (no auto-download) for environments with strict change-control policies; in this mode the indicator still appears but nothing downloads until the user/admin explicitly triggers it.

### 2.3 Silent Install (initial installer)
- The installer itself supports a silent/unattended flag (`/S` for NSIS) for IT-managed mass deployment across many terminals in a chain/franchise rollout, paired with a response-file mechanism for pre-seeding the license key and branch assignment so a freshly imaged machine can be provisioned without manual data entry at first boot.

## 3. Safety Gates Before Applying an Update

1. No open, uncommitted cash drawer session blocking a forced restart without confirmation.
2. No held invoice actively being edited in the current view.
3. Local database has a fresh backup (§ see [09-deployment-plan.md](09-deployment-plan.md) §5 — a pre-update backup is triggered automatically, not just the nightly schedule) before migrations run.
4. Migration dry-run succeeds against the current local schema (the bundled migration runner checks the schema's current version against the package's expected baseline before touching data — if there's a mismatch beyond what the migration set can bridge, the update aborts and surfaces a support-diagnostic bundle instead of running blind).

If any gate fails, the update is deferred (not aborted entirely) and retried at the next eligible restart point, with the failure reason logged and surfaced in the "Update ready" indicator's detail view, not just silently retried forever invisibly.

## 4. Rollback

If an update's post-install health check fails (Branch API fails to boot, or a smoke-check endpoint doesn't respond within a timeout after restart), `electron-updater`'s staged rollout combined with a kept-previous-version directory allows the app to **revert to the last-known-good version automatically** on the next launch, restoring the pre-update database backup taken in §3.3. This is the same fail-safe pattern used for plugin updates ([06-plugin-architecture.md](06-plugin-architecture.md) §7) — one rollback mechanism, reused, rather than two bespoke ones.

## 5. Staged Rollout & Channels

Matches the ring structure in [09-deployment-plan.md](09-deployment-plan.md) §1: `internal` → `beta` → `stable`. The release feed serves a different manifest per channel; a device's channel assignment is a local setting (default `stable`) overridable per-tenant by the platform operator for early-access arrangements.

## 6. Update of the Embedded Postgres Binary

Postgres major-version upgrades (rare, high-risk) are never bundled silently inside a routine app update. They ship as a distinctly flagged release requiring explicit admin confirmation and an automatic pre-upgrade backup + `pg_upgrade`/dump-and-reload path, run with the app in a dedicated "maintenance mode" screen rather than in the background — this is the one update category where "silent" is deliberately not the default, because a failed Postgres major upgrade is the single highest-blast-radius failure mode in the whole update system.

## 7. Telemetry

Update outcomes (success/failure/rollback, by version and channel) are reported to the cloud platform (opt-out available per tenant for privacy-sensitive deployments) purely for release-health monitoring — this is what allows a staged rollout to actually gate promotion from `beta` to `stable` on real failure-rate data rather than a fixed bake timer alone.
