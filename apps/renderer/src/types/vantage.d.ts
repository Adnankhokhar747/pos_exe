interface VantagePrinterInfo {
  name: string;
  displayName: string;
  description: string;
  status: number;
  isDefault: boolean;
}

interface VantagePrintHtmlOptions {
  printerName?: string;
  silent?: boolean;
  copies?: number;
}

interface VantagePrintToPdfResult {
  saved: boolean;
  filePath?: string;
}

interface VantagePrinting {
  listPrinters: () => Promise<VantagePrinterInfo[]>;
  printHtml: (html: string, options?: VantagePrintHtmlOptions) => Promise<void>;
  printToPdf: (html: string) => Promise<VantagePrintToPdfResult>;
}

interface VantageUpdateInfo {
  version: string;
  releaseNotes?: string | null;
}

interface VantageUpdater {
  onAvailable: (cb: (info: VantageUpdateInfo) => void) => void;
  onDownloaded: (cb: (info: VantageUpdateInfo) => void) => void;
  installNow: () => Promise<void>;
}

interface Vantage {
  appVersion: string;
  printing: VantagePrinting;
  updater: VantageUpdater;
}

interface Window {
  vantage?: Vantage;
}
