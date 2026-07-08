import { createHash, randomUUID } from 'crypto';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { Client } from 'pg';

// Applies prisma/migrations/*/migration.sql directly against Postgres, bypassing
// the Prisma CLI (which needs its own migration-engine binary we'd otherwise
// have to bundle separately). Bookkeeping is written into a `_prisma_migrations`
// table matching Prisma's own schema/checksum format exactly, so a developer who
// later points the real `prisma migrate deploy` at this same database sees every
// migration already applied instead of re-running or erroring on drift.
//
// Only used for the packaged desktop build against its embedded, single-tenant
// Postgres instance — gated by BRANCH_API_AUTO_MIGRATE so normal dev (`nest start
// --watch`, which already runs `prisma migrate deploy` by hand) is unaffected.
export async function applyPendingMigrations(databaseUrl: string, migrationsDir: string): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" VARCHAR(36) NOT NULL PRIMARY KEY,
        "checksum" VARCHAR(64) NOT NULL,
        "finished_at" TIMESTAMPTZ,
        "migration_name" VARCHAR(255) NOT NULL,
        "logs" TEXT,
        "rolled_back_at" TIMESTAMPTZ,
        "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0
      );
    `);

    const { rows: applied } = await client.query(
      'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL',
    );
    const appliedNames = new Set(applied.map((row) => row.migration_name as string));

    const migrationFolders = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    for (const folder of migrationFolders) {
      if (appliedNames.has(folder)) continue;

      const sql = readFileSync(path.join(migrationsDir, folder, 'migration.sql'), 'utf-8');
      const checksum = createHash('sha256').update(sql).digest('hex');

      // eslint-disable-next-line no-console
      console.log(`[migrate] applying ${folder}`);
      await client.query(sql);
      await client.query(
        `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
         VALUES ($1, $2, now(), $3, now(), 1)`,
        [randomUUID(), checksum, folder],
      );
    }
  } finally {
    await client.end();
  }
}
