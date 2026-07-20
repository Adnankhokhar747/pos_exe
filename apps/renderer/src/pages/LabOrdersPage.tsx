import { useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Chip, DialogActions, Divider,
  FormControl, InputLabel, MenuItem,
  Select, Snackbar, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PrintIcon from '@mui/icons-material/Print';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { LabOrder, LabOrderItem, LabTest, LabResultFlag, Patient, Doctor, ReceiptSettings } from '../api/types';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { AppModal } from '../components/AppModal';
import { PrintPreviewModal } from '../components/PrintPreviewModal';
import { PrimaryButton, SecondaryButton } from '../components/buttons';
import { useCurrency } from '../hooks/useCurrency';
import { useAuth } from '../state/auth-context';
import { renderLabReportHtml } from '../printing/lab-report-template';

const STATUS_COLORS: Record<string, 'warning' | 'info' | 'default' | 'success' | 'error'> = {
  pending: 'warning',
  sample_collected: 'info',
  processing: 'info',
  completed: 'success',
  cancelled: 'error',
};

const FLAG_COLORS: Record<LabResultFlag, 'success' | 'warning' | 'error' | 'default'> = {
  normal: 'success',
  low: 'warning',
  high: 'warning',
  critical_low: 'error',
  critical_high: 'error',
  abnormal: 'error',
  pending: 'default',
};

const FLAGS: LabResultFlag[] = ['normal', 'low', 'high', 'critical_low', 'critical_high', 'abnormal'];

function ResultDialog({
  item,
  orderId,
  onClose,
}: {
  item: LabOrderItem;
  orderId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [value, setValue] = useState(item.result?.resultValue ?? '');
  const [flag, setFlag] = useState<LabResultFlag>(item.result?.resultFlag ?? 'normal');
  const [remarks, setRemarks] = useState(item.result?.remarks ?? '');
  const [toast, setToast] = useState('');

  const enter = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/hospital/lab/items/${item.id}/result`, {
        method: 'POST',
        body: { resultValue: value, resultFlag: flag, remarks: remarks || null },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lab-order', orderId] });
      qc.invalidateQueries({ queryKey: ['lab-orders'] });
      setToast('Result saved.');
    },
    onError: (e: ApiError) => setToast(e.message ?? 'Error saving result.'),
  });

  const verify = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/hospital/lab/items/${item.id}/verify`, { method: 'POST', body: {} }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lab-order', orderId] });
      qc.invalidateQueries({ queryKey: ['lab-orders'] });
      setToast('Result verified.');
      setTimeout(onClose, 800);
    },
    onError: (e: ApiError) => setToast(e.message ?? 'Error verifying.'),
  });

  return (
    <>
      <Stack spacing={2} mt={1}>
        <Typography variant="subtitle2" color="text.secondary">
          Test: <strong>{item.testName}</strong> ({item.testCode})
          {item.unit && ` | Unit: ${item.unit}`}
          {item.normalRange && ` | Normal: ${item.normalRange}`}
        </Typography>
        <TextField
          label="Result Value *"
          value={value}
          onChange={e => setValue(e.target.value)}
          fullWidth
          placeholder={item.unit ? `Enter value in ${item.unit}` : 'Enter result'}
        />
        <FormControl fullWidth>
          <InputLabel>Result Flag *</InputLabel>
          <Select value={flag} label="Result Flag *" onChange={e => setFlag(e.target.value as LabResultFlag)}>
            {FLAGS.map(f => (
              <MenuItem key={f} value={f}>
                <Chip size="small" label={f.replace('_', ' ')} color={FLAG_COLORS[f]} sx={{ mr: 1 }} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          label="Remarks"
          value={remarks}
          onChange={e => setRemarks(e.target.value)}
          multiline
          rows={2}
          fullWidth
        />
        {item.status === 'resulted' && (
          <Alert severity="info" icon={<CheckCircleIcon />}>
            Result entered. You can verify it to finalize.
          </Alert>
        )}
        {item.status === 'verified' && (
          <Alert severity="success">This result is verified.</Alert>
        )}
      </Stack>
      <DialogActions sx={{ mt: 2, px: 0 }}>
        <SecondaryButton onClick={onClose}>Close</SecondaryButton>
        {item.status !== 'verified' && (
          <>
            <SecondaryButton onClick={() => enter.mutate()} disabled={enter.isPending}>
              {enter.isPending ? 'Saving…' : 'Save Result'}
            </SecondaryButton>
            {item.status === 'resulted' && (
              <PrimaryButton onClick={() => verify.mutate()} disabled={verify.isPending}>
                {verify.isPending ? 'Verifying…' : 'Verify'}
              </PrimaryButton>
            )}
          </>
        )}
      </DialogActions>
      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={/error|fail|forbidden|permission|denied|invalid|cannot/i.test(toast) ? 'error' : 'success'} onClose={() => setToast('')}>{toast}</Alert>
      </Snackbar>
    </>
  );
}

function OrderDetailDialog({ order, onClose }: { order: LabOrder; onClose: () => void }) {
  const qc = useQueryClient();
  const cur = useCurrency();
  const { user } = useAuth();
  const [resultItem, setResultItem] = useState<LabOrderItem | null>(null);
  const [toast, setToast] = useState('');
  const [printing, setPrinting] = useState(false);
  const [printPreview, setPrintPreview] = useState<{ open: boolean; html: string; title: string }>({
    open: false, html: '', title: '',
  });

  const { data: detail } = useQuery<LabOrder>({
    queryKey: ['lab-order', order.id],
    queryFn: () => apiFetch(`/api/v1/hospital/lab/orders/${order.id}`),
  });

  const collect = useMutation({
    mutationFn: () => apiFetch(`/api/v1/hospital/lab/orders/${order.id}/collect`, { method: 'POST', body: {} }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lab-orders'] });
      qc.invalidateQueries({ queryKey: ['lab-order', order.id] });
      setToast('Samples collected.');
    },
    onError: (e: ApiError) => setToast(e.message ?? 'Error.'),
  });

  async function handlePrint() {
    setPrinting(true);
    try {
      const [freshOrder, receiptSettings] = await Promise.all([
        apiFetch<LabOrder>(`/api/v1/hospital/lab/orders/${order.id}`),
        apiFetch<ReceiptSettings>('/api/v1/settings/receipt-settings'),
      ]);
      const html = renderLabReportHtml({
        order: freshOrder,
        branchName: user?.branchName ?? '',
        headerText: receiptSettings.headerText,
        footerText: receiptSettings.footerText,
      });
      setPrintPreview({ open: true, html, title: `Lab Report — ${freshOrder.orderNumber}` });
    } catch {
      setToast('Could not load report for printing.');
    } finally {
      setPrinting(false);
    }
  }

  const o = detail ?? order;

  if (resultItem) {
    return (
      <AppModal open title={`Enter Result — ${resultItem.testName}`} onClose={() => setResultItem(null)} maxWidth="sm">
        <ResultDialog item={resultItem} orderId={order.id} onClose={() => setResultItem(null)} />
      </AppModal>
    );
  }

  return (
    <>
      <Stack spacing={1} mb={2}>
        <Stack direction="row" spacing={2}>
          <Box>
            <Typography variant="caption" color="text.secondary">Patient</Typography>
            <Typography fontWeight={600}>{o.patient?.name ?? '—'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Doctor</Typography>
            <Typography>{o.doctor?.name ?? '—'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Priority</Typography>
            <Chip
              size="small"
              label={o.priority}
              color={o.priority === 'stat' ? 'error' : o.priority === 'urgent' ? 'warning' : 'default'}
            />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Status</Typography>
            <Chip size="small" label={o.status.replace('_', ' ')} color={STATUS_COLORS[o.status]} />
          </Box>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          Order: {o.orderNumber} | Total: {cur.fmt(o.totalAmount)}
        </Typography>
      </Stack>

      <Divider sx={{ mb: 2 }} />

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Code</TableCell>
            <TableCell>Test</TableCell>
            <TableCell>Normal Range</TableCell>
            <TableCell>Result</TableCell>
            <TableCell>Flag</TableCell>
            <TableCell>Status</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {(o.items ?? []).map(item => (
            <TableRow key={item.id}>
              <TableCell>{item.testCode}</TableCell>
              <TableCell>{item.testName}</TableCell>
              <TableCell>{item.normalRange ?? '—'}</TableCell>
              <TableCell>{item.result?.resultValue ?? '—'}</TableCell>
              <TableCell>
                {item.result ? (
                  <Chip
                    size="small"
                    label={item.result.resultFlag.replace('_', ' ')}
                    color={FLAG_COLORS[item.result.resultFlag]}
                  />
                ) : '—'}
              </TableCell>
              <TableCell>
                <Chip size="small" label={item.status.replace('_', ' ')} />
              </TableCell>
              <TableCell>
                {item.status !== 'verified' && o.status !== 'cancelled' && (
                  <Button size="small" onClick={() => setResultItem(item)}>
                    {item.status === 'pending' || item.status === 'sample_collected' ? 'Enter' : 'Edit'}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <DialogActions sx={{ mt: 2, px: 0 }}>
        <SecondaryButton onClick={onClose}>Close</SecondaryButton>
        <Button
          variant="outlined"
          startIcon={<PrintIcon />}
          onClick={handlePrint}
          disabled={printing}
          sx={{ mr: 'auto' }}
        >
          {printing ? 'Loading…' : 'Print Report'}
        </Button>
        {o.status === 'pending' && (
          <PrimaryButton onClick={() => collect.mutate()} disabled={collect.isPending}>
            {collect.isPending ? 'Saving…' : 'Mark Samples Collected'}
          </PrimaryButton>
        )}
      </DialogActions>

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={/error|fail|forbidden|permission|denied|invalid|cannot/i.test(toast) ? 'error' : 'success'} onClose={() => setToast('')}>{toast}</Alert>
      </Snackbar>

      <PrintPreviewModal
        open={printPreview.open}
        title={printPreview.title}
        html={printPreview.html}
        onClose={() => setPrintPreview(p => ({ ...p, open: false }))}
      />
    </>
  );
}

export function LabOrdersPage() {
  const qc = useQueryClient();
  const cur = useCurrency();
  const [newOpen, setNewOpen] = useState(false);
  const [selected, setSelected] = useState<LabOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [toast, setToast] = useState('');

  // New order form state
  const [patientId, setPatientId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [priority, setPriority] = useState<'routine' | 'urgent' | 'stat'>('routine');
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const { data: orders = [], isLoading } = useQuery<LabOrder[]>({
    queryKey: ['lab-orders', statusFilter],
    queryFn: () => {
      const p = statusFilter ? `?status=${statusFilter}` : '';
      return apiFetch(`/api/v1/hospital/lab/orders${p}`);
    },
  });

  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ['patients-list'],
    queryFn: () => apiFetch('/api/v1/hospital/patients'),
  });

  const { data: doctors = [] } = useQuery<Doctor[]>({
    queryKey: ['doctors-active'],
    queryFn: () => apiFetch('/api/v1/hospital/doctors'),
  });

  const { data: tests = [] } = useQuery<LabTest[]>({
    queryKey: ['lab-tests'],
    queryFn: () => apiFetch('/api/v1/hospital/lab/tests'),
  });

  const createOrder = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/hospital/lab/orders', {
        method: 'POST',
        body: { patientId, doctorId: doctorId || null, priority, tests: selectedTests, notes: notes || null },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lab-orders'] });
      setNewOpen(false);
      setPatientId(''); setDoctorId(''); setSelectedTests([]); setNotes(''); setPriority('routine');
      setToast('Lab order created.');
    },
    onError: (e: ApiError) => setToast(e.message ?? 'Error creating order.'),
  });

  const STATUSES = ['pending', 'sample_collected', 'processing', 'completed', 'cancelled'];

  const columns: DataTableColumn<LabOrder>[] = [
    { key: 'orderNumber', label: 'Order #', render: r => <strong>{r.orderNumber}</strong> },
    { key: 'patient', label: 'Patient', render: r => r.patient?.name ?? '—' },
    { key: 'doctor', label: 'Doctor', render: r => r.doctor?.name ?? '—' },
    { key: 'priority', label: 'Priority', render: r =>
      <Chip size="small" label={r.priority} color={r.priority === 'stat' ? 'error' : r.priority === 'urgent' ? 'warning' : 'default'} />
    },
    { key: 'itemsCount', label: 'Tests', render: r => r.itemsCount ?? 0 },
    { key: 'totalAmount', label: 'Total', render: r => cur.fmt(r.totalAmount) },
    { key: 'status', label: 'Status', render: r =>
      <Chip size="small" label={r.status.replace('_', ' ')} color={STATUS_COLORS[r.status]} />
    },
    { key: 'createdAt', label: 'Date', render: r => new Date(r.createdAt).toLocaleDateString() },
  ];

  const activeTests = tests.filter(t => t.isActive);

  return (
    <Box p={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <AssignmentIcon color="primary" />
          <Typography variant="h5" fontWeight={600}>Lab Orders</Typography>
        </Stack>
        <Button variant="contained" onClick={() => setNewOpen(true)}>+ New Lab Order</Button>
      </Stack>

      <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
        <Chip label="All" variant={statusFilter === '' ? 'filled' : 'outlined'} color="primary" onClick={() => setStatusFilter('')} />
        {STATUSES.map(s => (
          <Chip
            key={s}
            label={s.replace('_', ' ')}
            variant={statusFilter === s ? 'filled' : 'outlined'}
            color={STATUS_COLORS[s]}
            onClick={() => setStatusFilter(s)}
          />
        ))}
      </Stack>

      <DataTable
        columns={columns}
        rows={orders}
        getRowId={r => r.id}
        onRowClick={r => setSelected(r)}
      />

      {/* New Order Dialog */}
      <AppModal open={newOpen} onClose={() => setNewOpen(false)} title="New Lab Order" maxWidth="sm">
        <Stack spacing={2} mt={1}>
          <Autocomplete
            fullWidth
            options={patients}
            getOptionLabel={p => `${p.name}${p.phone ? ` — ${p.phone}` : ''}`}
            filterOptions={(opts, state) => {
              const q = state.inputValue.toLowerCase();
              return opts.filter(p => p.name.toLowerCase().includes(q) || (p.phone ?? '').includes(q));
            }}
            value={patients.find(p => p.id === patientId) ?? null}
            onChange={(_, val) => setPatientId(val?.id ?? '')}
            renderInput={params => <TextField {...params} label="Patient *" placeholder="Search by name or phone…" />}
          />
          <Autocomplete
            fullWidth
            options={doctors}
            getOptionLabel={d => `${d.name}${d.specialization ? ` — ${d.specialization}` : ''}`}
            filterOptions={(opts, state) => {
              const q = state.inputValue.toLowerCase();
              return opts.filter(d => d.name.toLowerCase().includes(q) || (d.specialization ?? '').toLowerCase().includes(q));
            }}
            value={doctors.find(d => d.id === doctorId) ?? null}
            onChange={(_, val) => setDoctorId(val?.id ?? '')}
            renderInput={params => <TextField {...params} label="Referring Doctor (optional)" placeholder="Search by name or specialization…" />}
          />
          <FormControl fullWidth>
            <InputLabel>Priority</InputLabel>
            <Select value={priority} label="Priority" onChange={e => setPriority(e.target.value as typeof priority)}>
              <MenuItem value="routine">Routine</MenuItem>
              <MenuItem value="urgent">Urgent</MenuItem>
              <MenuItem value="stat">STAT (Emergency)</MenuItem>
            </Select>
          </FormControl>
          <Box>
            <Typography variant="subtitle2" mb={1}>Select Tests *</Typography>
            <Stack spacing={1} sx={{ maxHeight: 220, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
              {activeTests.map(t => {
                const checked = selectedTests.includes(t.id);
                return (
                  <Stack
                    key={t.id}
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{
                      p: 1, borderRadius: 1, cursor: 'pointer',
                      bgcolor: checked ? 'primary.light' : 'transparent',
                      '&:hover': { bgcolor: checked ? 'primary.light' : 'action.hover' },
                    }}
                    onClick={() =>
                      setSelectedTests(prev =>
                        prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id]
                      )
                    }
                  >
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{t.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{t.code} {t.category ? `· ${t.category}` : ''}</Typography>
                    </Box>
                    <Typography variant="body2" color="primary">{cur.fmt(t.price)}</Typography>
                  </Stack>
                );
              })}
              {activeTests.length === 0 && (
                <Typography variant="body2" color="text.secondary" p={1}>No active tests found. Add tests in the Lab Catalog first.</Typography>
              )}
            </Stack>
            {selectedTests.length > 0 && (
              <Typography variant="caption" mt={0.5} display="block">
                {selectedTests.length} test(s) selected
              </Typography>
            )}
          </Box>
          <TextField
            label="Notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            multiline rows={2} fullWidth
          />
        </Stack>
        <DialogActions sx={{ mt: 2, px: 0 }}>
          <SecondaryButton onClick={() => setNewOpen(false)}>Cancel</SecondaryButton>
          <PrimaryButton
            onClick={() => createOrder.mutate()}
            disabled={createOrder.isPending || !patientId || selectedTests.length === 0}
          >
            {createOrder.isPending ? 'Creating…' : 'Create Order'}
          </PrimaryButton>
        </DialogActions>
      </AppModal>

      {/* Order Detail Dialog */}
      {selected && (
        <AppModal open title={`Lab Order — ${selected.orderNumber}`} onClose={() => setSelected(null)} maxWidth="md">
          <OrderDetailDialog order={selected} onClose={() => setSelected(null)} />
        </AppModal>
      )}

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={/error|fail|forbidden|permission|denied|invalid|cannot/i.test(toast) ? 'error' : 'success'} onClose={() => setToast('')}>{toast}</Alert>
      </Snackbar>
    </Box>
  );
}
