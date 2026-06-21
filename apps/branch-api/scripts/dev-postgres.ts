/// <reference path="./embedded-postgres.d.ts" />
import fs from 'node:fs';
import path from 'node:path';

// Local-dev convenience: boots the same embedded Postgres distribution the
// packaged app uses (docs/04-electron-architecture.md §2), so `pnpm dev`
// doesn't require a developer to install/manage Postgres themselves.
// Usage: `ts-node scripts/dev-postgres.ts start|stop`
//
// embedded-postgres ships ESM-only (package.json "type": "module", no CJS
// entry point) but this script compiles to CommonJS via ts-node, so it's
// loaded with a dynamic import() rather than a static import — see
// ./embedded-postgres.d.ts for why the ambient typing is needed too.

const PG_PORT = 55432;
const PG_USER = 'vantage';
const PG_PASSWORD = 'vantage';
const PG_DATABASE = 'vantage_branch';
const DATA_DIR = path.join(__dirname, '..', '.pgdata');

async function createInstance() {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  return new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: PG_USER,
    password: PG_PASSWORD,
    port: PG_PORT,
    persistent: true,
  });
}

function isDataDirInitialised(): boolean {
  return fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'));
}

async function start(): Promise<void> {
  const pg = await createInstance();
  if (!isDataDirInitialised()) {
    await pg.initialise();
  }
  await pg.start();
  await pg.createDatabase(PG_DATABASE).catch(() => undefined);
  // eslint-disable-next-line no-console
  console.log(
    `Embedded Postgres ready at postgresql://${PG_USER}:${PG_PASSWORD}@127.0.0.1:${PG_PORT}/${PG_DATABASE}`,
  );
}

async function stop(): Promise<void> {
  const pg = await createInstance();
  await pg.stop();
  // eslint-disable-next-line no-console
  console.log('Embedded Postgres stopped.');
}

const command = process.argv[2];
if (command === 'start') void start();
else if (command === 'stop') void stop();
else {
  // eslint-disable-next-line no-console
  console.error('Usage: ts-node scripts/dev-postgres.ts start|stop');
  process.exit(1);
}
