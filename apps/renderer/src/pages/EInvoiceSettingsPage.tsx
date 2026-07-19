import { useState, useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControlLabel,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import ReceiptLongIcon   from '@mui/icons-material/ReceiptLong';
import CheckCircleIcon   from '@mui/icons-material/CheckCircle';
import LockIcon          from '@mui/icons-material/Lock';
import KeyIcon           from '@mui/icons-material/Key';
import CloudUploadIcon   from '@mui/icons-material/CloudUpload';
import VerifiedUserIcon  from '@mui/icons-material/VerifiedUser';
import RocketLaunchIcon  from '@mui/icons-material/RocketLaunch';
import ContentCopyIcon   from '@mui/icons-material/ContentCopy';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { EInvoiceSettings } from '../api/types';
import { PrimaryButton, SecondaryButton } from '../components/buttons';

// ── Types ────────────────────────────────────────────────────────────────────

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
  phase:         1 as 1 | 2,
  zatcaEnv:      'sandbox' as 'sandbox' | 'production',
};

type FormState = typeof EMPTY;

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  none:                'Not started',
  key_generated:       'Key generated — awaiting OTP',
  compliance_pending:  'OTP submitted — awaiting compliance check',
  compliance_done:     'Compliance passed — ready to activate',
  production_live:     'Live',
};

const STATUS_COLOR: Record<string, 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  none:               'default',
  key_generated:      'warning',
  compliance_pending: 'info',
  compliance_done:    'info',
  production_live:    'success',
};

// ── Main component ────────────────────────────────────────────────────────────

export function EInvoiceSettingsPage(): JSX.Element {
  const qc = useQueryClient();
  const [tab, setTab]     = useState(0);
  const [form, setForm]   = useState<FormState>(EMPTY);
  const [dirty, setDirty] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [csrCopied, setCsrCopied] = useState(false);
  const [complianceResults, setComplianceResults] = useState<{ invoice: number; status: number }[]>([]);

  const { data: settings, isLoading } = useQuery<EInvoiceSettings>({
    queryKey: ['einvoice-settings'],
    queryFn:  () => apiFetch('/api/v1/einvoice/settings'),
    refetchInterval: tab === 1 ? 10_000 : false,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        isActive:       settings.isActive       ?? false,
        sellerNameAr:   settings.sellerNameAr   ?? '',
        sellerNameEn:   settings.sellerNameEn   ?? '',
        vatNumber:      settings.vatNumber       ?? '',
        crNumber:       settings.crNumber        ?? '',
        buildingNumber: settings.buildingNumber  ?? '',
        streetName:     settings.streetName      ?? '',
        district:       settings.district        ?? '',
        city:           settings.city            ?? '',
        postalCode:     settings.postalCode      ?? '',
        countryCode:    settings.countryCode     ?? 'SA',
        vatRate:        settings.vatRate         ?? '15.00',
        phase:          (settings.phase ?? 1)   as 1 | 2,
        zatcaEnv:       settings.zatcaEnv        ?? 'sandbox',
      });
      setDirty(false);
    }
  }, [settings]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }

  // ── Save settings mutation ────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: () => apiFetch('/api/v1/einvoice/settings', {
      method: 'PATCH',
      body: JSON.stringify(form),
    }),
    onSuccess: () => {
      setSnackbar('Settings saved.');
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['einvoice-settings'] });
    },
    onError: (e) => setSnackbar(e instanceof ApiError ? e.detail : 'Could not save settings.'),
  });

  // ── Onboarding mutations ──────────────────────────────────────────────────

  const generateKeyMutation = useMutation({
    mutationFn: () => apiFetch<{ csr: string; message: string }>('/api/v1/einvoice/onboarding/generate-key', { method: 'POST', body: '{}' }),
    onSuccess:  (r) => { setSnackbar(r.message); qc.invalidateQueries({ queryKey: ['einvoice-settings'] }); },
    onError:    (e) => setSnackbar(e instanceof ApiError ? e.detail : 'Key generation failed.'),
  });

  const submitOtpMutation = useMutation({
    mutationFn: () => apiFetch<{ message: string }>('/api/v1/einvoice/onboarding/submit-otp', {
      method: 'POST', body: JSON.stringify({ otp: otpInput }),
    }),
    onSuccess:  (r) => { setSnackbar(r.message); setOtpInput(''); qc.invalidateQueries({ queryKey: ['einvoice-settings'] }); },
    onError:    (e) => setSnackbar(e instanceof ApiError ? e.detail : 'OTP submission failed.'),
  });

  const complianceMutation = useMutation({
    mutationFn: () => apiFetch<{ message: string; results: { invoice: number; status: number }[] }>(
      '/api/v1/einvoice/onboarding/compliance', { method: 'POST', body: '{}' }
    ),
    onSuccess: (r) => {
      setSnackbar(r.message);
      setComplianceResults(r.results ?? []);
      qc.invalidateQueries({ queryKey: ['einvoice-settings'] });
    },
    onError: (e) => setSnackbar(e instanceof ApiError ? e.detail : 'Compliance check failed.'),
  });

  const activateMutation = useMutation({
    mutationFn: () => apiFetch<{ message: string }>('/api/v1/einvoice/onboarding/activate', { method: 'POST', body: '{}' }),
    onSuccess:  (r) => { setSnackbar(r.message); qc.invalidateQueries({ queryKey: ['einvoice-settings'] }); },
    onError:    (e) => setSnackbar(e instanceof ApiError ? e.detail : 'Activation failed.'),
  });

  // ── Derived state ─────────────────────────────────────────────────────────

  const vatValid         = !form.vatNumber || /^\d{15}$/.test(form.vatNumber);
  const countryCodeValid = !form.countryCode || form.countryCode.length === 2;
  const onboarding       = settings?.onboardingStatus ?? 'none';
  const isLive           = onboarding === 'production_live';

  if (isLoading) {
    return <Box p={2}><Typography color="text.secondary">Loading…</Typography></Box>;
  }

  return (
    <Box p={2} maxWidth={760}>

      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
        <ReceiptLongIcon color="primary" />
        <Typography variant="h6">E-Invoice Settings</Typography>
        <Chip label="ZATCA" size="small" color="info" variant="outlined" />
        {form.isActive && <Chip label="Active" size="small" color="success" icon={<CheckCircleIcon />} />}
        {isLive && <Chip label="Phase 2 Live" size="small" color="success" icon={<VerifiedUserIcon />} />}
      </Stack>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Phase 1 — Settings" />
        <Tab label="Phase 2 — Onboarding" icon={<LockIcon fontSize="small" />} iconPosition="start" />
      </Tabs>

      {/* ── TAB 0: Settings ─────────────────────────────────────────────── */}
      {tab === 0 && (
        <Stack spacing={3}>

          {/* Activate toggle */}
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
                control={<Switch checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} color="success" />}
                label={form.isActive ? 'ON' : 'OFF'}
                labelPlacement="start"
              />
            </Stack>
          </Paper>

          {!form.isActive && (
            <Alert severity="info">
              Configure your VAT details below, then toggle ON when ready. Receipts will continue printing normally until activated.
            </Alert>
          )}

          {/* Seller identity */}
          <Box>
            <Typography variant="subtitle2" fontWeight={700} mb={1.5}>Seller Identity</Typography>
            <Stack spacing={2}>
              <Stack direction="row" spacing={2}>
                <TextField label="Company Name (English)" value={form.sellerNameEn} onChange={(e) => set('sellerNameEn', e.target.value)} fullWidth />
                <TextField label="اسم الشركة (عربي)" value={form.sellerNameAr} onChange={(e) => set('sellerNameAr', e.target.value)} fullWidth inputProps={{ dir: 'rtl' }} />
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="VAT Registration Number" value={form.vatNumber}
                  onChange={(e) => set('vatNumber', e.target.value)} fullWidth
                  error={!vatValid} inputProps={{ maxLength: 15 }}
                  helperText={vatValid ? '15 digits (required for ZATCA)' : 'Must be exactly 15 digits'}
                />
                <TextField label="CR Number" value={form.crNumber} onChange={(e) => set('crNumber', e.target.value)} fullWidth helperText="Commercial Registration number" />
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField label="VAT Rate (%)" type="number" value={form.vatRate} onChange={(e) => set('vatRate', e.target.value)} sx={{ width: 150 }} inputProps={{ min: 0, max: 100, step: 0.01 }} helperText="Standard: 15%" />
                <TextField label="ZATCA Phase" select value={form.phase} onChange={(e) => set('phase', Number(e.target.value) as 1 | 2)} sx={{ width: 230 }} helperText="Phase 2 requires onboarding (see Phase 2 tab)">
                  <MenuItem value={1}>Phase 1 — QR Code only</MenuItem>
                  <MenuItem value={2}>Phase 2 — Signed XML + API</MenuItem>
                </TextField>
                <TextField label="Environment" select value={form.zatcaEnv} onChange={(e) => set('zatcaEnv', e.target.value as 'sandbox' | 'production')} sx={{ width: 160 }}>
                  <MenuItem value="sandbox">Sandbox</MenuItem>
                  <MenuItem value="production">Production</MenuItem>
                </TextField>
              </Stack>
            </Stack>
          </Box>

          <Divider />

          {/* Business address */}
          <Box>
            <Typography variant="subtitle2" fontWeight={700} mb={1.5}>Business Address</Typography>
            <Stack spacing={2}>
              <Stack direction="row" spacing={2}>
                <TextField label="Building Number" value={form.buildingNumber} onChange={(e) => set('buildingNumber', e.target.value)} sx={{ width: 180 }} inputProps={{ maxLength: 20 }} />
                <TextField label="Street Name" value={form.streetName} onChange={(e) => set('streetName', e.target.value)} fullWidth />
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField label="District / Neighborhood" value={form.district} onChange={(e) => set('district', e.target.value)} fullWidth />
                <TextField label="City" value={form.city} onChange={(e) => set('city', e.target.value)} fullWidth />
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField label="Postal Code" value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} sx={{ width: 180 }} inputProps={{ maxLength: 10 }} />
                <TextField
                  label="Country Code" value={form.countryCode}
                  onChange={(e) => set('countryCode', e.target.value.toUpperCase())}
                  sx={{ width: 160 }} inputProps={{ maxLength: 2 }}
                  error={!countryCodeValid}
                  helperText={countryCodeValid ? 'ISO 3166-1 (e.g. "SA")' : 'Must be exactly 2 letters'}
                />
              </Stack>
            </Stack>
          </Box>

          <Divider />

          {/* Save */}
          <Stack direction="row" spacing={1.5} alignItems="center">
            <PrimaryButton
              disabled={!dirty || saveMutation.isPending || !vatValid || !countryCodeValid}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? 'Saving…' : 'Save Settings'}
            </PrimaryButton>
            {dirty && (
              <SecondaryButton onClick={() => { if (settings) { setForm({ isActive: settings.isActive ?? false, sellerNameAr: settings.sellerNameAr ?? '', sellerNameEn: settings.sellerNameEn ?? '', vatNumber: settings.vatNumber ?? '', crNumber: settings.crNumber ?? '', buildingNumber: settings.buildingNumber ?? '', streetName: settings.streetName ?? '', district: settings.district ?? '', city: settings.city ?? '', postalCode: settings.postalCode ?? '', countryCode: settings.countryCode ?? 'SA', vatRate: settings.vatRate ?? '15.00', phase: (settings.phase ?? 1) as 1 | 2, zatcaEnv: settings.zatcaEnv ?? 'sandbox' }); setDirty(false); } }}>
                Discard
              </SecondaryButton>
            )}
            {!dirty && form.isActive && (
              <Typography variant="body2" color="success.main" fontWeight={600}>✓ ZATCA e-invoicing is active</Typography>
            )}
          </Stack>
        </Stack>
      )}

      {/* ── TAB 1: Phase 2 Onboarding ───────────────────────────────────── */}
      {tab === 1 && (
        <Stack spacing={2}>

          {/* Status banner */}
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: isLive ? 'success.main' : 'divider' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography fontWeight={700}>Onboarding Status</Typography>
                <Typography variant="body2" color="text.secondary">Complete all 4 steps to get your Production CSID from ZATCA.</Typography>
              </Box>
              <Chip
                label={STATUS_LABELS[onboarding] ?? onboarding}
                color={STATUS_COLOR[onboarding] ?? 'default'}
                icon={isLive ? <VerifiedUserIcon /> : undefined}
              />
            </Stack>
            {settings?.invoiceCounter !== undefined && (
              <Typography variant="caption" color="text.secondary" mt={1} display="block">
                Invoices processed: {settings.invoiceCounter}
              </Typography>
            )}
          </Paper>

          {form.phase !== 2 && (
            <Alert severity="warning">
              Switch to Phase 2 in the Settings tab and save before completing onboarding.
            </Alert>
          )}

          {/* 4-step wizard */}
          <Stepper orientation="vertical" activeStep={
            onboarding === 'none'                ? 0 :
            onboarding === 'key_generated'       ? 1 :
            onboarding === 'compliance_pending'  ? 2 :
            onboarding === 'compliance_done'     ? 3 : 4
          }>

            {/* Step 1: Generate key + CSR */}
            <Step completed={onboarding !== 'none'}>
              <StepLabel StepIconComponent={() => <KeyIcon color={onboarding !== 'none' ? 'success' : 'action'} />}>
                Generate EC Key & CSR
              </StepLabel>
              <StepContent>
                <Typography variant="body2" color="text.secondary" mb={1}>
                  Generates an EC private key (P-256) and a Certificate Signing Request (CSR) that you will upload to the ZATCA Fatoorah portal.
                </Typography>
                {settings?.hasCsr && (
                  <Alert severity="success" sx={{ mb: 1 }}>CSR already generated. You can regenerate below (this resets all downstream certificates).</Alert>
                )}
                <Stack direction="row" spacing={1}>
                  <PrimaryButton
                    disabled={generateKeyMutation.isPending}
                    onClick={() => generateKeyMutation.mutate()}
                    size="small"
                  >
                    {generateKeyMutation.isPending ? 'Generating…' : settings?.hasCsr ? 'Regenerate Key & CSR' : 'Generate Key & CSR'}
                  </PrimaryButton>
                  {settings?.hasCsr && (
                    <Button
                      size="small" variant="outlined" startIcon={<ContentCopyIcon />}
                      onClick={() => {
                        navigator.clipboard.writeText(settings?.hasCsr ? '(download from server)' : '');
                        setCsrCopied(true);
                        setTimeout(() => setCsrCopied(false), 2000);
                      }}
                    >
                      {csrCopied ? 'Copied!' : 'Copy CSR note'}
                    </Button>
                  )}
                </Stack>
                <Alert severity="info" sx={{ mt: 1.5 }} icon={false}>
                  After generating, go to <strong>portal.zatca.gov.sa</strong> (Fatoorah) → E-Invoice Onboarding → upload the CSR → get your OTP.
                </Alert>
              </StepContent>
            </Step>

            {/* Step 2: Submit OTP */}
            <Step completed={['compliance_pending', 'compliance_done', 'production_live'].includes(onboarding)}>
              <StepLabel StepIconComponent={() => <CloudUploadIcon color={['compliance_pending', 'compliance_done', 'production_live'].includes(onboarding) ? 'success' : 'action'} />}>
                Submit OTP — Get Compliance CSID
              </StepLabel>
              <StepContent>
                <Typography variant="body2" color="text.secondary" mb={1}>
                  Enter the OTP you received from the ZATCA Fatoorah portal after uploading your CSR.
                </Typography>
                {settings?.hasCcsid ? (
                  <Alert severity="success">Compliance CSID (CCSID) already obtained.</Alert>
                ) : (
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <TextField
                      label="OTP from Fatoorah portal"
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value)}
                      size="small"
                      sx={{ width: 220 }}
                      inputProps={{ maxLength: 10 }}
                    />
                    <PrimaryButton
                      size="small"
                      disabled={!otpInput || submitOtpMutation.isPending || !settings?.hasCsr}
                      onClick={() => submitOtpMutation.mutate()}
                    >
                      {submitOtpMutation.isPending ? 'Submitting…' : 'Submit OTP'}
                    </PrimaryButton>
                  </Stack>
                )}
              </StepContent>
            </Step>

            {/* Step 3: Compliance check */}
            <Step completed={['compliance_done', 'production_live'].includes(onboarding)}>
              <StepLabel StepIconComponent={() => <VerifiedUserIcon color={['compliance_done', 'production_live'].includes(onboarding) ? 'success' : 'action'} />}>
                Compliance Check (3 sample invoices)
              </StepLabel>
              <StepContent>
                <Typography variant="body2" color="text.secondary" mb={1}>
                  ZATCA requires you to submit 3 valid signed invoices to verify your setup before going live.
                  This runs automatically with sample data.
                </Typography>
                {complianceResults.length > 0 && (
                  <Stack spacing={0.5} mb={1}>
                    {complianceResults.map((r) => (
                      <Chip key={r.invoice} size="small"
                        label={`Invoice ${r.invoice}: ${r.status < 300 ? 'Passed' : 'Failed'} (HTTP ${r.status})`}
                        color={r.status < 300 ? 'success' : 'error'}
                      />
                    ))}
                  </Stack>
                )}
                <PrimaryButton
                  size="small"
                  disabled={complianceMutation.isPending || !settings?.hasCcsid}
                  onClick={() => complianceMutation.mutate()}
                >
                  {complianceMutation.isPending ? 'Running…' : 'Run Compliance Check'}
                </PrimaryButton>
              </StepContent>
            </Step>

            {/* Step 4: Activate production */}
            <Step completed={onboarding === 'production_live'}>
              <StepLabel StepIconComponent={() => <RocketLaunchIcon color={onboarding === 'production_live' ? 'success' : 'action'} />}>
                Activate Production — Get PCSID
              </StepLabel>
              <StepContent>
                <Typography variant="body2" color="text.secondary" mb={1}>
                  Exchange your Compliance CSID for a Production CSID. Once done, all new invoices will be signed and submitted to ZATCA automatically.
                </Typography>
                {onboarding === 'production_live' ? (
                  <Alert severity="success" icon={<VerifiedUserIcon />}>
                    Production CSID active. Invoices are being submitted to ZATCA.
                  </Alert>
                ) : (
                  <PrimaryButton
                    size="small"
                    disabled={activateMutation.isPending || !['compliance_done', 'production_live'].includes(onboarding)}
                    onClick={() => activateMutation.mutate()}
                    color="success"
                  >
                    {activateMutation.isPending ? 'Activating…' : 'Activate Production'}
                  </PrimaryButton>
                )}
              </StepContent>
            </Step>
          </Stepper>

          {isLive && (
            <Alert severity="success" icon={<VerifiedUserIcon />}>
              <strong>Phase 2 is live.</strong> Every completed invoice is now automatically signed and submitted to ZATCA
              ({form.zatcaEnv === 'production' ? 'Production' : 'Sandbox'} environment).
              B2C invoices → Reporting API. B2B invoices (customers with VAT number) → Clearance API.
            </Alert>
          )}
        </Stack>
      )}

      <Snackbar open={Boolean(snackbar)} autoHideDuration={4000} onClose={() => setSnackbar(null)} message={snackbar} />
    </Box>
  );
}
