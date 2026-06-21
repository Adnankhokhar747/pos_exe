/// <reference path="./embedded-postgres.d.ts" />
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

// Owns the embedded Postgres process for packaged builds, per
// docs/04-electron-architecture.md §2. In development, a developer-run
// Postgres (see apps/branch-api's dev DB script) is used instead — see
// shouldManageOwnPostgres() below.
//
// embedded-postgres ships ESM-only (package.json "type": "module", no CJS
// entry point) but the Electron main process here compiles to CommonJS, so
// it's loaded with a dynamic import() rather than a static import — see
// ./embedded-postgres.d.ts for why the ambient typing is needed too.

const PG_PORT = 55432;
const PG_USER = 'vantage';
const PG_PASSWORD = 'vantage';
const PG_DATABASE = 'vantage_branch';

let instance: import('embedded-postgres').default | undefined;

export function shouldManageOwnPostgres(): boolean {
  return app.isPackaged;
}

export function buildDatabaseUrl(): string {
  return `postgresql://${PG_USER}:${PG_PASSWORD}@127.0.0.1:${PG_PORT}/${PG_DATABASE}?schema=public`;
}

function dataDir(): string {
  return path.join(app.getPath('appData'), 'VantagePOS', 'pgdata');
}

export async function startEmbeddedPostgres(): Promise<string> {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const databaseDir = dataDir();

  instance = new EmbeddedPostgres({
    databaseDir,
    user: PG_USER,
    password: PG_PASSWORD,
    port: PG_PORT,
    persistent: true,
  });

  const isFreshDataDir = !fs.existsSync(path.join(databaseDir, 'PG_VERSION'));
  if (isFreshDataDir) {
    await instance.initialise();
  }
  await instance.start();
  await instance.createDatabase(PG_DATABASE).catch(() => {
    // Database already exists from a prior run — expected on every launch after the first.
  });

  return buildDatabaseUrl();
}

export async function stopEmbeddedPostgres(): Promise<void> {
  await instance?.stop();
}
