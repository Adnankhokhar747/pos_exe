import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { startEmbeddedPostgres, stopEmbeddedPostgres, shouldManageOwnPostgres } from './postgres-lifecycle';
import { startBranchApi, stopBranchApi } from './branch-api-process';

const BRANCH_API_PORT = 4000;
const DEV_RENDERER_URL = 'http://localhost:5173';

let mainWindow: BrowserWindow | undefined;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (app.isPackaged) {
    await mainWindow.loadFile(path.join(process.resourcesPath, 'renderer', 'index.html'));
  } else {
    await mainWindow.loadURL(DEV_RENDERER_URL);
  }
}

async function bootstrap(): Promise<void> {
  let databaseUrl = process.env.DATABASE_URL;

  if (shouldManageOwnPostgres()) {
    databaseUrl = await startEmbeddedPostgres();
  }

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is not set. In development, run the branch-api dev DB script first (see apps/branch-api/scripts/dev-postgres.ts).',
    );
  }

  if (shouldManageOwnPostgres()) {
    // Packaged builds own the whole stack end to end, including their own API process.
    startBranchApi({ databaseUrl, port: BRANCH_API_PORT });
  }
  // In development, the Branch API is started separately via `pnpm dev` (turbo runs it
  // alongside the renderer) so it benefits from NestJS's own watch/hot-reload — see
  // docs/04-electron-architecture.md §1 for why dev and packaged builds differ here.

  await createWindow();
}

app.whenReady().then(bootstrap);

app.on('window-all-closed', () => {
  stopBranchApi();
  void stopEmbeddedPostgres();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});
