import { useState } from 'react';
import {
  Alert, Box, Button, Chip, DialogActions, Divider,
  MenuItem, Paper, Snackbar, Stack, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import ListAltIcon from '@mui/icons-material/ListAlt';
import PrintIcon from '@mui/icons-material/Print';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { HrPayrollRun, HrPayslip, PayrollStatus } from '../api/types';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { AppModal } from '../components/AppModal';
import { PrimaryButton, SecondaryButton } from '../components/buttons';
import { useCurrency } from '../hooks/useCurrency';

const STATUS_COLORS: Record<PayrollStatus, 'warning' | 'info' | 'success'> = {
  draft: 'warning', approved: 'info', paid: 'success',
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function SlipDialog({ payslip, onClose }: { payslip: HrPayslip; onClose: () => void }) {
  const cur = useCurrency();
  const f = (n: number) => cur.fmt(n ?? 0);

  const totalEarnings = (payslip.grossSalary ?? 0)
    + (payslip.overtimePay ?? 0)
    + (payslip.performanceBonus ?? 0)
    + (payslip.expenseReimbursement ?? 0)
    + (payslip.benefitAdjustments ?? 0);

  const totalDeductions = (payslip.absentDeduction ?? 0)
    + (payslip.unpaidLeaveDeduction ?? 0)
    + (payslip.lateDeduction ?? 0)
    + (payslip.otherDeductions ?? 0)
    + (payslip.taxAmount ?? 0);

  const printSlip = () => {
    const win = window.open('', '_blank', 'width=700,height=900');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Salary Slip</title><style>
      body { font-family: Arial, sans-serif; font-size: 12px; margin: 24px; color: #222; }
      h2 { margin: 0 0 4px; } .sub { color: #666; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
      th { background: #f4f4f4; text-align: left; padding: 6px 8px; }
      td { padding: 5px 8px; border-bottom: 1px solid #eee; }
      .right { text-align: right; }
      .bold { font-weight: bold; }
      .total-row td { border-top: 2px solid #333; font-weight: bold; }
      .net-row td { font-size: 16px; color: #1565c0; font-weight: bold; }
      hr { border: none; border-top: 1px dashed #ccc; margin: 12px 0; }
    </style></head><body>
      <h2>SALARY SLIP</h2>
      <div class="sub">${MONTHS[(payslip.month ?? 1) - 1]} ${payslip.year}</div>
      <table><tr><td class="bold">Employee</td><td>${payslip.employeeName ?? '—'}</td>
      <td class="bold">Employee Code</td><td>${payslip.employeeCode ?? '—'}</td></tr>
      <tr><td class="bold">Department</td><td>${payslip.department ?? '—'}</td>
      <td class="bold">Job Title</td><td>${payslip.jobTitle ?? '—'}</td></tr></table>
      <hr/>
      <table><tr><th>Attendance</th><th class="right">Days</th></tr>
      <tr><td>Working Days</td><td class="right">${payslip.workingDays}</td></tr>
      <tr><td>Present Days</td><td class="right">${payslip.presentDays}</td></tr>
      <tr><td>Absent Days</td><td class="right">${payslip.absentDays}</td></tr>
      <tr><td>Paid Leave</td><td class="right">${payslip.paidLeaveDays}</td></tr>
      <tr><td>Unpaid Leave</td><td class="right">${payslip.unpaidLeaveDays}</td></tr>
      <tr><td>Late Instances</td><td class="right">${payslip.lateCount}</td></tr>
      <tr><td>Overtime Hours</td><td class="right">${payslip.overtimeHours}</td></tr></table>
      <hr/>
      <table><tr><th>Earnings</th><th class="right">Amount</th></tr>
      <tr><td>Basic Salary</td><td class="right">${f(payslip.basicSalary)}</td></tr>
      <tr><td>Housing Allowance</td><td class="right">${f(payslip.housingAllowance)}</td></tr>
      <tr><td>Transport Allowance</td><td class="right">${f(payslip.transportAllowance)}</td></tr>
      <tr><td>Other Allowances</td><td class="right">${f(payslip.otherAllowances)}</td></tr>
      <tr><td>Gross Salary</td><td class="right bold">${f(payslip.grossSalary)}</td></tr>
      <tr><td>Overtime Pay</td><td class="right">${f(payslip.overtimePay)}</td></tr>
      ${payslip.performanceBonus ? `<tr><td>Performance Bonus</td><td class="right">${f(payslip.performanceBonus)}</td></tr>` : ''}
      ${payslip.expenseReimbursement ? `<tr><td>Expense Reimbursement</td><td class="right">${f(payslip.expenseReimbursement)}</td></tr>` : ''}
      ${payslip.benefitAdjustments ? `<tr><td>Benefit Adjustments</td><td class="right">${f(payslip.benefitAdjustments)}</td></tr>` : ''}
      <tr class="total-row"><td>Total Earnings</td><td class="right">${f(totalEarnings)}</td></tr></table>
      <table><tr><th>Deductions</th><th class="right">Amount</th></tr>
      <tr><td>Absent Deduction</td><td class="right">${f(payslip.absentDeduction)}</td></tr>
      <tr><td>Unpaid Leave Deduction</td><td class="right">${f(payslip.unpaidLeaveDeduction)}</td></tr>
      <tr><td>Late Deduction</td><td class="right">${f(payslip.lateDeduction)}</td></tr>
      <tr><td>Other Deductions</td><td class="right">${f(payslip.otherDeductions)}</td></tr>
      ${payslip.taxAmount ? `<tr><td>Tax Deducted</td><td class="right">${f(payslip.taxAmount)}</td></tr>` : ''}
      <tr class="total-row"><td>Total Deductions</td><td class="right">${f(totalDeductions)}</td></tr></table>
      ${payslip.eosbProvision ? `<table><tr><th>Provisions</th><th class="right">Amount</th></tr>
      <tr><td>EOSB Provision (monthly)</td><td class="right">${f(payslip.eosbProvision)}</td></tr></table>` : ''}
      <hr/>
      <table><tr class="net-row"><td>NET SALARY</td><td class="right">${f(payslip.netSalary)}</td></tr></table>
      <div style="margin-top:32px;color:#999;font-size:10px;">Generated by POS System · ${new Date().toLocaleDateString()}</div>
    </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <AppModal open onClose={onClose} title={`Salary Slip — ${payslip.employeeName}`} maxWidth="sm">
      <Box sx={{ mb: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {MONTHS[(payslip.month ?? 1) - 1]} {payslip.year} · {payslip.employeeCode} · {payslip.department ?? '—'}
        </Typography>
      </Box>

      <Stack direction="row" gap={2}>
        {/* Earnings */}
        <Box flex={1}>
          <Typography variant="subtitle2" mb={1}>Earnings</Typography>
          <Table size="small">
            <TableBody>
              {[
                ['Basic Salary', payslip.basicSalary],
                ['Housing Allowance', payslip.housingAllowance],
                ['Transport Allowance', payslip.transportAllowance],
                ['Other Allowances', payslip.otherAllowances],
                ['Overtime Pay', payslip.overtimePay],
                ...(payslip.performanceBonus     ? [['Performance Bonus', payslip.performanceBonus]] : []),
                ...(payslip.expenseReimbursement ? [['Expense Reimb.', payslip.expenseReimbursement]] : []),
                ...(payslip.benefitAdjustments   ? [['Benefit Adjustments', payslip.benefitAdjustments]] : []),
              ].map(([label, val]) => (
                <TableRow key={String(label)}>
                  <TableCell sx={{ py: 0.5, color: 'text.secondary', fontSize: 12 }}>{label}</TableCell>
                  <TableCell align="right" sx={{ py: 0.5, fontSize: 12 }}>{cur.fmt(Number(val))}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', borderTop: 1 }}>Total Earnings</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', borderTop: 1 }}>{cur.fmt(totalEarnings)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>

        <Divider orientation="vertical" flexItem />

        {/* Deductions */}
        <Box flex={1}>
          <Typography variant="subtitle2" mb={1}>Deductions</Typography>
          <Table size="small">
            <TableBody>
              {[
                ['Absent', payslip.absentDeduction],
                ['Unpaid Leave', payslip.unpaidLeaveDeduction],
                ['Late', payslip.lateDeduction],
                ['Other', payslip.otherDeductions],
                ...(payslip.taxAmount ? [['Tax', payslip.taxAmount]] : []),
              ].map(([label, val]) => (
                <TableRow key={String(label)}>
                  <TableCell sx={{ py: 0.5, color: 'text.secondary', fontSize: 12 }}>{label}</TableCell>
                  <TableCell align="right" sx={{ py: 0.5, color: 'error.main', fontSize: 12 }}>{cur.fmt(Number(val))}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', borderTop: 1 }}>Total Deductions</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', borderTop: 1, color: 'error.main' }}>{cur.fmt(totalDeductions)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>
      </Stack>

      <Divider sx={{ my: 1.5 }} />
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6" fontWeight="bold">NET SALARY</Typography>
        <Typography variant="h5" color="primary" fontWeight="bold">{cur.fmt(payslip.netSalary)}</Typography>
      </Stack>
      {(payslip.eosbProvision ?? 0) > 0 && (
        <Typography variant="caption" color="text.secondary">
          EOSB Provision (informational): {cur.fmt(payslip.eosbProvision)}
        </Typography>
      )}

      <DialogActions sx={{ mt: 1 }}>
        <Button startIcon={<PrintIcon />} onClick={printSlip}>Print Slip</Button>
        <PrimaryButton onClick={onClose}>Close</PrimaryButton>
      </DialogActions>
    </AppModal>
  );
}

export function HrPayrollPage(): JSX.Element {
  const qc = useQueryClient();
  const cur = useCurrency();
  const [selectedSlip, setSelectedSlip] = useState<HrPayslip | null>(null);
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
    { key: 'gross',  label: 'Total Gross',  align: 'right', render: (r) => cur.fmt(r.totalGross) },
    { key: 'ded',    label: 'Deductions',   align: 'right', render: (r) => cur.fmt(r.totalDeductions) },
    { key: 'net',    label: 'Net Pay',      align: 'right', render: (r) => <Typography fontWeight={600} color="success.main">{cur.fmt(r.totalNet)}</Typography> },
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
      <AppModal open={!!slipsRun} onClose={() => setSlipsRun(null)} title={slipsRun ? `Payslips — ${MONTHS[slipsRun.month - 1]} ${slipsRun.year}` : ''} maxWidth="xl">
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
                <TableCell align="right">Bonus</TableCell>
                <TableCell align="right">Deductions</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Net</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {payslips.map((ps) => (
                <TableRow key={ps.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{ps.employeeName}</Typography>
                    <Typography variant="caption" color="text.secondary">{ps.jobTitle}</Typography>
                  </TableCell>
                  <TableCell>{ps.department ?? '—'}</TableCell>
                  <TableCell align="right">{ps.presentDays}</TableCell>
                  <TableCell align="right">{ps.absentDays}</TableCell>
                  <TableCell align="right">{ps.lateCount}</TableCell>
                  <TableCell align="right">{ps.overtimeHours}</TableCell>
                  <TableCell align="right">{cur.fmt(ps.grossSalary)}</TableCell>
                  <TableCell align="right" sx={{ color: 'success.main' }}>
                    {cur.fmt((ps.overtimePay ?? 0) + (ps.performanceBonus ?? 0) + (ps.expenseReimbursement ?? 0))}
                  </TableCell>
                  <TableCell align="right" sx={{ color: 'error.main' }}>
                    {cur.fmt((ps.absentDeduction ?? 0) + (ps.unpaidLeaveDeduction ?? 0) + (ps.lateDeduction ?? 0) + (ps.otherDeductions ?? 0) + (ps.taxAmount ?? 0))}
                  </TableCell>
                  <TableCell align="right"><Typography fontWeight={700}>{cur.fmt(ps.netSalary)}</Typography></TableCell>
                  <TableCell>
                    <Button size="small" startIcon={<PrintIcon />} onClick={() => setSelectedSlip(ps)}>Slip</Button>
                  </TableCell>
                </TableRow>
              ))}
              {payslips.length === 0 && (
                <TableRow><TableCell colSpan={11} align="center"><Typography variant="body2" color="text.secondary" py={2}>No payslips</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {slipsRun && payslips.length > 0 && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Stack direction="row" spacing={4} justifyContent="flex-end">
              <Box textAlign="right"><Typography variant="caption" color="text.secondary">Total Gross</Typography><Typography fontWeight={600}>{cur.fmt(slipsRun.totalGross)}</Typography></Box>
              <Box textAlign="right"><Typography variant="caption" color="text.secondary">Deductions</Typography><Typography fontWeight={600} color="error.main">{cur.fmt(slipsRun.totalDeductions)}</Typography></Box>
              <Box textAlign="right"><Typography variant="caption" color="text.secondary">Net Pay</Typography><Typography fontWeight={700} color="success.main" variant="h6">{cur.fmt(slipsRun.totalNet)}</Typography></Box>
            </Stack>
          </>
        )}
        <DialogActions sx={{ mt: 1 }}>
          <PrimaryButton onClick={() => setSlipsRun(null)}>Close</PrimaryButton>
        </DialogActions>
      </AppModal>

      {/* Individual slip viewer */}
      {selectedSlip && <SlipDialog payslip={selectedSlip} onClose={() => setSelectedSlip(null)} />}

      <Snackbar open={!!snack} autoHideDuration={3500} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="info" onClose={() => setSnack(null)} variant="filled">{snack}</Alert>
      </Snackbar>
    </Box>
  );
}
