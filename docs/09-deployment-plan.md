# Deployment Plan

Two independent deployment targets with different cadences and risk profiles: the **Desktop App** (ships to end-user machines) and the **Cloud Platform** (License Server + Admin Portal + Plugin Marketplace API, ships to the platform operator's own infrastructure).

## 1. Desktop App Distribution

- **Channel**: signed Windows installer (NSIS via `electron-builder`), distributed from the platform's own CDN-backed download endpoint and update feed — not the Microsoft Store (avoids store review latency for an enterprise B2B product; revisit post-v1 if store distribution becomes a sales requirement).
- **Channels/rings**: `stable`, `beta`, `internal` — each tenant's devices are pinned to a channel (default `stable`); the platform operator can stage a release to `internal` → `beta` → `stable` with bake time at each ring, configurable per [10-update-mechanism.md](10-update-mechanism.md).
- **Versioning**: SemVer; major version bumps may coincide with a `hostVersionRange` change that gates plugin compatibility (see [06-plugin-architecture.md](06-plugin-architecture.md) §7).
- **Release artifact**: single installer per release; per-tenant customization (logo, default settings) happens at runtime from cloud config, never via separate per-tenant builds — keeps the build matrix to exactly one.

## 2. Cloud Platform Deployment

- **Infra**: containerized (Docker) NestJS services behind a managed load balancer; managed Postgres (HA primary/standby) per [05-license-server-architecture.md](05-license-server-architecture.md) §8; object storage (S3-compatible) for plugin packages and report exports.
- **Environments**: `dev` → `staging` → `production`, promoted via the same container image (build once, promote the artifact, never rebuild per environment) — config injected via environment variables/secrets manager, not baked into the image.
- **CI/CD**: GitHub Actions. On merge to `main`: run full test suite ([12-testing-strategy.md](12-testing-strategy.md)) → build container images → push to registry → auto-deploy to `staging` → manual approval gate → deploy to `production`. Database migrations run as a separate, reviewed step before the new image is promoted live (migrate-then-deploy, never deploy-then-migrate, to avoid a window where new code runs against old schema).
- **Rollback**: prior container image + a verified-reversible migration policy (every migration must ship a tested `down` path, or be additive-only if a clean down isn't feasible, e.g. for destructive column drops which are always done as a two-step deprecate-then-drop across separate releases).

## 3. Database Migrations (both branch-local and cloud)

- Branch-local schema migrations (Prisma Migrate) ship *inside* the desktop app's update package and run automatically on first launch after an update, wrapped in a transaction with an automatic restore-from-backup fallback if a migration fails (see §5).
- Cloud schema migrations run as part of the CI/CD pipeline (§2), never automatically triggered by a client — the cloud schema's evolution is entirely under the platform operator's control.

## 4. Environment Configuration

| Env | Purpose | Data |
|---|---|---|
| dev | Local developer machines, ephemeral | Synthetic seed data |
| staging | Pre-prod validation, mirrors prod topology at smaller scale | Anonymized snapshot or synthetic data — never real tenant data |
| production | Live platform | Real tenant data |

Secrets (DB credentials, signing keys, payment provider keys) managed via a secrets manager (cloud provider's native one — AWS Secrets Manager/Azure Key Vault/etc., decided at infra-provisioning time, not an architectural constraint), never committed, never in plain environment files beyond local `dev`.

## 5. Backup & Recovery

- **Device-level**: scheduled local backup of the embedded Postgres data directory (pg_dump logical backup, default nightly + before every app auto-update) to a local backups folder, with the most recent N retained; optional **cloud backup** upload (encrypted, tenant-scoped object storage) for tenants on plans that include it, enabling "one-click restore" onto a replacement device.
- **Cloud-level**: managed Postgres automated snapshots (point-in-time recovery window per the managed provider's standard offering, minimum 7 days) + a documented disaster-recovery runbook (RTO/RPO targets defined once the platform operator's hosting provider is chosen — left open here as it's an infra decision, not an architecture one).
- **Recovery drill**: the "Restore from last backup" path referenced in [04-electron-architecture.md](04-electron-architecture.md) §2 is exercised by an automated test in CI (spin up a fresh embedded Postgres, restore a fixture backup, assert data integrity) so it's never a code path that only gets tested manually, under pressure, during a real incident.

## 6. Release Checklist (per desktop release)

1. Full test suite green (unit, integration, E2E — [12-testing-strategy.md](12-testing-strategy.md)).
2. Migration dry-run against a production-data-shaped fixture.
3. Auto-updater smoke test: install previous stable version, trigger update, verify silent update completes and app data is intact.
4. Code-signing certificate valid and applied ([14-windows-exe-build-strategy.md](14-windows-exe-build-strategy.md)).
5. Staged rollout: internal ring (24h+ bake) → beta ring (tenant volunteers, 48h+ bake) → stable.
6. Release notes published; breaking changes (plugin compatibility, schema) flagged distinctly from routine fixes.

## 7. Admin Portal Deployment

Deployed as its own static frontend (CDN-hosted SPA) calling the Cloud Platform API — versioned and deployed independently of both the desktop app and the API itself, since it's consumed only by platform-operator staff and can iterate fastest of the three surfaces without any tenant-facing risk.
