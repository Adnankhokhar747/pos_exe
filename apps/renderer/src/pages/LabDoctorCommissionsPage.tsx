import { useState } from 'react';
import {
  Alert, Box, Button, Chip, DialogActions, Divider,
  FormControl, InputLabel, MenuItem, Select,
  Snackbar, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import HistoryIcon from '@mui/icons-material/History';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { LabDoctorCommissionSummary, LabCommissionPayment } from '../api/types';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { AppModal } from '../components/AppModal';
import { PrimaryButton, SecondaryButton } from '../components/buttons';
import { useCurrency } from '../hooks/useCurrency';

const METHODS = [
  { value: 'cash',          label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque',        label: 'Cheque' },
  { value: 'other',         label: 'Other' },
];

function PaymentHistoryDialog({ doctorId, doctorName, onClose }: { doctorId: string; doctorName: string; onClose: () => void }) {
  const cur = useCurrency();
  const { data: payments = [], isLoading } = useQuery<LabCommissionPayment[]>({
    queryKey: ['lab-commission-payments', doctorId],
    queryFn: () => apiFetch(`/api/v1/hospital/lab/commissions/${doctorId}/payments`),
  });

  return (
    <>
      <Typography variant="subtitle2" color="text.secondary" mb={2}>
        Commission payment history for <strong>{doctorName}</strong>
      </Typography>
      {isLoading ? (
        <Typography color="text.secondary">Loading…</Typography>
      ) : payments.length === 0 ? (
        <Alert severity="info">No payments recorded yet.</Alert>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Method</TableCell>
              <TableCell>Notes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {payments.map(p => (
              <TableRow key={p.id}>
                <TableCell>{new Date(p.paidAt).toLocaleDateString()}</TableCell>
                <TableCell><strong>{cur.fmt(p.amount)}</strong></TableCell>
                <TableCell><Chip size="small" label={p.method.replace('_', ' ')} /></TableCell>
                <TableCell>{p.notes ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <DialogActions sx={{ mt: 2, px: 0 }}>
        <SecondaryButton onClick={onClose}>Close</SecondaryButton>
      </DialogActions>
    </>
  );
}

export function LabDoctorCommissionsPage() {
  const qc = useQueryClient();
  const cur = useCurrency();

  const [payTarget, setPayTarget] = useState<LabDoctorCommissionSummary | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payNotes, setPayNotes] = useState('');

  const [historyTarget, setHistoryTarget] = useState<LabDoctorCommissionSummary | null>(null);

  const [toast, setToast] = useState('');

  const { data: commissions = [], isLoading } = useQuery<LabDoctorCommissionSummary[]>({
    queryKey: ['lab-doctor-commissions'],
    queryFn: () => apiFetch('/api/v1/hospital/lab/commissions'),
  });

  const recordPayment = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/hospital/lab/commissions/payments', {
        method: 'POST',
        body: {
          doctorId: payTarget!.doctorId,
          amount: parseFloat(payAmount),
          method: payMethod,
          notes: payNotes || null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lab-doctor-commissions'] });
      qc.invalidateQueries({ queryKey: ['lab-commission-payments', payTarget?.doctorId] });
      setPayTarget(null);
      setPayAmount(''); setPayMethod('cash'); setPayNotes('');
      setToast('Payment recorded successfully.');
    },
    onError: (e: ApiError) => setToast(e.message ?? 'Error recording payment.'),
  });

  const totals = {
    earned: commissions.reduce((s, r) => s + r.commissionEarned, 0),
    paid:   commissions.reduce((s, r) => s + r.totalPaid, 0),
    due:    commissions.reduce((s, r) => s + r.balanceDue, 0),
  };

  const columns: DataTableColumn<LabDoctorCommissionSummary>[] = [
    {
      key: 'doctorName', label: 'Doctor',
      render: r => (
        <Box>
          <Typography fontWeight={600} variant="body2">{r.doctorName}</Typography>
          {r.specialization && <Typography variant="caption" color="text.secondary">{r.specialization}</Typography>}
        </Box>
      ),
    },
    {
      key: 'labCommissionPct', label: 'Comm %',
      render: r => (
        <Chip
          size="small"
          label={`${r.labCommissionPct.toFixed(1)}%`}
          color={r.labCommissionPct > 0 ? 'primary' : 'default'}
          variant="outlined"
        />
      ),
    },
    { key: 'ordersCount',      label: 'Orders',       render: r => r.ordersCount },
    { key: 'totalLabAmount',   label: 'Lab Total',    render: r => cur.fmt(r.totalLabAmount) },
    {
      key: 'commissionEarned', label: 'Earned',
      render: r => (
        <Typography fontWeight={600} color={r.commissionEarned > 0 ? 'primary.main' : 'text.secondary'} variant="body2">
          {cur.fmt(r.commissionEarned)}
        </Typography>
      ),
    },
    { key: 'totalPaid',   label: 'Paid',        render: r => cur.fmt(r.totalPaid) },
    {
      key: 'balanceDue', label: 'Balance Due',
      render: r => (
        <Chip
          size="small"
          label={cur.fmt(r.balanceDue)}
          color={r.balanceDue > 0.005 ? 'warning' : 'success'}
          variant={r.balanceDue > 0.005 ? 'filled' : 'outlined'}
        />
      ),
    },
    {
      key: 'actions', label: '',
      render: r => (
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            startIcon={<HistoryIcon />}
            onClick={() => setHistoryTarget(r)}
          >
            History
          </Button>
          {r.balanceDue > 0.005 && (
            <Button
              size="small"
              variant="contained"
              color="primary"
              startIcon={<MonetizationOnIcon />}
              onClick={() => { setPayTarget(r); setPayAmount(r.balanceDue.toFixed(2)); }}
            >
              Pay
            </Button>
          )}
        </Stack>
      ),
    },
  ];

  return (
    <Box p={3}>
      <Stack direction="row" alignItems="center" spacing={1} mb={3}>
        <MonetizationOnIcon color="primary" />
        <Typography variant="h5" fontWeight={600}>Lab Doctor Commissions</Typography>
      </Stack>

      {/* Summary cards */}
      <Stack direction="row" spacing={2} mb={3} flexWrap="wrap">
        {[
          { label: 'Total Earned', value: totals.earned, color: 'primary.main' },
          { label: 'Total Paid',   value: totals.paid,   color: 'success.main' },
          { label: 'Total Due',    value: totals.due,    color: totals.due > 0 ? 'warning.main' : 'success.main' },
        ].map(card => (
          <Box
            key={card.label}
            sx={{
              border: '1px solid', borderColor: 'divider', borderRadius: 2,
              p: 2, minWidth: 160, flex: '1 1 160px',
            }}
          >
            <Typography variant="caption" color="text.secondary">{card.label}</Typography>
            <Typography variant="h6" fontWeight={700} color={card.color}>{cur.fmt(card.value)}</Typography>
          </Box>
        ))}
      </Stack>

      <Divider sx={{ mb: 2 }} />

      <DataTable
        columns={columns}
        rows={commissions}
        getRowId={r => r.doctorId}
        isLoading={isLoading}
        emptyMessage="No doctors found. Add doctors and set their lab commission percentage first."
      />

      {/* Pay Modal */}
      <AppModal
        open={!!payTarget}
        onClose={() => setPayTarget(null)}
        title={`Record Payment — ${payTarget?.doctorName ?? ''}`}
        maxWidth="sm"
      >
        <Stack spacing={2} mt={1}>
          <Alert severity="info" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
            <Stack direction="row" justifyContent="space-between" flexWrap="wrap" gap={1}>
              <span>Commission earned: <strong>{cur.fmt(payTarget?.commissionEarned ?? 0)}</strong></span>
              <span>Already paid: <strong>{cur.fmt(payTarget?.totalPaid ?? 0)}</strong></span>
              <span>Balance due: <strong>{cur.fmt(payTarget?.balanceDue ?? 0)}</strong></span>
            </Stack>
          </Alert>
          <TextField
            label="Amount *"
            type="number"
            value={payAmount}
            onChange={e => setPayAmount(e.target.value)}
            fullWidth
            inputProps={{ min: 0.01, step: 0.01 }}
          />
          <FormControl fullWidth>
            <InputLabel>Payment Method</InputLabel>
            <Select value={payMethod} label="Payment Method" onChange={e => setPayMethod(e.target.value)}>
              {METHODS.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField
            label="Notes"
            value={payNotes}
            onChange={e => setPayNotes(e.target.value)}
            multiline rows={2} fullWidth
            placeholder="Optional reference or remarks"
          />
        </Stack>
        <DialogActions sx={{ mt: 2, px: 0 }}>
          <SecondaryButton onClick={() => setPayTarget(null)}>Cancel</SecondaryButton>
          <PrimaryButton
            onClick={() => recordPayment.mutate()}
            disabled={recordPayment.isPending || !payAmount || parseFloat(payAmount) <= 0}
          >
            {recordPayment.isPending ? 'Recording…' : 'Record Payment'}
          </PrimaryButton>
        </DialogActions>
      </AppModal>

      {/* History Modal */}
      {historyTarget && (
        <AppModal
          open
          onClose={() => setHistoryTarget(null)}
          title={`Payment History — ${historyTarget.doctorName}`}
          maxWidth="sm"
        >
          <PaymentHistoryDialog
            doctorId={historyTarget.doctorId}
            doctorName={historyTarget.doctorName}
            onClose={() => setHistoryTarget(null)}
          />
        </AppModal>
      )}

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert
          severity={/error|fail|forbidden|denied/i.test(toast) ? 'error' : 'success'}
          onClose={() => setToast('')}
        >
          {toast}
        </Alert>
      </Snackbar>
    </Box>
  );
}
