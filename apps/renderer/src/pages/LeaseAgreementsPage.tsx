import { useState } from 'react';
import { Box, Chip, MenuItem, Snackbar, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { Customer, LeaseAgreement, LeasePayment, LeaseProperty } from '../api/types';
import { DataTable } from '../components/DataTable';
import { AppModal } from '../components/AppModal';
import { PrimaryButton, SecondaryButton } from '../components/buttons';

const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];
const STATUSES    = ['pending', 'active', 'expired', 'terminated'];
const PAY_METHODS = ['cash', 'bank_transfer', 'cheque', 'card', 'other'];

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  active: 'success', pending: 'warning', expired: 'error', terminated: 'default',
};

const EMPTY_FORM = { propertyId: '', customerId: '', startDate: '', endDate: '', rentAmount: '', rentFrequency: 'monthly', depositAmount: '', notes: '' };
const EMPTY_PAY  = { amount: '', paidDate: '', periodStart: '', periodEnd: '', paymentMethod: 'cash', referenceNumber: '', notes: '' };

function fmt(v: string | number): string {
  return parseFloat(String(v)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function LeaseAgreementsPage(): JSX.Element {
  const qc = useQueryClient();
  const [snackbar, setSnackbar]       = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected]       = useState<LeaseAgreement | null>(null);
  const [payOpen, setPayOpen]         = useState(false);
  const [createOpen, setCreateOpen]   = useState(false);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [payForm, setPayForm]         = useState(EMPTY_PAY);

  const { data: agreements = [], isLoading } = useQuery<LeaseAgreement[]>({
    queryKey: ['lease-agreements', statusFilter],
    queryFn: () => apiFetch(`/api/v1/lease/agreements${statusFilter ? `?status=${statusFilter}` : ''}`),
  });

  const { data: properties = [] } = useQuery<LeaseProperty[]>({
    queryKey: ['lease-properties'],
    queryFn: () => apiFetch('/api/v1/lease/properties'),
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: () => apiFetch('/api/v1/customers'),
  });

  const { data: payments = [] } = useQuery<LeasePayment[]>({
    queryKey: ['lease-payments', selected?.id],
    queryFn: () => apiFetch(`/api/v1/lease/agreements/${selected!.id}/payments`),
    enabled: Boolean(selected),
  });

  const createMut = useMutation({
    mutationFn: () => apiFetch('/api/v1/lease/agreements', {
      method: 'POST',
      body: JSON.stringify({ ...form, rentAmount: parseFloat(form.rentAmount) || 0, depositAmount: parseFloat(form.depositAmount) || 0 }),
    }),
    onSuccess: () => {
      setSnackbar('Agreement created.');
      setForm(EMPTY_FORM);
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ['lease-agreements'] });
    },
    onError: (e) => setSnackbar(e instanceof ApiError ? e.detail : 'Could not create agreement.'),
  });

  const payMut = useMutation({
    mutationFn: () => apiFetch(`/api/v1/lease/agreements/${selected!.id}/payments`, {
      method: 'POST',
      body: JSON.stringify({ ...payForm, amount: parseFloat(payForm.amount) || 0 }),
    }),
    onSuccess: () => {
      setSnackbar('Payment recorded.');
      setPayForm(EMPTY_PAY);
      setPayOpen(false);
      qc.invalidateQueries({ queryKey: ['lease-payments', selected?.id] });
      qc.invalidateQueries({ queryKey: ['lease-summary'] });
    },
    onError: (e) => setSnackbar(e instanceof ApiError ? e.detail : 'Could not record payment.'),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/api/v1/lease/agreements/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => {
      setSnackbar('Status updated.');
      qc.invalidateQueries({ queryKey: ['lease-agreements'] });
    },
    onError: (e) => setSnackbar(e instanceof ApiError ? e.detail : 'Could not update status.'),
  });

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>Lease Agreements</Typography>
        <Stack direction="row" spacing={2}>
          <TextField select size="small" label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ minWidth: 130 }}>
            <MenuItem value="">All</MenuItem>
            {STATUSES.map((s) => <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s}</MenuItem>)}
          </TextField>
          <PrimaryButton onClick={() => setCreateOpen(true)}>+ New Agreement</PrimaryButton>
        </Stack>
      </Box>

      {isLoading && <Typography color="text.secondary" mb={2}>Loading…</Typography>}
      <DataTable
        rows={agreements}
        getRowId={(r) => r.id}
        getSearchText={(r) => `${r.property?.name ?? ''} ${r.customer?.name ?? ''}`}
        columns={[
          { key: 'property',   label: 'Property',  render: (r) => r.property?.name ?? '—' },
          { key: 'customer',   label: 'Tenant',     render: (r) => r.customer?.name ?? '—' },
          { key: 'startDate',  label: 'Start',      render: (r) => r.startDate },
          { key: 'endDate',    label: 'End',        render: (r) => r.endDate },
          { key: 'rent',       label: 'Rent',       render: (r) => `${fmt(r.rentAmount)} / ${r.rentFrequency}` },
          { key: 'status',     label: 'Status',     render: (r) => <Chip label={r.status} color={STATUS_COLOR[r.status] ?? 'default'} size="small" /> },
          {
            key: 'actions', label: '', render: (r) => (
              <Stack direction="row" spacing={1}>
                <SecondaryButton size="small" onClick={() => setSelected(r)}>Payments</SecondaryButton>
                {r.status === 'active' && (
                  <SecondaryButton size="small" onClick={() => statusMut.mutate({ id: r.id, status: 'terminated' })}>Terminate</SecondaryButton>
                )}
              </Stack>
            ),
          },
        ]}
      />

      {/* Create modal */}
      <AppModal open={createOpen} onClose={() => setCreateOpen(false)} title="New Lease Agreement"
        actions={<><SecondaryButton onClick={() => setCreateOpen(false)}>Cancel</SecondaryButton><PrimaryButton loading={createMut.isPending} onClick={() => createMut.mutate()}>Create</PrimaryButton></>}
      >
        <Stack spacing={2}>
          <TextField select label="Property" fullWidth value={form.propertyId} onChange={(e) => setForm((p) => ({ ...p, propertyId: e.target.value }))}>
            {properties.map((p) => <MenuItem key={p.id} value={p.id}>{p.name} ({p.type})</MenuItem>)}
          </TextField>
          <TextField select label="Customer / Tenant" fullWidth value={form.customerId} onChange={(e) => setForm((p) => ({ ...p, customerId: e.target.value }))}>
            {customers.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </TextField>
          <Stack direction="row" spacing={2}>
            <TextField label="Start Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} />
            <TextField label="End Date"   type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.endDate}   onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField label="Rent Amount" type="number" fullWidth value={form.rentAmount} onChange={(e) => setForm((p) => ({ ...p, rentAmount: e.target.value }))} />
            <TextField select label="Frequency" fullWidth value={form.rentFrequency} onChange={(e) => setForm((p) => ({ ...p, rentFrequency: e.target.value }))}>
              {FREQUENCIES.map((f) => <MenuItem key={f} value={f} sx={{ textTransform: 'capitalize' }}>{f}</MenuItem>)}
            </TextField>
          </Stack>
          <TextField label="Deposit Amount" type="number" fullWidth value={form.depositAmount} onChange={(e) => setForm((p) => ({ ...p, depositAmount: e.target.value }))} />
          <TextField label="Notes" fullWidth multiline rows={2} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
        </Stack>
      </AppModal>

      {/* Payments panel */}
      <AppModal open={Boolean(selected)} onClose={() => setSelected(null)} title={`Payments — ${selected?.property?.name ?? ''}`}
        actions={<><PrimaryButton onClick={() => setPayOpen(true)}>Record Payment</PrimaryButton><SecondaryButton onClick={() => setSelected(null)}>Close</SecondaryButton></>}
      >
        <Box>
          {payments.length === 0 ? (
            <Typography color="text.secondary">No payments recorded yet.</Typography>
          ) : (
            <DataTable
              rows={payments}
              getRowId={(r) => r.id}
              columns={[
                { key: 'paidDate',       label: 'Date',   render: (r) => r.paidDate ?? '—' },
                { key: 'period',         label: 'Period', render: (r) => `${r.periodStart} → ${r.periodEnd}` },
                { key: 'amount',         label: 'Amount', align: 'right', render: (r) => fmt(r.amount) },
                { key: 'paymentMethod',  label: 'Method', render: (r) => r.paymentMethod ?? '—' },
                { key: 'referenceNumber',label: 'Ref.',   render: (r) => r.referenceNumber ?? '—' },
              ]}
            />
          )}
        </Box>
      </AppModal>

      {/* Record Payment modal */}
      <AppModal open={payOpen} onClose={() => setPayOpen(false)} title="Record Payment"
        actions={<><SecondaryButton onClick={() => setPayOpen(false)}>Cancel</SecondaryButton><PrimaryButton loading={payMut.isPending} onClick={() => payMut.mutate()}>Save</PrimaryButton></>}
      >
        <Stack spacing={2}>
          <TextField label="Amount" type="number" fullWidth value={payForm.amount} onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))} />
          <TextField label="Paid Date" type="date" fullWidth InputLabelProps={{ shrink: true }} value={payForm.paidDate} onChange={(e) => setPayForm((p) => ({ ...p, paidDate: e.target.value }))} />
          <Stack direction="row" spacing={2}>
            <TextField label="Period Start" type="date" fullWidth InputLabelProps={{ shrink: true }} value={payForm.periodStart} onChange={(e) => setPayForm((p) => ({ ...p, periodStart: e.target.value }))} />
            <TextField label="Period End"   type="date" fullWidth InputLabelProps={{ shrink: true }} value={payForm.periodEnd}   onChange={(e) => setPayForm((p) => ({ ...p, periodEnd: e.target.value }))} />
          </Stack>
          <TextField select label="Payment Method" fullWidth value={payForm.paymentMethod} onChange={(e) => setPayForm((p) => ({ ...p, paymentMethod: e.target.value }))}>
            {PAY_METHODS.map((m) => <MenuItem key={m} value={m} sx={{ textTransform: 'capitalize' }}>{m.replace('_', ' ')}</MenuItem>)}
          </TextField>
          <TextField label="Reference Number" fullWidth value={payForm.referenceNumber} onChange={(e) => setPayForm((p) => ({ ...p, referenceNumber: e.target.value }))} />
          <TextField label="Notes" fullWidth multiline rows={2} value={payForm.notes} onChange={(e) => setPayForm((p) => ({ ...p, notes: e.target.value }))} />
        </Stack>
      </AppModal>

      <Snackbar open={Boolean(snackbar)} autoHideDuration={3000} onClose={() => setSnackbar(null)} message={snackbar} />
    </Box>
  );
}
