import { contextBridge, ipcRenderer } from 'electron';

// Narrow, typed bridge exposed to the renderer as `window.vantage.*` — per
// docs/04-electron-architecture.md §1, the renderer never gets direct Node/fs
// access. Native-only concerns (printing, barcode scanner events, update
// prompts) get their own exposed methods here as those modules are built.
contextBridge.exposeInMainWorld('vantage', {
  appVersion: process.env.npm_package_version ?? 'dev',
  printing: {
    listPrinters: () => ipcRenderer.invoke('printing:list-printers'),
    printHtml: (html: string, options?: { printerName?: string; silent?: boolean; copies?: number }) =>
      ipcRenderer.invoke('printing:print-html', html, options),
    printToPdf: (html: string) => ipcRenderer.invoke('printing:print-to-pdf', html),
  },
});
