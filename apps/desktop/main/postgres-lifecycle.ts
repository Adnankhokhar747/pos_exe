/// <reference path="./embedded-postgres.d.ts" />
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { describeError, log } from './logger';

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

// TypeScript compiles this file to CommonJS (per apps/desktop/tsconfig.json), and with
// `module: "CommonJS"` it downlevels a plain `await import(...)` into a `require()`-based
// shim — which throws ERR_REQUIRE_ESM here since embedded-postgres ships ESM-only. Routing
// the specifier through `new Function` hides the call from TypeScript's static downleveling
// so Node executes a genuine dynamic `import()` at runtime instead (the standard workaround
// for this exact CJS-importing-ESM case — see microsoft/TypeScript#43329).
const importEsm = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<typeof import('embedded-postgres')>;

export async function startEmbeddedPostgres(): Promise<string> {
  const databaseDir = dataDir();
  log(`[postgres] app data dir: ${app.getPath('appData')}`);
  log(`[postgres] database dir: ${databaseDir}`);

  let EmbeddedPostgres: typeof import('embedded-postgres').default;
  try {
    ({ default: EmbeddedPostgres } = await importEsm('embedded-postgres'));
  } catch (error) {
    log(`[postgres] FAILED to import the embedded-postgres module: ${describeError(error)}`);
    throw error;
  }

  instance = new EmbeddedPostgres({
    databaseDir,
    user: PG_USER,
    password: PG_PASSWORD,
    port: PG_PORT,
    persistent: true,
  });

  const isFreshDataDir = !fs.existsSync(path.join(databaseDir, 'PG_VERSION'));
  log(`[postgres] fresh data dir: ${isFreshDataDir}`);

  if (isFreshDataDir) {
    try {
      log('[postgres] running initialise()...');
      await instance.initialise();
      log('[postgres] initialise() completed');
    } catch (error) {
      log(`[postgres] FAILED during initialise(): ${describeError(error)}`);
      throw error;
    }
  }

  try {
    log('[postgres] running start()...');
    await instance.start();
    log('[postgres] start() completed');
  } catch (error) {
    log(`[postgres] FAILED during start(): ${describeError(error)}`);
    throw error;
  }

  await instance.createDatabase(PG_DATABASE).catch((error) => {
    // Database already exists from a prior run — expected on every launch after the first.
    // Still worth a line: this is the one failure here that's expected to happen routinely.
    log(`[postgres] createDatabase() rejected (usually just "already exists"): ${describeError(error)}`);
  });

  log('[postgres] embedded Postgres is up');
  return buildDatabaseUrl();
}

export async function stopEmbeddedPostgres(): Promise<void> {
  await instance?.stop();
}
