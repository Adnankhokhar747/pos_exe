# Security Design

## 1. Threat Model Summary

This is a financial system handling payment data, customer PII, and business-sensitive figures (margins, costs), deployed on physically-accessible, sometimes shared, desktop machines, with an offline-capable local database — meaning the device itself, not just the network, is part of the attack surface. The design below treats "someone has physical/OS access to the machine" as a realistic scenario, not an edge case.

## 2. Authentication

- Passwords: Argon2id hashing (memory-hard, resistant to GPU cracking — preferred over bcrypt for new systems), never stored or logged in plaintext anywhere, including debug logs.
- PIN login (fast cashier path): PINs are short by design for speed-of-entry, so they are **never** treated as a standalone secret for sensitive actions — PIN login grants a *cashier-scoped* session; anything requiring Manager/Admin privilege re-prompts for full password or a manager-PIN override captured via a distinct, longer-PIN class with its own rate limiting.
- Brute-force protection: exponential lockout after 5 failed attempts per account, per device, tracked in `login_history` ([01-database-design.md](01-database-design.md) §2); lockout is account+device scoped, not global, so one compromised device can't be used to lock out a whole org's accounts (a DoS vector to avoid).
- 2FA (TOTP): optional per user, enforceable per role by Super Admin (e.g. mandate 2FA for all Branch Admins). Recovery codes generated at enrollment, single-use, stored hashed.
- JWT access tokens: 15-minute TTL, signed with a per-tenant-environment secret (cloud) / the platform's RS256 keypair (license validation tokens, see [05-license-server-architecture.md](05-license-server-architecture.md) §2); refresh tokens rotated on every use (refresh token reuse after rotation is treated as a stolen-token signal and revokes the whole session family).

## 3. Authorization (RBAC)

- Permission matrix enforced server-side on every request via `PermissionsGuard` ([03-backend-architecture.md](03-backend-architecture.md) §5) — the UI hiding a button is a UX nicety, never the actual control. Every protected endpoint has an automated test asserting it rejects a caller lacking the required permission ([12-testing-strategy.md](12-testing-strategy.md)).
- Branch-scoping is enforced at the same layer: a Branch Admin's token carries their granted branch id(s); cross-branch access attempts return `403`, not a filtered/empty result (explicit denial, not silent data hiding, so the difference between "no data" and "not allowed" is never ambiguous to the caller in a way that leaks info — though for the *permission denial itself*, we deliberately don't leak whether the resource exists at all, to avoid enumeration: a Branch Admin probing another branch's invoice id gets the same 403 whether or not that invoice id is real).

## 4. Data Protection

- **At rest**: embedded Postgres data directory is on the local disk without OS-level full-disk encryption assumed by default (can't mandate that on a customer's machine), so the application layer encrypts specific highly-sensitive columns (payment reference tokens, TOTP secrets, license token cache) using a key held in the OS keychain (`keytar`) — not a key stored alongside the encrypted data. Bulk business data (invoices, customers) is not individually column-encrypted (would cripple query performance for marginal benefit against a threat model where DB-level access already implies broad compromise); the mitigation there is OS-account-level access control plus the audit trail (§6) that makes any such access attributable.
- **In transit**: TLS 1.2+ for all cloud API traffic; the local Branch API binds to `127.0.0.1` only (never `0.0.0.0`) so it's not reachable from the local network, eliminating a whole class of "another device on the store Wi-Fi hits the POS API" attacks.
- **Secrets**: license tokens, refresh tokens, plugin API keys — OS keychain, never `localStorage`/plain files. Cloud-side secrets — secrets manager (§ [09-deployment-plan.md](09-deployment-plan.md) §4).

## 5. Device Binding & License Security

Covered in depth in [05-license-server-architecture.md](05-license-server-architecture.md) §2–§5: hardware-fingerprint-based device registration, RS256-signed offline-verifiable validation tokens, clock-tamper mitigation. The key security property: **the device never has to trust its own local state for license validity** — it trusts a cryptographic signature it can verify without round-tripping to the server, which is what makes "secure offline licensing" not a contradiction in terms.

## 6. Audit Logging

- Every write to financial or master data records `(actor, action, entity, before, after, timestamp)` in `audit_log_entries` ([01-database-design.md](01-database-design.md) §12) — append-only, no update/delete path exposed at the application layer (a Postgres `REVOKE UPDATE, DELETE` on that table for the application's DB role, enforced at the database grant level, not just by convention in code).
- Login history, permission changes, void/cancellation approvals, and license/plugin admin actions are all first-class audit event types with dedicated report views (per [00-functional-specification.md](00-functional-specification.md) §19 Audit Reports).
- Audit data syncs to cloud cold storage in batches (not real-time) — it's a forensic record, not an operational hot path, so it can tolerate sync latency that financial-ledger data cannot.

## 7. Session Management

- Idle timeout per role (cashiers shorter, admins configurable longer), enforced both client-side (auto-lock screen) and server-side (token TTL) — never relying on the client to self-report inactivity honestly.
- "Active sessions" view per user (Settings → Security) listing device + last-active, with a remote "revoke session" action that invalidates the refresh token server-side immediately (next API call with the old access token fails at its natural 15-minute expiry at the latest — acceptable bound, not instant kill, given the offline-first design can't guarantee instant push revocation any more than license revocation can, per [05-license-server-architecture.md](05-license-server-architecture.md) §5).

## 8. Plugin Security

Covered in [06-plugin-architecture.md](06-plugin-architecture.md) §8 — signature verification before load, capability-scoped permission grants enforced through the same RBAC primitive as core code, schema-isolated data access. Repeated here only to flag the cross-cutting principle: **plugins are not a trust boundary exception** — they go through the identical guard and audit pipeline as first-party code, just with a smaller granted permission set.

## 9. Input Validation & Injection Prevention

- All API input validated via `class-validator` DTOs at the boundary (§ [03-backend-architecture.md](03-backend-architecture.md) §8); ORM parameterized queries exclusively — no raw SQL string concatenation anywhere in application code (enforced by the same lint rule that enforces tenant-scoping in §3 of backend architecture, since both rules target "no unmediated raw query access").
- Renderer: React's default JSX escaping handles XSS for rendered data; any place that must render trusted HTML (e.g. a rich-text receipt footer) goes through a sanitization pass (`DOMPurify`) before render — never `dangerouslySetInnerHTML` on unsanitized input.
- Electron-specific: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and a strict `Content-Security-Policy` meta tag in the renderer disallowing remote script execution — closes the most common Electron RCE vector (a compromised/malicious remote-loaded script gaining Node access).

## 10. Compliance Posture

- PCI DSS: the core app never stores full card numbers/CVV (card payments are reference-capture only per [00-functional-specification.md](00-functional-specification.md) §9; certified card-present/card-not-present processing is delegated to gateway plugins that are themselves responsible for their own PCI scope) — this keeps the core platform out of PCI SAQ-D territory by design, not by accident.
- Regional tax/e-invoicing compliance (e.g. KSA ZATCA, UAE VAT e-invoicing) is handled by the E-Invoicing plugin per region rather than baked into core, since requirements vary by jurisdiction and change independently of the core release cycle.
- GDPR-style data subject rights (export/delete a customer's data) are supported via the Customer Management module's export function and a documented data-deletion procedure that respects financial-record retention requirements (you cannot delete a customer's invoice history if tax law requires retaining it — deletion requests anonymize the customer profile while preserving the financial record's integrity).
