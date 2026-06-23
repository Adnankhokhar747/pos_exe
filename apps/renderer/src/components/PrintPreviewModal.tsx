import { useEffect, useState } from 'react';
import { MenuItem, Stack, TextField, Typography } from '@mui/material';
import { AppModal } from './AppModal';
import { PrimaryButton, SecondaryButton } from './buttons';

interface PrintPreviewModalProps {
  open: boolean;
  title: string;
  html: string;
  onClose: () => void;
}

export function PrintPreviewModal({ open, title, html, onClose }: PrintPreviewModalProps): JSX.Element {
  const [printers, setPrinters] = useState<VantagePrinterInfo[]>([]);
  const [printerName, setPrinterName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPrinters([]);
    setPrinterName('');
    if (!window.vantage) {
      setError('Printing is only available in the desktop app.');
      return;
    }
    window.vantage.printing
      .listPrinters()
      .then((list) => {
        setPrinters(list);
        const defaultPrinter = list.find((p) => p.isDefault) ?? list[0];
        setPrinterName(defaultPrinter?.name ?? '');
      })
      .catch(() => setError('Could not load printers.'));
  }, [open]);

  async function handlePrint(): Promise<void> {
    if (!window.vantage) {
      setError('Printing is only available in the desktop app.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await window.vantage.printing.printHtml(html, { printerName, silent: true });
      onClose();
    } catch {
      setError('Print failed. Check the printer and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSavePdf(): Promise<void> {
    if (!window.vantage) {
      setError('Printing is only available in the desktop app.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await window.vantage.printing.printToPdf(html);
      if (result.saved) onClose();
    } catch {
      setError('Could not save PDF.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title={title}
      maxWidth="sm"
      fullWidth
      actions={
        <>
          <SecondaryButton onClick={onClose}>Close</SecondaryButton>
          <SecondaryButton disabled={busy} onClick={handleSavePdf}>
            Save as PDF
          </SecondaryButton>
          <PrimaryButton disabled={busy || !printerName} onClick={handlePrint}>
            Print
          </PrimaryButton>
        </>
      }
    >
      <Stack spacing={2}>
        {error && <Typography color="error">{error}</Typography>}
        <TextField
          select
          label="Printer"
          value={printerName}
          onChange={(e) => setPrinterName(e.target.value)}
          disabled={printers.length === 0}
        >
          {printers.length === 0 && <MenuItem value="">No printers found</MenuItem>}
          {printers.map((printer) => (
            <MenuItem key={printer.name} value={printer.name}>
              {printer.displayName || printer.name}
            </MenuItem>
          ))}
        </TextField>
        <iframe
          title="print-preview"
          srcDoc={html}
          style={{ width: '100%', height: 480, border: '1px solid #ddd', background: '#fff' }}
        />
      </Stack>
    </AppModal>
  );
}
