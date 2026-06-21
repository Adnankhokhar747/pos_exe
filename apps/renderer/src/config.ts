// Phase 0/1 simplification: a device is bound to exactly one branch/warehouse
// (docs/00-functional-specification.md §2), so these come from local device
// config rather than a server round-trip. Wired to the seed data for now;
// Phase 2+ replaces this with the device's actual registration record.
export const ACTIVE_BRANCH_ID = import.meta.env.VITE_BRANCH_ID ?? '00000000-0000-0000-0000-000000000002';
export const ACTIVE_WAREHOUSE_ID = import.meta.env.VITE_WAREHOUSE_ID ?? '00000000-0000-0000-0000-000000000010';
