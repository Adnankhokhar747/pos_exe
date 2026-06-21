import { ChildProcess, spawn } from 'node:child_process';
import path from 'node:path';
import { app } from 'electron';

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

  branchApiProcess = spawn(process.execPath, [entryPoint], {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      BRANCH_API_PORT: String(port),
      ELECTRON_RUN_AS_NODE: '1',
    },
    stdio: 'inherit',
  });

  branchApiProcess.on('exit', (code) => {
    // eslint-disable-next-line no-console
    console.error(`branch-api exited with code ${code}`);
  });
}

export function stopBranchApi(): void {
  branchApiProcess?.kill();
}
