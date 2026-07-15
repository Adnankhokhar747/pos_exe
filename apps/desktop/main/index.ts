import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, net, Notification, protocol } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { autoUpdater } from 'electron-updater';
import { startEmbeddedPostgres, stopEmbeddedPostgres, shouldManageOwnPostgres } from './postgres-lifecycle';
import { startBranchApi, stopBranchApi } from './branch-api-process';
import { registerPrintingIpcHandlers } from './printing';
import { describeError, getLogFilePath, log } from './logger';

const BRANCH_API_PORT = 4000;
const DEV_RENDERER_URL = 'http://localhost:5173';
const DEV_ADMIN_PORTAL_URL = 'http://localhost:5174';
const APP_SCHEME = 'app';
const ADMIN_SCHEME = 'adminportal';
const ADMIN_PORTAL_SHORTCUT = 'CommandOrControl+Shift+A';
const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // every 4 hours

// Chromium's module-script loader (both the POS renderer and the admin portal
// ship `<script type="module" crossorigin>`) enforces CORS-style rules that a
// raw `file://` origin can't satisfy, so the script silently fails to execute
// — the page loads (title bar shows the static <title> tag) but nothing ever
// renders, no console error either. Registering privileged/standard custom
// schemes and serving the built assets through them (rather than `loadFile`)
// gives each a real origin that module scripts, fetch, and eventually a CSP
// can all treat normally.
protocol.registerSchemesAsPrivileged([
  { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
  { scheme: ADMIN_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

let mainWindow: BrowserWindow | undefined;
let adminPortalWindow: BrowserWindow | undefined;

function registerStaticProtocol(scheme: string, resourceFolderName: string): void {
  const root = path.join(process.resourcesPath, resourceFolderName);
  protocol.handle(scheme, (request) => {
    const requestUrl = new URL(request.url);
    // app://index.html -> resources/<folder>/index.html; app://assets/x.js -> resources/<folder>/assets/x.js
    const relativePath = decodeURIComponent(requestUrl.pathname || requestUrl.hostname || 'index.html');
    const filePath = path.join(root, relativePath === '/' ? 'index.html' : relativePath);
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

// Opens (or focuses, if already open) the platform admin portal — where a
// Super Admin enables/disables modules like Hospital/Doctor per company. Not
// something a cashier at the till should stumble into via a menu, so it's
// reached only via a keyboard shortcut rather than any visible UI element.
function openAdminPortalWindow(): void {
  if (adminPortalWindow && !adminPortalWindow.isDestroyed()) {
    adminPortalWindow.focus();
    return;
  }

  adminPortalWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Vantage POS — Platform Admin',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  adminPortalWindow.on('closed', () => {
    adminPortalWindow = undefined;
  });
  adminPortalWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    log(`[admin-portal] failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
  });

  const url = app.isPackaged ? `${ADMIN_SCHEME}://index.html` : DEV_ADMIN_PORTAL_URL;
  void adminPortalWindow.loadURL(url);
}

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

  // Real (if rare) failure modes for a field-deployed terminal — a corrupted
  // resources/renderer install, a GPU/driver crash — worth a line in the log
  // a support call can ask for, rather than a silently blank window.
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    log(`[renderer] failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log(`[renderer] process gone: ${JSON.stringify(details)}`);
  });

  if (app.isPackaged) {
    await mainWindow.loadURL(`${APP_SCHEME}://index.html`);
  } else {
    await mainWindow.loadURL(DEV_RENDERER_URL);
  }
}

function setupAutoUpdater(): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    log(`[updater] update available: ${info.version}`);
    mainWindow?.webContents.send('update:available', { version: info.version, releaseNotes: info.releaseNotes ?? null });
  });

  autoUpdater.on('update-downloaded', (info) => {
    log(`[updater] update downloaded: ${info.version}`);
    mainWindow?.webContents.send('update:downloaded', { version: info.version, releaseNotes: info.releaseNotes ?? null });
  });

  autoUpdater.on('error', (err) => {
    log(`[updater] error: ${err.message}`);
  });

  const checkSafely = (): void => {
    autoUpdater.checkForUpdates().catch((err: unknown) => {
      log(`[updater] check failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  };

  checkSafely();
  setInterval(checkSafely, UPDATE_CHECK_INTERVAL_MS);
}

function registerUpdaterIpcHandlers(): void {
  ipcMain.handle('update:install-now', () => {
    autoUpdater.quitAndInstall(false, true);
  });
}

function registerNotificationIpcHandlers(): void {
  ipcMain.handle('notification:show', (_evt, title: string, body: string) => {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
  });
}

async function bootstrap(): Promise<void> {
  // A cash-register terminal has no business exposing Reload/DevTools/Zoom to
  // whoever is standing at the till — Electron's default menu is a developer
  // convenience, not something to ship. Dev mode keeps it (DevTools access is
  // genuinely useful while building); packaged builds get none.
  if (app.isPackaged) Menu.setApplicationMenu(null);

  // In development, the Branch API and its DB connection are owned by a
  // separately-run `pnpm dev` process (see docs/04-electron-architecture.md
  // §1), so Electron's main process has nothing to start or wait on here —
  // it only needs to manage its own embedded Postgres + API process once
  // packaged.
  //
  // This is wrapped rather than left to propagate: startEmbeddedPostgres can
  // genuinely fail on a machine this hasn't been tested on (missing VC++
  // runtime, antivirus quarantining the unsigned native binaries, a port
  // already in use) and an uncaught rejection here used to mean bootstrap()
  // never reached createWindow() at all — install succeeds, launch does
  // nothing, no error, no window, nothing to even screenshot. The window
  // must always appear; a startup failure should be a visible dialog telling
  // the operator (or a support call) what broke, not silence.
  if (app.isPackaged) {
    registerStaticProtocol(APP_SCHEME, 'renderer');
    registerStaticProtocol(ADMIN_SCHEME, 'admin-portal');
  }

  let startupErrorDetail: string | undefined;
  if (shouldManageOwnPostgres()) {
    try {
      const databaseUrl = await startEmbeddedPostgres();
      startBranchApi({ databaseUrl, port: BRANCH_API_PORT });
    } catch (error) {
      startupErrorDetail = describeError(error);
      log(`[bootstrap] failed to start embedded Postgres / Branch API: ${startupErrorDetail}`);
    }
  }

  // Not on the visible menu (there isn't one) — a Super Admin who knows the
  // shortcut opens this to toggle per-company modules; per docs/06-plugin
  // -architecture.md this is platform-operator territory, not a cashier-facing
  // feature, so keeping it a keyboard shortcut rather than a UI affordance is
  // deliberate, not an oversight.
  globalShortcut.register(ADMIN_PORTAL_SHORTCUT, openAdminPortalWindow);

  registerPrintingIpcHandlers();
  registerUpdaterIpcHandlers();
  registerNotificationIpcHandlers();
  await createWindow();

  if (app.isPackaged) {
    setupAutoUpdater();
  }

  if (startupErrorDetail) {
    dialog.showErrorBox(
      'Vantage POS — local server failed to start',
      `The app window opened, but the local database/server could not start, so nothing will load.\n\n` +
        `Common causes: missing Visual C++ Redistributable, antivirus blocking the app's files, or another program already using port ${BRANCH_API_PORT}.\n\n` +
        `Full details were written to:\n${getLogFilePath()}\n\nPlease share that file with support.\n\n---\n${startupErrorDetail}`,
    );
  }
}

app.whenReady().then(bootstrap).catch((error: unknown) => {
  // Last-resort net: anything that escapes the try/catch above (e.g. the
  // window itself failing to create) still gets shown, not swallowed.
  const detail = describeError(error);
  log(`[bootstrap] fatal error: ${detail}`);
  dialog.showErrorBox('Vantage POS failed to start', `${detail}\n\nLog file: ${getLogFilePath()}`);
  app.quit();
});

process.on('uncaughtException', (error) => {
  log(`[main] uncaught exception: ${describeError(error)}`);
  dialog.showErrorBox(
    'Vantage POS encountered an unexpected error',
    `${describeError(error)}\n\nLog file: ${getLogFilePath()}`,
  );
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  stopBranchApi();
  void stopEmbeddedPostgres();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});
