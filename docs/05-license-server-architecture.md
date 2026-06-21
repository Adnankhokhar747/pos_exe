# License Server Architecture (Cloud Control Plane)

This is the cloud-hosted service backing license/subscription management, plugin marketplace entitlement, and the Admin Portal. Deployed independently from any single tenant's device — this is the platform operator's own multi-tenant SaaS backend.

## 1. Responsibilities

- Issue, validate, suspend, extend, upgrade/downgrade, revoke licenses.
- Track device registrations per tenant against device/branch/user limits.
- Serve as the source of truth for plugin entitlement (which plugins a tenant can load).
- Drive renewal billing (via a payment provider integration — Stripe or a regional equivalent given the target currencies in [00-functional-specification.md](00-functional-specification.md) §22) and emit renewal reminder events to the Notification Center.
- Host the Admin Portal API consumed by the separate Admin Portal frontend (§ see this doc's §6).

## 2. License Key Design

A license key is a compact, human-typeable string (e.g. `VNT-XXXX-XXXX-XXXX-XXXX`) that is **not itself the secret** — it's an identifier. Validation never trusts a key offline by checking the key's format; it must be exchanged for a signed validation token from the server (or from the last-cached token within grace period).

```
Validation Token = JWT signed with the platform's private key (RS256), containing:
  { license_id, tenant_id, device_id, plan_tier, entitled_module_codes[], entitled_plugin_codes[],
    device_limit, branch_limit, user_limit, expires_at, issued_at }
```

The device verifies this token's signature locally using the platform's public key (embedded in the app binary), so license checks work fully offline once a token has been issued — the device never needs to "trust" its own database, only a signature it can verify without network access.

## 3. Validation Flow (sequence)

```
Device                         License Server
  | --- POST /license/validate {license_key, device_fingerprint, app_version} --->
  |                                  | check license status, device quota,
  |                                  | upsert device registration (or reject if quota exceeded
  |                                  |   and device not pre-approved)
  | <--- 200 { validation_token (JWT), server_time } ---
  | cache validation_token + received-at timestamp locally
```

- Re-validated every 6–12 hours while online (configurable), and opportunistically on app launch.
- If offline: device computes `elapsed = now - cached_token.issued_at`. While `elapsed < expires_at - issued_at + grace_period_days`, app treats the license as valid using the cached token's entitlements. Past that, app transitions to `LOCKED` per the state machine in [00-functional-specification.md](00-functional-specification.md) §6.5.
- Clock-tamper mitigation: device's local clock is sanity-checked against the last known-good `server_time` on every successful online validation; if local clock has jumped backward beyond a tolerance versus the monotonic process uptime counter, the cached token is treated as suspect and a re-validation is forced before continuing in offline mode for more than a short buffer — prevents trivially extending grace period by turning back the system clock.

## 4. Device Registration & Quota Enforcement

- First successful validation from a new `device_fingerprint` (hash of stable hardware identifiers + OS install id — never raw hardware serials, for privacy) creates a `devices` row in `pending` or `approved` state depending on the tenant's "require device approval" setting and current count vs `device_limit`.
- Over-quota registration attempts return `403` with a clear reason; Admin Portal surfaces a "Device requests" queue for Super Admins to approve/deny or free up a slot by deactivating an old device.

## 5. Suspension / Revocation Propagation

Suspends and revokes take effect at the **next validation call** the device makes — there is no push-kill channel to a device that's deliberately kept offline (by design: this is a B2B desktop product, not DRM that phones home aggressively). This is an accepted business tradeoff documented here so it isn't "discovered" later: a tenant that goes offline and never reconnects can keep operating past a revocation until the device happens to reconnect. Mitigations: (a) grace period is short by default, (b) periodic validation interval is enforced even offline via the cached-token expiry math in §3, (c) for sensitive enterprise customers, an opt-in stricter mode can shorten the offline tolerance window via tenant settings.

## 6. Admin Portal API Surface

```
POST   /admin/v1/licenses                     -- create
PATCH  /admin/v1/licenses/:id/suspend
PATCH  /admin/v1/licenses/:id/extend           { new_expiry }
PATCH  /admin/v1/licenses/:id/upgrade          { plan_id }
PATCH  /admin/v1/licenses/:id/downgrade        { plan_id }
PATCH  /admin/v1/licenses/:id/revoke
GET    /admin/v1/licenses?filter[status]=...
GET    /admin/v1/tenants/:id/devices
PATCH  /admin/v1/devices/:id/approve|reject|deactivate
POST   /admin/v1/plugins                       -- upload (manifest + package)
PATCH  /admin/v1/plugins/:id/publish|deprecate
POST   /admin/v1/plugins/:id/grant-to-plan
POST   /admin/v1/tenants/:id/plugins/:pluginId/install
GET    /admin/v1/billing/invoices
```

All Admin Portal actions write an immutable `license_events`/equivalent audit row (actor, before/after, timestamp) — this is the system a platform-operator support team will be audited against, so it gets the same audit rigor as tenant-facing financial data.

## 7. Plugin Distribution

Published plugin packages are stored in object storage (S3-compatible) behind signed, time-limited download URLs; package integrity verified by checksum in the manifest and, for elevated trust, a code-signing signature checked before the host loads the package (mirrors how the Electron app itself is signed — see [14-windows-exe-build-strategy.md](14-windows-exe-build-strategy.md)). A device only downloads plugins its tenant is entitled to (cross-checked against the validation token's `entitled_plugin_codes`), so entitlement is enforced at both the marketplace API and the download layer, not solely on trust in the client.

## 8. High Availability & Multi-Region Considerations

v1 target: single-region deployment (the platform operator's primary customer base determines region) with standard managed Postgres HA (primary + standby, automated failover) — this is a control-plane service, not the high-write-volume path (that's on-device), so it doesn't need to be over-engineered for v1. Multi-region read replicas are a documented future step once tenant geographic spread justifies it, not a v1 requirement.

## 9. Security Notes

- RS256 asymmetric signing (not HS256) specifically so the *public* key can ship inside the distributed Electron binary without exposing the ability to mint valid tokens — only the License Server holds the private key.
- All Admin Portal endpoints require platform-operator staff authentication (separate identity realm from tenant users — a tenant's Super Admin has zero access to the Admin Portal; it's an entirely different audience), with mandatory 2FA.
- Rate limiting and anomaly detection on `/license/validate` (a sudden spike of validation calls for one license from many distinct device fingerprints is a sharing/abuse signal surfaced to the platform operator, not auto-blocked, to avoid false-positive lockouts of legitimate multi-device tenants).
