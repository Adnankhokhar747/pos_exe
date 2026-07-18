import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  MenuItem,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type {
  Customer,
  LeaseAgreement,
  LeaseCategory,
  LeaseFrequency,
  LeaseInstallment,
  LeaseInstallmentStatus,
} from '../api/types';
import { DataTable } from '../components/DataTable';
import { AppModal } from '../components/AppModal';
import { PrimaryButton, SecondaryButton } from '../components/buttons';

const CATEGORIES: { value: LeaseCategory; label: string }[] = [
  { value: 'property',    label: 'Property' },
  { value: 'vehicle',     label: 'Vehicle' },
  { value: 'appliance',   label: 'Appliance' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'other',       label: 'Other' },
];

const FREQUENCIES: { value: LeaseFrequency; label: string }[] = [
  { value: 'weekly',    label: 'Weekly' },
  { value: 'monthly',   label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly (every 3 months)' },
  { value: 'yearly',    label: 'Yearly' },
];

const PAY_METHODS = ['cash', 'bank_transfer', 'cheque', 'card', 'other'];

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
  active: 'success', completed: 'info', cancelled: 'default', defaulted: 'error',
};

const INST_COLOR: Record<LeaseInstallmentStatus, 'success' | 'warning' | 'error' | 'default'> = {
  paid: 'success', pending: 'default', partial: 'warning', overdue: 'error',
};

const EMPTY_FORM = {
  title: '', category: 'other' as LeaseCategory, customerId: '',
  totalAmount: '', downPayment: '0',
  installmentCount: '12', frequency: 'monthly' as LeaseFrequency,
  startDate: '', firstInstallmentDate: '', notes: '',
};
const EMPTY_PAY = {
  paidAmount: '', paidDate: new Date().toISOString().slice(0, 10),
  paymentMethod: 'cash', referenceNumber: '', notes: '',
};

function fmt(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function CategoryBadge({ value }: { value: LeaseCategory }) {
  const map: Record<LeaseCategory, string> = {
    property: '🏠', vehicle: '🚗', appliance: '🏭', electronics: '📱', other: '📋',
  };
  return <span style={{ fontSize: '0.72rem' }}>{map[value] ?? '📋'} {CATEGORIES.find(c => c.value === value)?.label ?? value}</span>;
}

export function LeaseAgreementsPage(): JSX.Element {
  const qc = useQueryClient();
  const [snackbar, setSnackbar]       = useState<{ msg: string; sev?: 'success' | 'error' } | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [catFilter, setCatFilter]     = useState('');

  const [createOpen, setCreateOpen]   = useState(false);
  const [form, setForm]               = useState(EMPTY_FORM);

  const [detailId, setDetailId]       = useState<string | null>(null);
  const [payInstallment, setPayInstallment] = useState<LeaseInstallment | null>(null);
  const [payForm, setPayForm]         = useState(EMPTY_PAY);

  /* ── Queries ─────────────────────────────────────────────────────────── */

  const { data: agreements = [], isLoading } = useQuery<LeaseAgreement[]>({
    queryKey: ['lease-agreements', statusFilter, catFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (catFilter)    params.set('category', catFilter);
      return apiFetch(`/api/v1/lease/agreements${params.size ? `?${params}` : ''}`);
    },
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: () => apiFetch('/api/v1/customers'),
  });

  const { data: detail, isLoading: detailLoading } = useQuery<LeaseAgreement>({
    queryKey: ['lease-agreement-detail', detailId],
    queryFn: () => apiFetch(`/api/v1/lease/agreements/${detailId}`),
    enabled: Boolean(detailId),
  });

  /* ── Computed preview ────────────────────────────────────────────────── */
  const previewInstallment = useMemo(() => {
    const total    = parseFloat(form.totalAmount) || 0;
    const down     = parseFloat(form.downPayment) || 0;
    const financed = Math.max(0, total - down);
    const count    = parseInt(form.installmentCount, 10) || 1;
    return financed > 0 ? financed / count : 0;
  }, [form.totalAmount, form.downPayment, form.installmentCount]);

  /* ── Mutations ───────────────────────────────────────────────────────── */

  const createMut = useMutation({
    mutationFn: () => apiFetch('/api/v1/lease/agreements', {
      method: 'POST',
      body: JSON.stringify({
        ...form,
        totalAmount:      parseFloat(form.totalAmount) || 0,
        downPayment:      parseFloat(form.downPayment) || 0,
        installmentCount: parseInt(form.installmentCount, 10) || 1,
      }),
    }),
    onSuccess: () => {
      setSnackbar({ msg: 'Agreement created and installments generated.', sev: 'success' });
      setForm(EMPTY_FORM);
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ['lease-agreements'] });
      qc.invalidateQueries({ queryKey: ['lease-summary'] });
    },
    onError: (e) => setSnackbar({ msg: e instanceof ApiError ? e.detail : 'Could not create agreement.', sev: 'error' }),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/api/v1/lease/agreements/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => {
      setSnackbar({ msg: 'Status updated.', sev: 'success' });
      qc.invalidateQueries({ queryKey: ['lease-agreements'] });
      if (detailId) qc.invalidateQueries({ queryKey: ['lease-agreement-detail', detailId] });
    },
    onError: (e) => setSnackbar({ msg: e instanceof ApiError ? e.detail : 'Failed.', sev: 'error' }),
  });

  const payMut = useMutation({
    mutationFn: () => apiFetch(
      `/api/v1/lease/agreements/${detailId}/installments/${payInstallment!.id}/pay`,
      {
        method: 'POST',
        body: JSON.stringify({
          ...payForm,
          paidAmount: parseFloat(payForm.paidAmount) || 0,
        }),
      },
    ),
    onSuccess: () => {
      setSnackbar({ msg: 'Payment recorded.', sev: 'success' });
      setPayInstallment(null);
      setPayForm(EMPTY_PAY);
      qc.invalidateQueries({ queryKey: ['lease-agreement-detail', detailId] });
      qc.invalidateQueries({ queryKey: ['lease-agreements'] });
      qc.invalidateQueries({ queryKey: ['lease-summary'] });
    },
    onError: (e) => setSnackbar({ msg: e instanceof ApiError ? e.detail : 'Could not record payment.', sev: 'error' }),
  });

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  function openPay(inst: LeaseInstallment) {
    setPayInstallment(inst);
    setPayForm({ ...EMPTY_PAY, paidAmount: String(inst.amount) });
  }

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <Box p={2.5}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>Financing Agreements</Typography>
        <PrimaryButton onClick={() => setCreateOpen(true)}>+ New Agreement</PrimaryButton>
      </Box>

      {/* Filters */}
      <Stack direction="row" spacing={1.5} mb={2}>
        <TextField select size="small" label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ minWidth: 130 }}>
          <MenuItem value="">All</MenuItem>
          {(['active', 'completed', 'cancelled', 'defaulted'] as const).map((s) => (
            <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s}</MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="Category" value={catFilter} onChange={(e) => setCatFilter(e.target.value)} sx={{ minWidth: 130 }}>
          <MenuItem value="">All</MenuItem>
          {CATEGORIES.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
        </TextField>
      </Stack>

      {/* List */}
      {isLoading && <Typography color="text.secondary" mb={1}>Loading…</Typography>}
      <DataTable
        rows={agreements}
        getRowId={(r) => r.id}
        getSearchText={(r) => `${r.title} ${r.customerName ?? ''}`}
        columns={[
          { key: 'title',    label: 'Item / Agreement', render: (r) => (
            <Box>
              <Typography fontWeight={600} fontSize="0.8rem">{r.title}</Typography>
              <Typography variant="caption" color="text.secondary"><CategoryBadge value={r.category} /></Typography>
            </Box>
          )},
          { key: 'customer', label: 'Customer',  render: (r) => (
            <Box>
              <Typography fontSize="0.78rem">{r.customerName ?? '—'}</Typography>
              {r.customerPhone && <Typography variant="caption" color="text.secondary">{r.customerPhone}</Typography>}
            </Box>
          )},
          { key: 'total',    label: 'Total',     align: 'right', render: (r) => fmt(r.totalAmount) },
          { key: 'inst',     label: 'Installment', align: 'right', render: (r) => (
            <Box textAlign="right">
              <Typography fontSize="0.78rem" fontWeight={600}>{fmt(r.installmentAmount)}</Typography>
              <Typography variant="caption" color="text.secondary">/ {r.frequency}</Typography>
            </Box>
          )},
          { key: 'progress', label: 'Progress', render: (r) => (
            <Box>
              <Typography fontSize="0.72rem" color="text.secondary">
                {r.paidInstallments ?? 0} / {r.installmentCount} paid
              </Typography>
              <Box sx={{ height: 4, borderRadius: 2, bgcolor: 'grey.200', mt: 0.5 }}>
                <Box sx={{
                  height: '100%', borderRadius: 2, bgcolor: 'success.main',
                  width: `${r.installmentCount > 0 ? ((r.paidInstallments ?? 0) / r.installmentCount) * 100 : 0}%`,
                  transition: 'width 0.3s',
                }} />
              </Box>
            </Box>
          )},
          { key: 'status',   label: 'Status', render: (r) => (
            <Chip label={r.status} color={STATUS_COLOR[r.status] ?? 'default'} size="small" sx={{ textTransform: 'capitalize' }} />
          )},
          { key: 'actions',  label: '', render: (r) => (
            <Stack direction="row" spacing={0.5}>
              <SecondaryButton size="small" onClick={() => setDetailId(r.id)}>Ledger</SecondaryButton>
              {r.status === 'active' && (
                <SecondaryButton size="small" color="error" onClick={() => statusMut.mutate({ id: r.id, status: 'cancelled' })}>Cancel</SecondaryButton>
              )}
            </Stack>
          )},
        ]}
      />

      {/* ── Create modal ──────────────────────────────────────────────── */}
      <AppModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Financing Agreement"
        maxWidth="sm"
        actions={
          <>
            <SecondaryButton onClick={() => setCreateOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton loading={createMut.isPending} onClick={() => createMut.mutate()}>Create & Generate Plan</PrimaryButton>
          </>
        }
      >
        <Stack spacing={2}>
          <TextField label="What is being financed?" fullWidth placeholder="e.g. Honda CB150 Bike, Samsung TV, Plot #45…" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
          <Stack direction="row" spacing={2}>
            <TextField select label="Category" fullWidth value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as LeaseCategory }))}>
              {CATEGORIES.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
            </TextField>
            <TextField select label="Customer" fullWidth value={form.customerId} onChange={(e) => setForm((p) => ({ ...p, customerId: e.target.value }))}>
              {customers.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
          </Stack>

          <Divider><Typography variant="caption" color="text.secondary">Amount & Installments</Typography></Divider>

          <Stack direction="row" spacing={2}>
            <TextField label="Total Amount" type="number" fullWidth value={form.totalAmount} onChange={(e) => setForm((p) => ({ ...p, totalAmount: e.target.value }))} inputProps={{ min: 0, step: 0.01 }} />
            <TextField label="Down Payment" type="number" fullWidth value={form.downPayment} onChange={(e) => setForm((p) => ({ ...p, downPayment: e.target.value }))} inputProps={{ min: 0, step: 0.01 }} />
          </Stack>

          {parseFloat(form.totalAmount) > 0 && (
            <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, px: 2, py: 1 }}>
              <Typography variant="caption" color="text.secondary">Financed Amount</Typography>
              <Typography fontWeight={700} color="primary.main">
                {fmt(Math.max(0, (parseFloat(form.totalAmount) || 0) - (parseFloat(form.downPayment) || 0)))}
              </Typography>
            </Box>
          )}

          <Stack direction="row" spacing={2}>
            <TextField label="No. of Installments" type="number" fullWidth value={form.installmentCount} onChange={(e) => setForm((p) => ({ ...p, installmentCount: e.target.value }))} inputProps={{ min: 1, max: 600 }} />
            <TextField select label="Frequency" fullWidth value={form.frequency} onChange={(e) => setForm((p) => ({ ...p, frequency: e.target.value as LeaseFrequency }))}>
              {FREQUENCIES.map((f) => <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>)}
            </TextField>
          </Stack>

          {/* Preview */}
          {previewInstallment > 0 && (
            <Box sx={{ bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200', borderRadius: 1, px: 2, py: 1.5 }}>
              <Typography variant="caption" color="text.secondary" display="block">Each {form.frequency} installment</Typography>
              <Typography variant="h5" fontWeight={700} color="primary.main">{fmt(previewInstallment)}</Typography>
              <Typography variant="caption" color="text.secondary">
                {form.installmentCount} × {fmt(previewInstallment)} = {fmt(previewInstallment * parseInt(form.installmentCount, 10))} total
              </Typography>
            </Box>
          )}

          <Divider><Typography variant="caption" color="text.secondary">Dates</Typography></Divider>

          <Stack direction="row" spacing={2}>
            <TextField label="Agreement Start Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} />
            <TextField label="First Installment Due" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.firstInstallmentDate} onChange={(e) => setForm((p) => ({ ...p, firstInstallmentDate: e.target.value }))} />
          </Stack>
          <TextField label="Notes" fullWidth multiline rows={2} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
        </Stack>
      </AppModal>

      {/* ── Detail / Ledger modal ─────────────────────────────────────── */}
      <AppModal
        open={Boolean(detailId)}
        onClose={() => setDetailId(null)}
        title={detail ? `${detail.title} — Installment Ledger` : 'Loading…'}
        maxWidth="md"
        actions={<SecondaryButton onClick={() => setDetailId(null)}>Close</SecondaryButton>}
      >
        {detailLoading || !detail ? (
          <Typography color="text.secondary">Loading…</Typography>
        ) : (
          <Box>
            {/* Agreement header */}
            <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1.5, mb: 2 }}>
              <Stack direction="row" flexWrap="wrap" gap={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Customer</Typography>
                  <Typography fontWeight={600}>{detail.customerName ?? '—'}</Typography>
                  {detail.customerPhone && <Typography variant="caption" color="text.secondary">{detail.customerPhone}</Typography>}
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Total Amount</Typography>
                  <Typography fontWeight={600}>{fmt(detail.totalAmount)}</Typography>
                </Box>
                {detail.downPayment > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Down Payment</Typography>
                    <Typography fontWeight={600}>{fmt(detail.downPayment)}</Typography>
                  </Box>
                )}
                <Box>
                  <Typography variant="caption" color="text.secondary">Financed</Typography>
                  <Typography fontWeight={600}>{fmt(detail.financedAmount)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Each {detail.frequency}</Typography>
                  <Typography fontWeight={600}>{fmt(detail.installmentAmount)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Status</Typography>
                  <Box><Chip label={detail.status} color={STATUS_COLOR[detail.status] ?? 'default'} size="small" sx={{ textTransform: 'capitalize', mt: 0.3 }} /></Box>
                </Box>
              </Stack>
            </Box>

            {/* Summary cards */}
            {detail.summary && (
              <Stack direction="row" spacing={1.5} mb={2} flexWrap="wrap">
                <SummaryCard label="Total Paid"    value={fmt(detail.summary.totalPaid)}    color="success.main" sub={`${detail.summary.paidCount} installments`} />
                <SummaryCard label="Remaining"     value={fmt(detail.summary.totalPending)} color="warning.main" sub={`${detail.summary.pendingCount} installments`} />
                {detail.summary.overdueCount > 0 && (
                  <SummaryCard label="Overdue"     value={String(detail.summary.overdueCount)} color="error.main" sub="past due date" />
                )}
              </Stack>
            )}

            {/* Installments table */}
            <Box sx={{ maxHeight: 380, overflowY: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Due Date</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Paid Date</TableCell>
                    <TableCell align="right">Paid Amt</TableCell>
                    <TableCell>Method</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(detail.installments ?? []).map((inst) => (
                    <TableRow key={inst.id} sx={{
                      bgcolor: inst.status === 'overdue' ? 'error.50' : inst.status === 'paid' ? 'success.50' : undefined,
                    }}>
                      <TableCell>{inst.installmentNumber}</TableCell>
                      <TableCell>{inst.dueDate}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>{fmt(inst.amount)}</TableCell>
                      <TableCell>
                        <Chip label={inst.status} color={INST_COLOR[inst.status]} size="small" sx={{ textTransform: 'capitalize' }} />
                      </TableCell>
                      <TableCell>{inst.paidDate ?? '—'}</TableCell>
                      <TableCell align="right">{inst.paidAmount != null ? fmt(inst.paidAmount) : '—'}</TableCell>
                      <TableCell sx={{ textTransform: 'capitalize' }}>{inst.paymentMethod?.replace('_', ' ') ?? '—'}</TableCell>
                      <TableCell>
                        {(inst.status === 'pending' || inst.status === 'overdue' || inst.status === 'partial') && (
                          <PrimaryButton size="small" onClick={() => openPay(inst)}>Pay</PrimaryButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Box>
        )}
      </AppModal>

      {/* ── Pay installment modal ─────────────────────────────────────── */}
      <AppModal
        open={Boolean(payInstallment)}
        onClose={() => setPayInstallment(null)}
        title={payInstallment ? `Pay Installment #${payInstallment.installmentNumber}` : ''}
        maxWidth="xs"
        actions={
          <>
            <SecondaryButton onClick={() => setPayInstallment(null)}>Cancel</SecondaryButton>
            <PrimaryButton loading={payMut.isPending} onClick={() => payMut.mutate()}>Record Payment</PrimaryButton>
          </>
        }
      >
        {payInstallment && (
          <Stack spacing={2}>
            <Alert severity="info" sx={{ py: 0.5 }}>
              Due: {payInstallment.dueDate} &nbsp;|&nbsp; Amount due: <strong>{fmt(payInstallment.amount)}</strong>
            </Alert>
            <TextField label="Paid Amount" type="number" fullWidth value={payForm.paidAmount} onChange={(e) => setPayForm((p) => ({ ...p, paidAmount: e.target.value }))} inputProps={{ min: 0.01, step: 0.01 }} />
            <TextField label="Payment Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={payForm.paidDate} onChange={(e) => setPayForm((p) => ({ ...p, paidDate: e.target.value }))} />
            <TextField select label="Payment Method" fullWidth value={payForm.paymentMethod} onChange={(e) => setPayForm((p) => ({ ...p, paymentMethod: e.target.value }))}>
              {PAY_METHODS.map((m) => <MenuItem key={m} value={m} sx={{ textTransform: 'capitalize' }}>{m.replace('_', ' ')}</MenuItem>)}
            </TextField>
            <TextField label="Reference Number" fullWidth value={payForm.referenceNumber} onChange={(e) => setPayForm((p) => ({ ...p, referenceNumber: e.target.value }))} />
            <TextField label="Notes" fullWidth multiline rows={2} value={payForm.notes} onChange={(e) => setPayForm((p) => ({ ...p, notes: e.target.value }))} />
          </Stack>
        )}
      </AppModal>

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={3500}
        onClose={() => setSnackbar(null)}
        message={snackbar?.msg}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}

function SummaryCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 120 }}>
      <CardContent sx={{ py: '10px !important' }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography fontWeight={700} color={color} fontSize="1rem">{value}</Typography>
        {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
      </CardContent>
    </Card>
  );
}
