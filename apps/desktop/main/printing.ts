import { BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'node:fs/promises';

// All printing goes through Electron's OS-print-driver APIs (webContents.print /
// printToPDF / getPrintersAsync) rather than raw ESC/POS byte streams — see
// docs/04-electron-architecture.md §3. This means no cash-drawer-kick support
// (no raw-byte surface here); that is a deferred, explicitly-flagged limitation.

export interface PrintHtmlOptions {
  printerName?: string;
  silent?: boolean;
  copies?: number;
}

function createHiddenPrintWindow(): BrowserWindow {
  return new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
}

async function loadHtmlIntoWindow(win: BrowserWindow, html: string): Promise<void> {
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

export function registerPrintingIpcHandlers(): void {
  ipcMain.handle('printing:list-printers', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    if (!win) return [];
    return win.webContents.getPrintersAsync();
  });

  ipcMain.handle('printing:print-html', async (_event, html: string, options: PrintHtmlOptions = {}) => {
    const win = createHiddenPrintWindow();
    try {
      await loadHtmlIntoWindow(win, html);
      await new Promise<void>((resolve, reject) => {
        win.webContents.print(
          {
            silent: options.silent ?? true,
            deviceName: options.printerName,
            copies: options.copies ?? 1,
          },
          (success, failureReason) => {
            if (success) resolve();
            else reject(new Error(failureReason || 'Print failed.'));
          },
        );
      });
    } finally {
      win.destroy();
    }
  });

  ipcMain.handle('printing:print-to-pdf', async (_event, html: string) => {
    const win = createHiddenPrintWindow();
    try {
      await loadHtmlIntoWindow(win, html);
      const pdfBuffer = await win.webContents.printToPDF({ pageSize: 'A4', printBackground: true });

      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Save Invoice as PDF',
        defaultPath: `invoice-${Date.now()}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      if (canceled || !filePath) return { saved: false };

      await fs.writeFile(filePath, pdfBuffer);
      return { saved: true, filePath };
    } finally {
      win.destroy();
    }
  });
}
