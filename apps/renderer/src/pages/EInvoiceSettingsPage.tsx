import { useState, useEffect } from 'react';
import {
  Alert,
  Box,
  Chip,
  Divider,
  FormControlLabel,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { EInvoiceSettings } from '../api/types';
import { PrimaryButton, SecondaryButton } from '../components/buttons';

const EMPTY = {
  isActive:      false,
  sellerNameAr:  '',
  sellerNameEn:  '',
  vatNumber:     '',
  crNumber:      '',
  buildingNumber:'',
  streetName:    '',
  district:      '',
  city:          '',
  postalCode:    '',
  countryCode:   'SA',
  vatRate:       '15.00',
  phase:         1,
};

type FormState = typeof EMPTY;

export function EInvoiceSettingsPage(): JSX.Element {
  const qc = useQueryClient();
  const [form, setForm]   = useState<FormState>(EMPTY);
  const [dirty, setDirty] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const { data: settings, isLoading } = useQuery<EInvoiceSettings>({
    queryKey: ['einvoice-settings'],
    queryFn: () => apiFetch('/api/v1/einvoice/settings'),
  });

  useEffect(() => {
    if (settings) {
      setForm({
        isActive:       settings.isActive      ?? false,
        sellerNameAr:   settings.sellerNameAr  ?? '',
        sellerNameEn:   settings.sellerNameEn  ?? '',
        vatNumber:      settings.vatNumber      ?? '',
        crNumber:       settings.crNumber       ?? '',
        buildingNumber: settings.buildingNumber ?? '',
        streetName:     settings.streetName     ?? '',
        district:       settings.district       ?? '',
        city:           settings.city           ?? '',
        postalCode:     settings.postalCode     ?? '',
        countryCode:    settings.countryCode    ?? 'SA',
        vatRate:        settings.vatRate        ?? '15.00',
        phase:          settings.phase          ?? 1,
      });
      setDirty(false);
    }
  }, [settings]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }

  const saveMutation = useMutation({
    mutationFn: () => apiFetch('/api/v1/einvoice/settings', {
      method: 'PATCH',
      body: JSON.stringify(form),
    }),
    onSuccess: () => {
      setSnackbar('E-Invoice settings saved.');
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['einvoice-settings'] });
    },
    onError: (e) => setSnackbar(e instanceof ApiError ? e.detail : 'Could not save settings.'),
  });

  const vatValid = !form.vatNumber || /^\d{15}$/.test(form.vatNumber);
  const countryCodeValid = !form.countryCode || form.countryCode.length === 2;

  if (isLoading) {
    return <Box p={2}><Typography color="text.secondary">Loading…</Typography></Box>;
  }

  return (
    <Box p={2} maxWidth={720}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
        <ReceiptLongIcon color="primary" />
        <Typography variant="h6">E-Invoice Settings</Typography>
        <Chip label="ZATCA Phase 1" size="small" color="info" variant="outlined" />
        {form.isActive && <Chip label="Active" size="small" color="success" icon={<CheckCircleIcon />} />}
      </Stack>

      <Stack spacing={3}>

        {/* ── Master activate toggle ───────────────────────────────── */}
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: form.isActive ? 'success.main' : 'divider' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography fontWeight={700}>Activate ZATCA E-Invoicing</Typography>
              <Typography variant="body2" color="text.secondary">
                {form.isActive
                  ? 'QR codes will be printed on every completed receipt.'
                  : 'Enable to start generating ZATCA-compliant QR codes on receipts.'}
              </Typography>
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={form.isActive}
                  onChange={(e) => set('isActive', e.target.checked)}
                  color="success"
                />
              }
              label={form.isActive ? 'ON' : 'OFF'}
              labelPlacement="start"
            />
          </Stack>
        </Paper>

        {!form.isActive && (
          <Alert severity="info">
            Configure your VAT details below, then toggle ON when ready. Receipts will continue to print normally until activated.
          </Alert>
        )}

        {/* ── Seller Identity ──────────────────────────────────────── */}
        <Box>
          <Typography variant="subtitle2" fontWeight={700} mb={1.5}>Seller Identity</Typography>
          <Stack spacing={2}>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Company Name (English)"
                value={form.sellerNameEn}
                onChange={(e) => set('sellerNameEn', e.target.value)}
                fullWidth
              />
              <TextField
                label="اسم الشركة (عربي)"
                value={form.sellerNameAr}
                onChange={(e) => set('sellerNameAr', e.target.value)}
                fullWidth
                inputProps={{ dir: 'rtl' }}
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="VAT Registration Number"
                value={form.vatNumber}
                onChange={(e) => set('vatNumber', e.target.value)}
                fullWidth
                error={!vatValid}
                helperText={vatValid ? '15 digits, starts & ends with 3 (required for ZATCA)' : 'Invalid — must be exactly 15 digits'}
                inputProps={{ maxLength: 15 }}
              />
              <TextField
                label="CR Number"
                value={form.crNumber}
                onChange={(e) => set('crNumber', e.target.value)}
                fullWidth
                helperText="Commercial Registration number"
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="VAT Rate (%)"
                type="number"
                value={form.vatRate}
                onChange={(e) => set('vatRate', e.target.value)}
                sx={{ width: 160 }}
                inputProps={{ min: 0, max: 100, step: 0.01 }}
                helperText="Standard rate is 15% in Saudi Arabia"
              />
              <TextField
                label="ZATCA Phase"
                select
                value={form.phase}
                onChange={(e) => set('phase', Number(e.target.value))}
                sx={{ width: 220 }}
                helperText="Phase 2 requires digital signatures"
              >
                <MenuItem value={1}>Phase 1 — QR Code only</MenuItem>
                <MenuItem value={2} disabled>Phase 2 — Clearance (coming soon)</MenuItem>
              </TextField>
            </Stack>
          </Stack>
        </Box>

        <Divider />

        {/* ── Business Address ─────────────────────────────────────── */}
        <Box>
          <Typography variant="subtitle2" fontWeight={700} mb={1.5}>Business Address</Typography>
          <Stack spacing={2}>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Building Number"
                value={form.buildingNumber}
                onChange={(e) => set('buildingNumber', e.target.value)}
                sx={{ width: 180 }}
                inputProps={{ maxLength: 20 }}
              />
              <TextField
                label="Street Name"
                value={form.streetName}
                onChange={(e) => set('streetName', e.target.value)}
                fullWidth
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="District / Neighborhood"
                value={form.district}
                onChange={(e) => set('district', e.target.value)}
                fullWidth
              />
              <TextField
                label="City"
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
                fullWidth
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Postal Code"
                value={form.postalCode}
                onChange={(e) => set('postalCode', e.target.value)}
                sx={{ width: 180 }}
                inputProps={{ maxLength: 10 }}
              />
              <TextField
                label="Country Code"
                value={form.countryCode}
                onChange={(e) => set('countryCode', e.target.value.toUpperCase())}
                sx={{ width: 160 }}
                inputProps={{ maxLength: 2 }}
                error={!countryCodeValid}
                helperText={countryCodeValid ? 'ISO 3166-1 (e.g. "SA")' : 'Must be exactly 2 letters (e.g. SA)'}
              />
            </Stack>
          </Stack>
        </Box>

        <Divider />

        {/* ── Save / Discard ───────────────────────────────────────── */}
        <Stack direction="row" spacing={1.5} alignItems="center">
          <PrimaryButton
            disabled={!dirty || saveMutation.isPending || !vatValid || !countryCodeValid}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save Settings'}
          </PrimaryButton>
          {dirty && (
            <SecondaryButton
              onClick={() => {
                if (settings) {
                  setForm({
                    isActive:       settings.isActive      ?? false,
                    sellerNameAr:   settings.sellerNameAr  ?? '',
                    sellerNameEn:   settings.sellerNameEn  ?? '',
                    vatNumber:      settings.vatNumber      ?? '',
                    crNumber:       settings.crNumber       ?? '',
                    buildingNumber: settings.buildingNumber ?? '',
                    streetName:     settings.streetName     ?? '',
                    district:       settings.district       ?? '',
                    city:           settings.city           ?? '',
                    postalCode:     settings.postalCode     ?? '',
                    countryCode:    settings.countryCode    ?? 'SA',
                    vatRate:        settings.vatRate        ?? '15.00',
                    phase:          settings.phase          ?? 1,
                  });
                  setDirty(false);
                }
              }}
            >
              Discard
            </SecondaryButton>
          )}
          {!dirty && form.isActive && (
            <Typography variant="body2" color="success.main" fontWeight={600}>
              ✓ ZATCA e-invoicing is active
            </Typography>
          )}
        </Stack>
      </Stack>

      <Snackbar open={Boolean(snackbar)} autoHideDuration={3500} onClose={() => setSnackbar(null)} message={snackbar} />
    </Box>
  );
}
