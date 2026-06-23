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

interface Vantage {
  appVersion: string;
  printing: VantagePrinting;
}

interface Window {
  vantage?: Vantage;
}
