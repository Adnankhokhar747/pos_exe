import { useState } from 'react';
import {
  Alert, Box, Button, Chip, DialogActions, Divider,
  FormControl, InputLabel, MenuItem, Select,
  Snackbar, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import MoneyOffIcon from '@mui/icons-material/MoneyOff';
import AddIcon from '@mui/icons-material/Add';
import BlockIcon from '@mui/icons-material/Block';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { HrAdvance, HrEmployee } from '../api/types';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { AppModal } from '../components/AppModal';
import { PrimaryButton, SecondaryButton } from '../components/buttons';
import { useCurrency } from '../hooks/useCurrency';

const EMPTY_FORM = {
  employeeId: '',
  amount: '',
  deductionType: 'recurring' as 'full_once' | 'recurring',
  monthlyInstallment: '',
  issuedDate: new Date().toISOString().slice(0, 10),
  notes: '',
};

function statusChip(status: HrAdvance['status']) {
  if (status === 'active')    return <Chip size="small" label="Active"    color="primary" />;
  if (status === 'completed') return <Chip size="small" label="Completed" color="success" />;
  return                             <Chip size="small" label="Cancelled" color="default" />;
}

export function HrAdvancesPage() {
  const qc  = useQueryClient();
  const cur = useCurrency();

  const [filterStatus, setFilterStatus] = useState('active');
  const [filterEmp, setFilterEmp]       = useState('');
  const [createOpen, setCreateOpen]     = useState(false);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [toast, setToast]               = useState('');

  const { data: employees = [] } = useQuery<HrEmployee[]>({
    queryKey: ['hr-employees-all'],
    queryFn: () => apiFetch('/api/v1/hr/employees'),
  });

  const params = new URLSearchParams();
  if (filterStatus) params.set('status', filterStatus);
  if (filterEmp)    params.set('employeeId', filterEmp);

  const { data: advances = [], isLoading } = useQuery<HrAdvance[]>({
    queryKey: ['hr-advances', filterStatus, filterEmp],
    queryFn: () => apiFetch(`/api/v1/hr/advances?${params}`),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/hr/advances', {
        method: 'POST',
        body: {
          employeeId:        form.employeeId,
          amount:            parseFloat(form.amount),
          deductionType:     form.deductionType,
          monthlyInstallment: form.deductionType === 'recurring' && form.monthlyInstallment
            ? parseFloat(form.monthlyInstallment)
            : undefined,
          issuedDate: form.issuedDate,
          notes:      form.notes || undefined,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-advances'] });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      setToast('Advance created successfully.');
    },
    onError: (e: ApiError) => setToast(e.message ?? 'Failed to create advance.'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/hr/advances/${id}/cancel`, { method: 'PATCH' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-advances'] });
      setToast('Advance cancelled.');
    },
    onError: (e: ApiError) => setToast(e.message ?? 'Failed to cancel advance.'),
  });

  const totals = {
    issued:    advances.filter(a => a.status === 'active').reduce((s, a) => s + a.amount, 0),
    remaining: advances.filter(a => a.status === 'active').reduce((s, a) => s + a.remainingBalance, 0),
    recovered: advances.filter(a => a.status !== 'cancelled').reduce((s, a) => s + (a.amount - a.remainingBalance), 0),
  };

  const empOptions = employees.filter(e => e.isActive);

  const canSubmit =
    form.employeeId &&
    parseFloat(form.amount) > 0 &&
    form.issuedDate &&
    (form.deductionType === 'full_once' || parseFloat(form.monthlyInstallment) > 0);

  const columns: DataTableColumn<HrAdvance>[] = [
    {
      key: 'employeeName', label: 'Employee',
      render: r => (
        <Box>
          <Typography fontWeight={600} variant="body2">{r.employeeName}</Typography>
          <Typography variant="caption" color="text.secondary">
            {r.employeeCode}{r.department ? ` · ${r.department}` : ''}
          </Typography>
        </Box>
      ),
    },
    {
      key: 'amount', label: 'Amount',
      render: r => cur.fmt(r.amount),
    },
    {
      key: 'remainingBalance', label: 'Remaining',
      render: r => (
        <Typography
          fontWeight={600}
          color={r.remainingBalance > 0 && r.status === 'active' ? 'warning.main' : 'text.secondary'}
          variant="body2"
        >
          {cur.fmt(r.remainingBalance)}
        </Typography>
      ),
    },
    {
      key: 'deductionType', label: 'Deduction',
      render: r => r.deductionType === 'full_once'
        ? <Chip size="small" label="Full Once" color="error" variant="outlined" />
        : (
          <Tooltip title={`${r.monthlyInstallment != null ? cur.fmt(r.monthlyInstallment) : '—'} / month`}>
            <Chip size="small" label="Recurring" color="primary" variant="outlined" />
          </Tooltip>
        ),
    },
    {
      key: 'installmentsPaid', label: 'Progress',
      render: r => r.totalInstallments
        ? `${r.installmentsPaid} / ${r.totalInstallments}`
        : `${r.installmentsPaid} paid`,
    },
    {
      key: 'issuedDate', label: 'Issued',
      render: r => new Date(r.issuedDate).toLocaleDateString(),
    },
    {
      key: 'status', label: 'Status',
      render: r => statusChip(r.status),
    },
    {
      key: 'actions', label: '',
      render: r => r.status === 'active' ? (
        <Button
          size="small"
          color="error"
          startIcon={<BlockIcon />}
          onClick={() => cancelMutation.mutate(r.id)}
          disabled={cancelMutation.isPending}
        >
          Cancel
        </Button>
      ) : null,
    },
  ];

  return (
    <Box p={3}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <MoneyOffIcon color="primary" />
          <Typography variant="h5" fontWeight={600}>Employee Advances</Typography>
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          New Advance
        </Button>
      </Stack>

      <Typography variant="body2" color="text.secondary" mb={3}>
        Salary advances issued to employees. Deductions are automatically applied during payroll generation.
      </Typography>

      {/* Summary cards */}
      <Stack direction="row" spacing={2} mb={3} flexWrap="wrap">
        {[
          { label: 'Active Issued',   value: totals.issued,     color: 'text.primary' },
          { label: 'Total Remaining', value: totals.remaining,  color: totals.remaining > 0 ? 'warning.main' : 'success.main' },
          { label: 'Total Recovered', value: totals.recovered,  color: 'success.main' },
        ].map(card => (
          <Box
            key={card.label}
            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2, minWidth: 160, flex: '1 1 160px' }}
          >
            <Typography variant="caption" color="text.secondary">{card.label}</Typography>
            <Typography variant="h6" fontWeight={700} color={card.color}>{cur.fmt(card.value)}</Typography>
          </Box>
        ))}
      </Stack>

      <Divider sx={{ mb: 2 }} />

      {/* Filters */}
      <Stack direction="row" spacing={2} mb={2} flexWrap="wrap">
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select value={filterStatus} label="Status" onChange={e => setFilterStatus(e.target.value)}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Employee</InputLabel>
          <Select value={filterEmp} label="Employee" onChange={e => setFilterEmp(e.target.value)}>
            <MenuItem value="">All Employees</MenuItem>
            {empOptions.map(e => (
              <MenuItem key={e.id} value={e.id}>{e.name} ({e.employeeCode})</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <DataTable
        columns={columns}
        rows={advances}
        getRowId={r => r.id}
        isLoading={isLoading}
        emptyMessage="No advances found."
      />

      {/* Create Modal */}
      <AppModal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setForm(EMPTY_FORM); }}
        title="New Employee Advance"
        maxWidth="sm"
      >
        <Stack spacing={2} mt={1}>
          <FormControl fullWidth>
            <InputLabel>Employee *</InputLabel>
            <Select
              value={form.employeeId}
              label="Employee *"
              onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}
            >
              {empOptions.map(e => (
                <MenuItem key={e.id} value={e.id}>{e.name} ({e.employeeCode})</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Advance Amount *"
            type="number"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            fullWidth
            inputProps={{ min: 0.01, step: 0.01 }}
          />

          <FormControl fullWidth>
            <InputLabel>Deduction Type *</InputLabel>
            <Select
              value={form.deductionType}
              label="Deduction Type *"
              onChange={e => setForm(f => ({ ...f, deductionType: e.target.value as 'full_once' | 'recurring' }))}
            >
              <MenuItem value="full_once">Full Once — deduct entire amount in next payroll</MenuItem>
              <MenuItem value="recurring">Recurring — deduct fixed monthly installment</MenuItem>
            </Select>
          </FormControl>

          {form.deductionType === 'recurring' && (
            <TextField
              label="Monthly Installment *"
              type="number"
              value={form.monthlyInstallment}
              onChange={e => setForm(f => ({ ...f, monthlyInstallment: e.target.value }))}
              fullWidth
              inputProps={{ min: 0.01, step: 0.01 }}
              helperText={
                form.amount && form.monthlyInstallment && parseFloat(form.monthlyInstallment) > 0
                  ? `≈ ${Math.ceil(parseFloat(form.amount) / parseFloat(form.monthlyInstallment))} installments`
                  : undefined
              }
            />
          )}

          <TextField
            label="Issued Date *"
            type="date"
            value={form.issuedDate}
            onChange={e => setForm(f => ({ ...f, issuedDate: e.target.value }))}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            label="Notes"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            multiline rows={2}
            fullWidth
            placeholder="Optional reason or reference"
          />
        </Stack>
        <DialogActions sx={{ mt: 2, px: 0 }}>
          <SecondaryButton onClick={() => { setCreateOpen(false); setForm(EMPTY_FORM); }}>Cancel</SecondaryButton>
          <PrimaryButton
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !canSubmit}
          >
            {createMutation.isPending ? 'Creating…' : 'Create Advance'}
          </PrimaryButton>
        </DialogActions>
      </AppModal>

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={/error|fail|forbidden/i.test(toast) ? 'error' : 'success'}
          onClose={() => setToast('')}
        >
          {toast}
        </Alert>
      </Snackbar>
    </Box>
  );
}
