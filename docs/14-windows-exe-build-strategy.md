# Windows EXE Build Strategy

## 1. Toolchain

`electron-builder` targeting `nsis` (Windows installer) as the primary artifact. Build runs on a Windows CI runner (GitHub Actions `windows-latest`) — native modules used for hardware integration (`keytar`, `node-usb`/`node-serialport`, the embedded Postgres binary's platform-specific build) must be compiled/fetched for Windows specifically; cross-compiling these from Linux CI is not reliable enough to trust for a financial application, so the build pipeline does not attempt it.

## 2. Build Inputs

- `apps/desktop` (Electron main + preload) bundled via the Electron build step.
- `apps/renderer` built as a static asset bundle (Vite production build) and packaged into the app's resources directory — the renderer is *not* loaded from a remote URL at runtime; it ships inside the installer so the app's core UI works fully offline from first launch.
- Embedded Postgres binary (pinned version, Windows x64 build) bundled into `resources/` as an extra resource (`electron-builder`'s `extraResources`), not as a regular npm dependency, since it's a native binary distribution rather than JS.
- The Branch API (NestJS) compiled to a Node-runnable bundle and loaded in-process by the Electron main process (per [04-electron-architecture.md](04-electron-architecture.md) §1) — not spawned as a separate `.exe`, to avoid the complexity of managing a second process's lifecycle/crash-recovery independently of Electron's own.

## 3. Installer Behavior

- **Per-machine install** (not per-user) by default, since POS terminals are typically shared machines — installer requests elevation accordingly; a per-user fallback mode is available via an advanced installer flag for environments where IT policy forbids machine-wide installs.
- Creates Start Menu shortcut, optional desktop shortcut, optional "launch on Windows startup" registration (useful for dedicated terminals that should come up ready at boot without anyone manually opening the app).
- Silent/unattended mode (`/S`) for mass deployment per [10-update-mechanism.md](10-update-mechanism.md) §2.3, with a response file for pre-seeding license key + branch assignment.
- First-run wizard: license key entry (or "I'll do this later" for an internal demo/trial mode with a time-boxed unlicensed grace), branch selection/creation, initial admin user setup, printer detection.

## 4. Code Signing

- **EV (Extended Validation) code signing certificate** specifically — standard OV certs still trigger Windows SmartScreen warnings until enough install reputation accrues, which is unacceptable for a commercial product's first impression; EV certs get immediate SmartScreen trust.
- Signing happens in CI via a hardware-backed or cloud HSM-based signing service (e.g. Azure Trusted Signing or an equivalent) rather than a certificate file dropped into the repo/runner — the private key never touches a developer machine or sits in plain CI secrets storage as an exportable file.
- Both the installer (`.exe`) and the auto-update payloads are signed; `electron-updater` verifies the signature before applying any update (this is the same trust chain referenced in [10-update-mechanism.md](10-update-mechanism.md) and [06-plugin-architecture.md](06-plugin-architecture.md) §8 — one signing identity, consistently verified, rather than separate ad hoc trust mechanisms per subsystem).

## 5. Build Variants

- Single universal installer (no per-tenant builds, per [09-deployment-plan.md](09-deployment-plan.md) §1) — tenant branding/config is runtime-loaded from cloud config after license activation, not baked at build time.
- Architecture: x64 only for v1 (covers the overwhelming majority of retail POS hardware); ARM64 Windows support deferred until real demand appears, since the embedded Postgres binary and native modules would need their own ARM64 builds validated.

## 6. Artifact Verification

Every CI-produced installer is smoke-tested in the same pipeline run on a clean Windows VM image: silent install → first-run wizard completes headlessly with a seeded response file → app reaches the POS screen → a scripted test sale completes → uninstall cleanly removes the app while leaving the user's data directory intact (data removal is a separate, explicit, confirmed action — never a side effect of uninstalling the application binary).

## 7. Packaging Size & Footprint Management

The embedded Postgres binary and bundled Chromium (inherent to Electron) make this a large installer by typical SaaS-web-app standards — that's an accepted tradeoff for true offline-first operation, not an oversight. Mitigations to keep it reasonable: delta updates (§ [10-update-mechanism.md](10-update-mechanism.md) §1) so routine updates don't re-download the full Postgres binary every time, and `asar` packaging with `asar-unpack` for native modules that require filesystem access at runtime.

## 8. Uninstall & Data Retention

Uninstaller removes the application binaries and Start Menu/registry entries but, by default, **preserves** `%APPDATA%/VantagePOS` (database, backups, license cache) — a reinstall on the same machine resumes from existing data rather than starting blank, and a tenant decommissioning a terminal can explicitly choose "remove all data" as a distinct, confirmed step, never bundled into the default uninstall flow given how high-stakes accidental data loss would be for a financial system.
