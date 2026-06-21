# Vantage POS — Architecture & Planning Documents

Read [00-functional-specification.md](00-functional-specification.md) first — it defines scope, tenancy model, and module inventory that every other document assumes.

| Doc | Covers |
|---|---|
| [00-functional-specification.md](00-functional-specification.md) | What the system does, module by module |
| [01-database-design.md](01-database-design.md) | Schema, ERD, branch-local vs cloud split |
| [02-api-design.md](02-api-design.md) | REST API surface, conventions, sync endpoints |
| [03-backend-architecture.md](03-backend-architecture.md) | NestJS modular monolith, DDD layering |
| [04-electron-architecture.md](04-electron-architecture.md) | Process model, native integrations, Offline Sync Engine |
| [05-license-server-architecture.md](05-license-server-architecture.md) | Cloud control plane, license validation, Admin Portal API |
| [06-plugin-architecture.md](06-plugin-architecture.md) | Dynamic plugin loading, sandboxing, lifecycle |
| [07-ui-wireframes.md](07-ui-wireframes.md) | Screen layouts, shortcut map, theming |
| [08-folder-structure.md](08-folder-structure.md) | Monorepo layout |
| [09-deployment-plan.md](09-deployment-plan.md) | Release channels, CI/CD, backup & recovery |
| [10-update-mechanism.md](10-update-mechanism.md) | Auto/manual/silent update, rollback, staged rollout |
| [11-security-design.md](11-security-design.md) | AuthN/AuthZ, data protection, audit, compliance posture |
| [12-testing-strategy.md](12-testing-strategy.md) | Test pyramid, sync-engine test harness, CI gating |
| [13-development-roadmap.md](13-development-roadmap.md) | Phased delivery plan, Phase 0 → Phase 7 |
| [14-windows-exe-build-strategy.md](14-windows-exe-build-strategy.md) | electron-builder, code signing, installer behavior |

## Key decisions worth knowing before reading further

- Each branch runs its own embedded Postgres (offline-first); the cloud holds licensing, plugin entitlement, and tenant master data — see [00-functional-specification.md](00-functional-specification.md) §2 and [04-electron-architecture.md](04-electron-architecture.md) §4.
- Sync conflict resolution is mostly *designed away* per data class (append-only financial records, last-writer-wins master data, never-synced rebuildable projections) rather than handled by a generic merge engine — [04-electron-architecture.md](04-electron-architecture.md) §4.4.
- v1 deliberately excludes a full general ledger, native mobile apps, and trained AI models — these are plugin/post-v1, not cut corners — [00-functional-specification.md](00-functional-specification.md) §27 and [13-development-roadmap.md](13-development-roadmap.md).
- Product name "Vantage POS" used throughout is a placeholder — rename before any external-facing use.
