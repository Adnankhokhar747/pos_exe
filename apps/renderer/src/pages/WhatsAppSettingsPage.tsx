import { useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import SendIcon from '@mui/icons-material/Send';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { WhatsAppSettings, WhatsAppLog } from '../api/types';
import { PrimaryButton } from '../components/buttons';

const TEMPLATE_VARS: Record<string, string[]> = {
  templateInvoice:         ['{customer_name}', '{invoice_number}', '{amount}', '{business_name}'],
  templateAppointment:     ['{patient_name}', '{doctor_name}', '{token_number}', '{date}', '{business_name}'],
  templateInstallmentDue:  ['{customer_name}', '{amount}', '{due_date}', '{remaining_balance}', '{business_name}'],
  templateInstallmentPaid: ['{customer_name}', '{amount}', '{remaining_balance}', '{business_name}'],
};

export function WhatsAppSettingsPage(): JSX.Element {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [showToken, setShowToken] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [snackbar, setSnackbar] = useState<{ msg: string; sev: 'success' | 'error' } | null>(null);

  // ── Fetch settings ──────────────────────────────────────────────────────────
  const { data: settings, isLoading } = useQuery<WhatsAppSettings>({
    queryKey: ['whatsapp-settings'],
    queryFn: () => apiFetch<WhatsAppSettings>('/api/v1/whatsapp/settings'),
  });

  const { data: logs, refetch: refetchLogs } = useQuery<WhatsAppLog[]>({
    queryKey: ['whatsapp-logs'],
    queryFn: () => apiFetch<WhatsAppLog[]>('/api/v1/whatsapp/logs'),
    enabled: tab === 2,
  });

  // ── Local form state ────────────────────────────────────────────────────────
  const [form, setForm] = useState<Partial<WhatsAppSettings & { apiToken: string }>>({});

  const merged = { ...settings, ...form } as WhatsAppSettings & { apiToken?: string };

  function set<K extends keyof (WhatsAppSettings & { apiToken: string })>(
    key: K,
    value: (WhatsAppSettings & { apiToken: string })[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // ── Save mutation ───────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetch<WhatsAppSettings>('/api/v1/whatsapp/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          provider:              merged.provider,
          instanceId:            merged.instanceId ?? null,
          phoneNumberId:         merged.phoneNumberId ?? null,
          fromNumber:            merged.fromNumber ?? null,
          apiToken:              (form as { apiToken?: string }).apiToken ?? undefined,
          isEnabled:             merged.isEnabled,
          notifyInvoice:         merged.notifyInvoice,
          notifyAppointment:     merged.notifyAppointment,
          notifyInstallmentDue:  merged.notifyInstallmentDue,
          notifyInstallmentPaid: merged.notifyInstallmentPaid,
          reminderDaysBefore:    merged.reminderDaysBefore,
          templateInvoice:       merged.templateInvoice,
          templateAppointment:   merged.templateAppointment,
          templateInstallmentDue: merged.templateInstallmentDue,
          templateInstallmentPaid: merged.templateInstallmentPaid,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-settings'] });
      setForm({});
      setSnackbar({ msg: 'Settings saved.', sev: 'success' });
    },
    onError: (e) => {
      setSnackbar({ msg: e instanceof ApiError ? e.detail : 'Failed to save.', sev: 'error' });
    },
  });

  // ── Test send mutation ──────────────────────────────────────────────────────
  const testMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean; error?: string }>('/api/v1/whatsapp/test', {
        method: 'POST',
        body: JSON.stringify({ phone: testPhone }),
      }),
    onSuccess: (res) => {
      if (res.ok) setSnackbar({ msg: 'Test message sent successfully!', sev: 'success' });
      else setSnackbar({ msg: res.error ?? 'Failed to send test.', sev: 'error' });
    },
    onError: (e) => {
      setSnackbar({ msg: e instanceof ApiError ? e.detail : 'Failed to send test.', sev: 'error' });
    },
  });

  if (isLoading) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" height={300}>
        <CircularProgress />
      </Box>
    );
  }

  const provider = merged.provider ?? 'ultramsg';
  const isDirty  = Object.keys(form).length > 0;

  return (
    <Box p={3} maxWidth={800}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Box>
          <Typography variant="h6" fontWeight={700}>WhatsApp Notifications</Typography>
          <Typography variant="body2" color="text.secondary">
            Automatically send WhatsApp messages for invoices, appointments, and lease installments.
          </Typography>
        </Box>
        <FormControlLabel
          control={
            <Switch
              checked={merged.isEnabled ?? true}
              onChange={(e) => set('isEnabled', e.target.checked)}
              color="success"
            />
          }
          label={<Typography fontWeight={600}>{merged.isEnabled ? 'Enabled' : 'Disabled'}</Typography>}
          labelPlacement="start"
        />
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Credentials" />
        <Tab label="Templates" />
        <Tab label="Message Log" />
      </Tabs>

      {/* ── Tab 0: Credentials & toggles ─────────────────────────────────── */}
      {tab === 0 && (
        <Stack spacing={3}>

          {/* Provider */}
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} mb={2}>API Provider</Typography>
            <TextField
              select fullWidth size="small" label="Provider"
              value={provider}
              onChange={(e) => set('provider', e.target.value as WhatsAppSettings['provider'])}
            >
              <MenuItem value="ultramsg">UltraMsg (ultramsg.com)</MenuItem>
              <MenuItem value="meta">Meta Cloud API (Official)</MenuItem>
              <MenuItem value="twilio">Twilio WhatsApp</MenuItem>
            </TextField>

            <Stack spacing={2} mt={2}>
              {/* UltraMsg fields */}
              {provider === 'ultramsg' && (
                <>
                  <TextField
                    label="Instance ID" size="small" fullWidth
                    value={merged.instanceId ?? ''}
                    onChange={(e) => set('instanceId', e.target.value)}
                    placeholder="instance123456"
                    helperText="Found in your UltraMsg dashboard"
                  />
                  <TextField
                    label="API Token" size="small" fullWidth
                    type={showToken ? 'text' : 'password'}
                    value={(form as { apiToken?: string }).apiToken ?? (settings?.hasApiToken ? '••••••••' : '')}
                    onChange={(e) => set('apiToken' as keyof WhatsAppSettings, e.target.value as never)}
                    placeholder={settings?.hasApiToken ? 'Leave blank to keep current' : 'Enter token'}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setShowToken((v) => !v)} edge="end">
                            {showToken ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </>
              )}

              {/* Meta Cloud API fields */}
              {provider === 'meta' && (
                <>
                  <TextField
                    label="Phone Number ID" size="small" fullWidth
                    value={merged.phoneNumberId ?? ''}
                    onChange={(e) => set('phoneNumberId', e.target.value)}
                    placeholder="1234567890"
                    helperText="Found in Meta Developer Console → WhatsApp → API Setup"
                  />
                  <TextField
                    label="Access Token" size="small" fullWidth
                    type={showToken ? 'text' : 'password'}
                    value={(form as { apiToken?: string }).apiToken ?? (settings?.hasApiToken ? '••••••••' : '')}
                    onChange={(e) => set('apiToken' as keyof WhatsAppSettings, e.target.value as never)}
                    placeholder={settings?.hasApiToken ? 'Leave blank to keep current' : 'Enter access token'}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setShowToken((v) => !v)} edge="end">
                            {showToken ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    helperText="Use a permanent system user token from Meta Business Suite"
                  />
                </>
              )}

              {/* Twilio fields */}
              {provider === 'twilio' && (
                <>
                  <TextField
                    label="Account SID" size="small" fullWidth
                    value={merged.instanceId ?? ''}
                    onChange={(e) => set('instanceId', e.target.value)}
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  />
                  <TextField
                    label="Auth Token" size="small" fullWidth
                    type={showToken ? 'text' : 'password'}
                    value={(form as { apiToken?: string }).apiToken ?? (settings?.hasApiToken ? '••••••••' : '')}
                    onChange={(e) => set('apiToken' as keyof WhatsAppSettings, e.target.value as never)}
                    placeholder={settings?.hasApiToken ? 'Leave blank to keep current' : 'Enter auth token'}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setShowToken((v) => !v)} edge="end">
                            {showToken ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <TextField
                    label="From Number (E.164)" size="small" fullWidth
                    value={merged.fromNumber ?? ''}
                    onChange={(e) => set('fromNumber', e.target.value)}
                    placeholder="+14155552671"
                    helperText="Your Twilio WhatsApp sandbox or approved number"
                  />
                </>
              )}
            </Stack>
          </Paper>

          {/* Notification toggles */}
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} mb={1}>Notification Types</Typography>
            <Typography variant="caption" color="text.secondary" display="block" mb={2}>
              Choose which events trigger a WhatsApp message.
            </Typography>
            <Stack spacing={1.5}>
              <FormControlLabel
                control={<Switch checked={merged.notifyInvoice ?? true} onChange={(e) => set('notifyInvoice', e.target.checked)} size="small" />}
                label={<Box><Typography variant="body2" fontWeight={600}>Invoice Created</Typography><Typography variant="caption" color="text.secondary">Send to customer when a sale invoice is completed</Typography></Box>}
              />
              <Divider />
              <FormControlLabel
                control={<Switch checked={merged.notifyAppointment ?? true} onChange={(e) => set('notifyAppointment', e.target.checked)} size="small" />}
                label={<Box><Typography variant="body2" fontWeight={600}>Appointment Confirmed</Typography><Typography variant="caption" color="text.secondary">Send to patient when an appointment is booked or confirmed</Typography></Box>}
              />
              <Divider />
              <FormControlLabel
                control={<Switch checked={merged.notifyInstallmentDue ?? true} onChange={(e) => set('notifyInstallmentDue', e.target.checked)} size="small" />}
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={600}>Installment Due Reminder</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Sent automatically every morning,{' '}
                      <TextField
                        size="small"
                        type="number"
                        value={merged.reminderDaysBefore ?? 3}
                        onChange={(e) => set('reminderDaysBefore', parseInt(e.target.value) || 3)}
                        sx={{ width: 60, mx: 0.5 }}
                        inputProps={{ min: 1, max: 30 }}
                        variant="standard"
                      />{' '}
                      day(s) before due date
                    </Typography>
                  </Box>
                }
              />
              <Divider />
              <FormControlLabel
                control={<Switch checked={merged.notifyInstallmentPaid ?? false} onChange={(e) => set('notifyInstallmentPaid', e.target.checked)} size="small" />}
                label={<Box><Typography variant="body2" fontWeight={600}>Installment Payment Received</Typography><Typography variant="caption" color="text.secondary">Send payment confirmation to customer</Typography></Box>}
              />
            </Stack>
          </Paper>

          {/* Test message */}
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} mb={1}>Test Message</Typography>
            <Typography variant="caption" color="text.secondary" display="block" mb={2}>
              Save settings first, then send a test to verify your connection.
            </Typography>
            <Stack direction="row" spacing={1}>
              <TextField
                label="Phone Number" size="small" fullWidth
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="966501234567"
                helperText="Include country code, no +"
              />
              <PrimaryButton
                onClick={() => testMutation.mutate()}
                disabled={!testPhone || testMutation.isPending || isDirty}
                sx={{ whiteSpace: 'nowrap', alignSelf: 'flex-start' }}
                startIcon={<SendIcon />}
              >
                {testMutation.isPending ? 'Sending…' : 'Send Test'}
              </PrimaryButton>
            </Stack>
            {isDirty && (
              <Alert severity="info" sx={{ mt: 1.5 }}>
                Save your settings first before testing.
              </Alert>
            )}
          </Paper>

          <PrimaryButton
            onClick={() => saveMutation.mutate()}
            disabled={!isDirty || saveMutation.isPending}
            sx={{ alignSelf: 'flex-start' }}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save Settings'}
          </PrimaryButton>
        </Stack>
      )}

      {/* ── Tab 1: Message templates ──────────────────────────────────────── */}
      {tab === 1 && (
        <Stack spacing={3}>
          <Alert severity="info" sx={{ mb: 1 }}>
            Use the variable placeholders below in your templates. They are replaced with real values when the message is sent.
          </Alert>

          {(
            [
              { key: 'templateInvoice',         label: 'Invoice Created' },
              { key: 'templateAppointment',      label: 'Appointment Confirmed' },
              { key: 'templateInstallmentDue',   label: 'Installment Due Reminder' },
              { key: 'templateInstallmentPaid',  label: 'Installment Payment Received' },
            ] as const
          ).map(({ key, label }) => (
            <Paper key={key} variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} mb={1}>{label}</Typography>
              <Stack direction="row" flexWrap="wrap" spacing={0.5} mb={1.5}>
                {TEMPLATE_VARS[key]?.map((v) => (
                  <Chip key={v} label={v} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }} />
                ))}
              </Stack>
              <TextField
                fullWidth
                multiline
                minRows={3}
                size="small"
                value={merged[key] ?? ''}
                onChange={(e) => set(key, e.target.value)}
              />
            </Paper>
          ))}

          <PrimaryButton
            onClick={() => saveMutation.mutate()}
            disabled={!isDirty || saveMutation.isPending}
            sx={{ alignSelf: 'flex-start' }}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save Templates'}
          </PrimaryButton>
        </Stack>
      )}

      {/* ── Tab 2: Message Log ────────────────────────────────────────────── */}
      {tab === 2 && (
        <Box>
          <Stack direction="row" justifyContent="flex-end" mb={1}>
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={() => refetchLogs()}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>

          {!logs ? (
            <Box display="flex" justifyContent="center" py={4}><CircularProgress size={28} /></Box>
          ) : logs.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>No messages sent yet.</Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Status</TableCell>
                    <TableCell>To</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Sent At</TableCell>
                    <TableCell>Error</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        {log.status === 'sent' ? (
                          <CheckCircleIcon fontSize="small" color="success" />
                        ) : (
                          <ErrorIcon fontSize="small" color="error" />
                        )}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace' }}>+{log.toNumber}</TableCell>
                      <TableCell>
                        <Chip label={log.referenceType ?? 'test'} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="error.main">
                          {log.errorMessage ?? '—'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar?.sev} onClose={() => setSnackbar(null)} variant="filled" sx={{ width: '100%' }}>
          {snackbar?.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
