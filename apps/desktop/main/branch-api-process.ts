import { ChildProcess, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { log } from './logger';

// Runs the Branch API (NestJS) as a child process of the Electron main
// process, per docs/04-electron-architecture.md §1 — chosen over an
// in-process Nest bootstrap for v1 because it gives us process isolation
// (a Branch API crash doesn't take the renderer with it) and a simple,
// debuggable restart path, at the cost of one extra process per device.
let branchApiProcess: ChildProcess | undefined;

export interface BranchApiStartOptions {
  databaseUrl: string;
  port: number;
}

export function startBranchApi({ databaseUrl, port }: BranchApiStartOptions): void {
  const entryPoint = app.isPackaged
    ? path.join(process.resourcesPath, 'branch-api', 'main.js')
    : path.join(__dirname, '..', '..', '..', 'branch-api', 'dist', 'main.js');

  // `stdio: 'inherit'` just points at this process's own stdout/stderr, which for a
  // packaged, double-clicked .exe are closed/invalid handles — every route-mapping
  // log line, every crash stack trace from the Nest app, was going nowhere. Redirect
  // to a real file instead so a failed launch leaves something to actually debug from.
  const logDir = path.join(app.getPath('appData'), 'VantagePOS', 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  const branchApiLogPath = path.join(logDir, 'branch-api.log');
  // spawn()'s stdio array needs an already-open fd — a fresh fs.createWriteStream()
  // opens asynchronously, so passing the Stream object directly races its own 'open'
  // event and spawn() rejects it ("failed to spawn"/ERR_INVALID_HANDLE). Opening
  // synchronously up front sidesteps that entirely.
  const logFd = fs.openSync(branchApiLogPath, 'a');
  log(`[branch-api] entry point: ${entryPoint}`);
  log(`[branch-api] log file: ${branchApiLogPath}`);

  branchApiProcess = spawn(process.execPath, [entryPoint], {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      BRANCH_API_PORT: String(port),
      ELECTRON_RUN_AS_NODE: '1',
      // The embedded Postgres this spawns against starts empty on a fresh
      // install — there's no separate installer step to run migrations/seed
      // by hand, so main.ts applies both itself when this is set (packaged
      // builds only; a dev `pnpm dev` run manages its own DB directly).
      BRANCH_API_AUTO_MIGRATE: '1',
    },
    stdio: ['ignore', logFd, logFd],
  });
  branchApiProcess.on('exit', () => fs.closeSync(logFd));

  branchApiProcess.on('exit', (code) => {
    log(`[branch-api] exited with code ${code}`);
  });
  branchApiProcess.on('error', (error) => {
    log(`[branch-api] failed to spawn: ${error.stack ?? error.message}`);
  });
}

export function stopBranchApi(): void {
  branchApiProcess?.kill();
}
