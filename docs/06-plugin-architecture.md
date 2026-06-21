# Plugin / Addon Architecture

Goal: install/activate/deactivate new capabilities into a deployed device **without rebuilding or reinstalling the host app**, while keeping plugins sandboxed enough that a misbehaving or malicious plugin can't read another tenant's data or destabilize core POS operation.

## 1. Plugin Package Anatomy

```
my-plugin/
  plugin.json            -- manifest (see §2)
  frontend/
    remoteEntry.js         -- Module Federation remote bundle
  backend/
    index.js               -- NestJS dynamic module entry, compiled CommonJS
  migrations/             -- plugin-owned Prisma/SQL migrations, isolated schema namespace (see §5)
  signature.sig            -- detached signature over the package tarball, verified before load
```

## 2. Manifest (`plugin.json`)

```json
{
  "id": "whatsapp-integration",
  "name": "WhatsApp Integration",
  "version": "1.2.0",
  "hostVersionRange": ">=2.0.0 <3.0.0",
  "frontend": { "remoteEntry": "frontend/remoteEntry.js", "exposedModule": "./WhatsAppPanel" },
  "backend": { "entry": "backend/index.js", "nestModuleExport": "WhatsAppModule" },
  "requiredPermissions": ["customer.read", "notification.send"],
  "settingsSchema": { "type": "object", "properties": { "apiKey": { "type": "string" } } },
  "billing": { "model": "paid-addon", "includedInPlans": ["enterprise"] }
}
```

## 3. Frontend Loading — Module Federation

- Host app (renderer) is a Module Federation **host**; each plugin's `remoteEntry.js` is a federation **remote**.
- Remotes are *not* known at host build time (that would defeat "no rebuild required") — instead the host loads remotes dynamically at runtime using `@module-federation/runtime`'s dynamic remote loading API, fed a URL resolved from the tenant's `tenant_plugin_state` (active plugins → CDN URLs from the Plugin Marketplace, see [05-license-server-architecture.md](05-license-server-architecture.md) §7).
- Each plugin exposes a known extension-point contract — e.g. a `SettingsPanel` component, a `POSCartAction` component, a `DashboardWidget` component — registered into specific slots in the host UI (Settings menu, POS action bar, Dashboard grid) rather than freely injecting arbitrary DOM, which keeps the host's layout integrity guaranteed regardless of plugin quality.
- Plugin UI runs in the same renderer process (Module Federation shares the React/MUI runtime to avoid bundle bloat and duplicate-React bugs) but is wrapped in an error boundary per mount point — a crashing plugin component degrades to an inline "plugin failed to load" placeholder, never a whole-app crash.

## 4. Backend Loading — Dynamic NestJS Modules

- At Branch API boot (and on a live "plugins changed" event from the Sync Engine), a `PluginLoaderService` reads the tenant's active plugin list, resolves each to a locally cached, signature-verified package, and calls `NestFactory`'s dynamic module registration (`ModuleRef`/`LazyModuleLoader`) to mount the plugin's NestJS module into the running application **without a process restart** for plugins that don't alter core routing; plugins that need a guaranteed-clean mount (rare) can declare `"requiresRestart": true` in the manifest and the host schedules a graceful restart prompt instead of a silent hot-load.
- A plugin backend module only receives access to the **ports** it declared in `requiredPermissions` — implemented as scoped, capability-based service tokens injected via DI (e.g. a plugin granted `customer.read` gets a `CustomerReadPort` instance, never the raw repository or `tenant_id`-unfiltered query access).

## 5. Plugin Data Isolation

- Plugins that need their own tables get a dedicated Postgres schema (`plugin_<id>`), migrated via their own bundled migration files, run by the host's migration runner in an isolated transaction at install time — a plugin cannot migrate or query outside its own schema plus the explicit read/write ports granted to it.
- This means a plugin can be uninstalled cleanly (`DROP SCHEMA plugin_<id> CASCADE`) without any risk of having silently bled state into core tables.

## 6. Lifecycle

```
Uploaded (Admin Portal) -> Published (visible in marketplace, gated by plan/purchase)
  -> Installed (tenant-level; pulls package to device on next sync, runs migrations)
  -> Activated (loaded into running app per §3/§4)
  -> Deactivated (unmounted from host UI + Nest module disposed; data retained)
  -> Uninstalled (schema dropped after explicit confirmation + data export offer)
```

Activate/Deactivate is the lightweight, frequent toggle (e.g. seasonal feature); Install/Uninstall is the heavier, infrequent operation involving migrations.

## 7. Versioning & Compatibility

- `hostVersionRange` (semver) checked before activation; an incompatible plugin is shown as "requires app update" rather than being force-loaded and crashing.
- Plugin updates follow the same signature-verification path as install; the host keeps the previous version cached and rolls back automatically if the new version fails its post-load health check (a plugin must export a `healthCheck()` the loader calls immediately after mount).

## 8. Security Model

- Every package is signature-verified (§1) before any code from it executes — matches the trust model used for the host app's own auto-updates ([10-update-mechanism.md](10-update-mechanism.md)).
- Declared permissions are the *ceiling* of what a plugin can do; the loader enforces this the same way the core `PermissionsGuard` enforces user permissions (re-using the RBAC primitive from [03-backend-architecture.md](03-backend-architecture.md) §5 rather than inventing a parallel system).
- Plugins cannot declare arbitrary new permission codes — only from the platform's fixed, reviewed permission catalog, so "what can a plugin possibly do" is always answerable by reading the manifest against a known list, not by reading the plugin's code.

## 9. First-Party Reference Plugins

Built as real plugins (not special-cased core code) specifically to prove the architecture isn't theoretical: WhatsApp Integration, SMS Integration, full Accounting (GL), Kitchen Display, QR Ordering. Each ships as a normal package through the same pipeline a third-party plugin developer would eventually use, once a public plugin SDK is published (post-v1, tracked in [13-development-roadmap.md](13-development-roadmap.md)).
