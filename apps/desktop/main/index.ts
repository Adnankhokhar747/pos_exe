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
  // In development, the Branch API and its DB connection are owned by a
  // separately-run `pnpm dev` process (see docs/04-electron-architecture.md
  // §1), so Electron's main process has nothing to start or wait on here —
  // it only needs to manage its own embedded Postgres + API process once
  // packaged.
  if (shouldManageOwnPostgres()) {
    const databaseUrl = await startEmbeddedPostgres();
    startBranchApi({ databaseUrl, port: BRANCH_API_PORT });
  }

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
