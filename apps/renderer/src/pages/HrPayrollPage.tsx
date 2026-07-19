import { useState } from 'react';
import {
  Alert, Box, Chip, DialogActions, Divider,
  MenuItem, Paper, Snackbar, Stack, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import ListAltIcon from '@mui/icons-material/ListAlt';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { HrPayrollRun, HrPayslip, PayrollStatus } from '../api/types';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { AppModal } from '../components/AppModal';
import { PrimaryButton, SecondaryButton } from '../components/buttons';

const STATUS_COLORS: Record<PayrollStatus, 'warning' | 'info' | 'success'> = {
  draft: 'warning', approved: 'info', paid: 'success',
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function fmt(n: number): string { return n.toFixed(2); }

export function HrPayrollPage(): JSX.Element {
  const qc = useQueryClient();
  const now = new Date();
  const [genOpen, setGenOpen]         = useState(false);
  const [genForm, setGenForm]         = useState({ month: now.getMonth() + 1, year: now.getFullYear(), workingDays: '', notes: '' });
  const [slipsRun, setSlipsRun]       = useState<HrPayrollRun | null>(null);
  const [snack, setSnack]             = useState<string | null>(null);

  const { data: runs = [] } = useQuery<HrPayrollRun[]>({
    queryKey: ['hr-payroll-runs'],
    queryFn: () => apiFetch('/api/v1/hr/payroll'),
  });

  const { data: payslips = [] } = useQuery<HrPayslip[]>({
    queryKey: ['hr-payslips', slipsRun?.id],
    queryFn: () => apiFetch(`/api/v1/hr/payroll/${slipsRun!.id}/payslips`),
    enabled: !!slipsRun,
  });

  const generate = useMutation({
    mutationFn: () => apiFetch('/api/v1/hr/payroll/generate', {
      method: 'POST',
      body: JSON.stringify({
        month: genForm.month, year: genForm.year,
        workingDays: genForm.workingDays ? parseInt(genForm.workingDays) : undefined,
        notes: genForm.notes || undefined,
      }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr-payroll-runs'] }); setGenOpen(false); setSnack('Payroll generated.'); },
    onError: (e) => setSnack(e instanceof ApiError ? e.detail : 'Failed.'),
  });

  const approve = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/hr/payroll/${id}/approve`, { method: 'PATCH', body: '{}' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr-payroll-runs'] }); setSnack('Payroll approved.'); },
    onError: (e) => setSnack(e instanceof ApiError ? e.detail : 'Failed.'),
  });

  const markPaid = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/hr/payroll/${id}/mark-paid`, { method: 'PATCH', body: '{}' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr-payroll-runs'] }); setSnack('Payroll marked as paid.'); },
    onError: (e) => setSnack(e instanceof ApiError ? e.detail : 'Failed.'),
  });

  const deleteRun = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/hr/payroll/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr-payroll-runs'] }); setSnack('Payroll deleted.'); },
    onError: (e) => setSnack(e instanceof ApiError ? e.detail : 'Failed.'),
  });

  const COLS: DataTableColumn<HrPayrollRun>[] = [
    { key: 'period', label: 'Period', sortable: true, render: (r) => <Typography fontWeight={600}>{MONTHS[r.month - 1]} {r.year}</Typography> },
    { key: 'days',   label: 'Working Days', align: 'right', render: (r) => r.workingDays },
    { key: 'gross',  label: 'Total Gross',  align: 'right', render: (r) => fmt(r.totalGross) },
    { key: 'ded',    label: 'Deductions',   align: 'right', render: (r) => fmt(r.totalDeductions) },
    { key: 'net',    label: 'Net Pay',      align: 'right', render: (r) => <Typography fontWeight={600} color="success.main">{fmt(r.totalNet)}</Typography> },
    { key: 'status', label: 'Status', render: (r) => <Chip label={r.status} size="small" color={STATUS_COLORS[r.status]} variant="outlined" /> },
    {
      key: 'actions', label: '', render: (r) => (
        <Stack direction="row" spacing={0.5}>
          <SecondaryButton size="small" startIcon={<ListAltIcon />} onClick={(e) => { e.stopPropagation(); setSlipsRun(r); }}>Payslips</SecondaryButton>
          {r.status === 'draft' && <PrimaryButton size="small" onClick={(e) => { e.stopPropagation(); approve.mutate(r.id); }}>Approve</PrimaryButton>}
          {r.status === 'approved' && <PrimaryButton size="small" onClick={(e) => { e.stopPropagation(); markPaid.mutate(r.id); }}>Mark Paid</PrimaryButton>}
          {r.status === 'draft' && (
            <SecondaryButton size="small" onClick={(e) => { e.stopPropagation(); if (confirm('Delete this draft payroll?')) deleteRun.mutate(r.id); }}>Delete</SecondaryButton>
          )}
        </Stack>
      ),
    },
  ];

  return (
    <Box p={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" fontWeight={700}>Payroll</Typography>
        <PrimaryButton onClick={() => setGenOpen(true)}>Generate Payroll</PrimaryButton>
      </Stack>

      <DataTable
        columns={COLS}
        rows={runs}
        getRowId={(r) => r.id}
        getSearchText={(r) => `${MONTHS[r.month - 1]} ${r.year} ${r.status}`}
        emptyMessage="No payroll runs yet."
        defaultSortKey="period"
        defaultSortDir="desc"
      />

      {/* Generate modal */}
      <AppModal open={genOpen} onClose={() => setGenOpen(false)} title="Generate Payroll">
        <Stack spacing={2} pt={0.5}>
          <Stack direction="row" spacing={2}>
            <TextField select label="Month *" value={genForm.month} onChange={(e) => setGenForm((p) => ({ ...p, month: parseInt(e.target.value) }))} size="small" fullWidth>
              {MONTHS.map((m, i) => <MenuItem key={i} value={i + 1}>{m}</MenuItem>)}
            </TextField>
            <TextField label="Year *" value={genForm.year} onChange={(e) => setGenForm((p) => ({ ...p, year: parseInt(e.target.value) || now.getFullYear() }))} size="small" type="number" inputProps={{ min: 2020, max: 2100 }} fullWidth />
          </Stack>
          <TextField label="Working Days (leave blank to auto-calculate)" value={genForm.workingDays} onChange={(e) => setGenForm((p) => ({ ...p, workingDays: e.target.value }))} size="small" type="number" inputProps={{ min: 1, max: 31 }} helperText="Auto: counts Sun–Thu (Qatar standard)" />
          <TextField label="Notes" value={genForm.notes} onChange={(e) => setGenForm((p) => ({ ...p, notes: e.target.value }))} size="small" multiline minRows={2} />
        </Stack>
        <DialogActions sx={{ mt: 1 }}>
          <SecondaryButton onClick={() => setGenOpen(false)}>Cancel</SecondaryButton>
          <PrimaryButton onClick={() => generate.mutate()} disabled={generate.isPending}>
            {generate.isPending ? 'Generating…' : 'Generate'}
          </PrimaryButton>
        </DialogActions>
      </AppModal>

      {/* Payslips modal */}
      <AppModal open={!!slipsRun} onClose={() => setSlipsRun(null)} title={slipsRun ? `Payslips — ${MONTHS[slipsRun.month - 1]} ${slipsRun.year}` : ''} maxWidth="lg">
        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 480 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell>
                <TableCell>Dept</TableCell>
                <TableCell align="right">Present</TableCell>
                <TableCell align="right">Absent</TableCell>
                <TableCell align="right">Late</TableCell>
                <TableCell align="right">OT hrs</TableCell>
                <TableCell align="right">Gross</TableCell>
                <TableCell align="right">Deductions</TableCell>
                <TableCell align="right">OT Pay</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Net</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payslips.map((ps) => (
                <TableRow key={ps.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{ps.employeeName}</Typography>
                    <Typography variant="caption" color="text.secondary">{ps.jobTitle}</Typography>
                  </TableCell>
                  <TableCell>{ps.department ?? '—'}</TableCell>
                  <TableCell align="right">{ps.presentDays}</TableCell>
                  <TableCell align="right">{ps.absentDays}</TableCell>
                  <TableCell align="right">{ps.lateCount}</TableCell>
                  <TableCell align="right">{ps.overtimeHours}</TableCell>
                  <TableCell align="right">{fmt(ps.grossSalary)}</TableCell>
                  <TableCell align="right" sx={{ color: 'error.main' }}>
                    {fmt((ps.absentDeduction ?? 0) + (ps.unpaidLeaveDeduction ?? 0) + (ps.lateDeduction ?? 0) + (ps.otherDeductions ?? 0))}
                  </TableCell>
                  <TableCell align="right" sx={{ color: 'success.main' }}>{fmt(ps.overtimePay)}</TableCell>
                  <TableCell align="right"><Typography fontWeight={700}>{fmt(ps.netSalary)}</Typography></TableCell>
                </TableRow>
              ))}
              {payslips.length === 0 && (
                <TableRow><TableCell colSpan={10} align="center"><Typography variant="body2" color="text.secondary" py={2}>No payslips</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {slipsRun && payslips.length > 0 && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Stack direction="row" spacing={4} justifyContent="flex-end">
              <Box textAlign="right"><Typography variant="caption" color="text.secondary">Total Gross</Typography><Typography fontWeight={600}>{fmt(slipsRun.totalGross)}</Typography></Box>
              <Box textAlign="right"><Typography variant="caption" color="text.secondary">Deductions</Typography><Typography fontWeight={600} color="error.main">{fmt(slipsRun.totalDeductions)}</Typography></Box>
              <Box textAlign="right"><Typography variant="caption" color="text.secondary">Net Pay</Typography><Typography fontWeight={700} color="success.main" variant="h6">{fmt(slipsRun.totalNet)}</Typography></Box>
            </Stack>
          </>
        )}
        <DialogActions sx={{ mt: 1 }}>
          <PrimaryButton onClick={() => setSlipsRun(null)}>Close</PrimaryButton>
        </DialogActions>
      </AppModal>

      <Snackbar open={!!snack} autoHideDuration={3500} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="info" onClose={() => setSnack(null)} variant="filled">{snack}</Alert>
      </Snackbar>
    </Box>
  );
}
