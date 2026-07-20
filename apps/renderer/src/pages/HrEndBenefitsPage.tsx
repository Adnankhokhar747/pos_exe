import React, { useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControl, InputLabel, MenuItem, Paper, Select, Stack,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import CalculateIcon from '@mui/icons-material/Calculate';
import SaveIcon from '@mui/icons-material/Save';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { HrEmployee, HrEosbCalculation, HrEndOfServiceRecord } from '../api/types';
import { useCurrency } from '../hooks/useCurrency';

type EosbReason = 'resignation' | 'termination' | 'retirement' | 'death' | 'other';

const REASON_LABELS: Record<EosbReason, string> = {
  resignation:  'Resignation',
  termination:  'Termination by Employer',
  retirement:   'Retirement',
  death:        'Death',
  other:        'Other',
};

function EosbCalculatorDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const cur = useCurrency();

  const { data: employees = [] } = useQuery<HrEmployee[]>({
    queryKey: ['hr-employees'],
    queryFn: () => apiFetch<HrEmployee[]>('/api/v1/hr/employees'),
    enabled: open,
  });

  const [form, setForm] = useState({
    employeeId:  '',
    endDate:     new Date().toISOString().slice(0, 10),
    reason:      'resignation' as EosbReason,
    basicSalary: '',
  });

  const [result, setResult] = useState<HrEosbCalculation | null>(null);

  const calc = useMutation({
    mutationFn: () => apiFetch<HrEosbCalculation>('/api/v1/hr/end-of-service/calculate', {
      method: 'POST',
      body: JSON.stringify({ ...form, basicSalary: form.basicSalary ? +form.basicSalary : undefined }),
    }),
    onSuccess: data => setResult(data),
  });

  const finalize = useMutation({
    mutationFn: () => apiFetch('/api/v1/hr/end-of-service', {
      method: 'POST',
      body: JSON.stringify({
        employeeId:       result!.employeeId,
        endDate:          form.endDate,
        reason:           form.reason,
        basicSalary:      form.basicSalary ? +form.basicSalary : undefined,
        calculationNotes: result!.calculationNotes,
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-eosb-records'] });
      onClose();
    },
  });

  const selectedEmp = employees.find(e => e.id === form.employeeId);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>End of Service Benefit (EOSB) Calculator</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>Employee</InputLabel>
            <Select value={form.employeeId} label="Employee"
              onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))}>
              {employees.filter(e => e.isActive).map(e => (
                <MenuItem key={e.id} value={e.id}>
                  {e.name} ({e.employeeCode})
                  {e.joinDate && ` — Joined ${e.joinDate}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {selectedEmp && (
            <Alert severity="info">
              Employee: <strong>{selectedEmp.name}</strong> · Join Date: <strong>{selectedEmp.joinDate ?? 'Not set'}</strong>
              {selectedEmp.basicSalary && <> · Basic: <strong>{cur.fmt(+selectedEmp.basicSalary)}</strong></>}
            </Alert>
          )}

          <TextField
            label="End Date (Last Working Day)"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={form.endDate}
            onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
          />
          <FormControl fullWidth>
            <InputLabel>Reason for Leaving</InputLabel>
            <Select value={form.reason} label="Reason for Leaving"
              onChange={e => setForm(p => ({ ...p, reason: e.target.value as EosbReason }))}>
              {(Object.entries(REASON_LABELS) as [EosbReason, string][]).map(([v, l]) => (
                <MenuItem key={v} value={v}>{l}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Override Basic Salary (optional)"
            type="number"
            helperText="Leave blank to use the employee's recorded basic salary"
            value={form.basicSalary}
            onChange={e => setForm(p => ({ ...p, basicSalary: e.target.value }))}
          />

          {result && (
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" mb={1}>Calculation Result</Typography>
              <Stack spacing={0.5}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Years of Service</Typography>
                  <Typography variant="body2" fontWeight="bold">{result.yearsOfService} yrs</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Qualifying Years</Typography>
                  <Typography variant="body2">{result.qualifyingYears} yrs</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Basic Salary Used</Typography>
                  <Typography variant="body2">{cur.fmt(result.basicSalary)}</Typography>
                </Stack>
                <Divider sx={{ my: 0.5 }} />
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" fontWeight="bold">EOSB Amount</Typography>
                  <Typography variant="h6" color="primary" fontWeight="bold">{cur.fmt(result.eosbAmount)}</Typography>
                </Stack>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {result.calculationNotes}
              </Typography>
            </Paper>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="outlined"
          startIcon={<CalculateIcon />}
          disabled={!form.employeeId || !form.endDate || calc.isPending}
          onClick={() => calc.mutate()}
        >
          Calculate
        </Button>
        {result && (
          <Button
            variant="contained"
            color="success"
            startIcon={<SaveIcon />}
            disabled={finalize.isPending}
            onClick={() => finalize.mutate()}
          >
            {finalize.isPending ? 'Finalizing...' : 'Finalize & Close Employee'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default function HrEndBenefitsPage() {
  const cur = useCurrency();
  const [open, setOpen] = useState(false);

  const { data: records = [] } = useQuery<HrEndOfServiceRecord[]>({
    queryKey: ['hr-eosb-records'],
    queryFn: () => apiFetch<HrEndOfServiceRecord[]>('/api/v1/hr/end-of-service'),
  });

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">End of Service Benefits (EOSB)</Typography>
        <Button variant="contained" startIcon={<CalculateIcon />} onClick={() => setOpen(true)}>
          Calculate & Process EOSB
        </Button>
      </Stack>

      <Alert severity="info" sx={{ mb: 2 }}>
        Qatar Labour Law: 3 weeks basic per year for the first 5 years, then 4 weeks per year.
        Resignation: {'<'} 1 yr = 0 | 1–3 yrs = 1/3 | 3–5 yrs = 2/3 | {'>'}5 yrs = full entitlement.
      </Alert>

      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Employee</TableCell>
              <TableCell>Join Date</TableCell>
              <TableCell>End Date</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell align="right">Years</TableCell>
              <TableCell align="right">Qualifying Yrs</TableCell>
              <TableCell align="right">Basic Salary</TableCell>
              <TableCell align="right">EOSB Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {records.map(r => (
              <TableRow key={r.id}>
                <TableCell>
                  <Box>
                    <Typography variant="body2">{r.employeeName}</Typography>
                    {r.employee?.employeeCode && (
                      <Typography variant="caption" color="text.secondary">{r.employee.employeeCode}</Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell>{r.joinDate}</TableCell>
                <TableCell>{r.endDate}</TableCell>
                <TableCell>
                  <Chip label={REASON_LABELS[r.reason as EosbReason] ?? r.reason} size="small"
                    color={r.reason === 'resignation' ? 'default' : r.reason === 'termination' ? 'error' : 'info'} />
                </TableCell>
                <TableCell align="right">{Number(r.yearsOfService).toFixed(1)}</TableCell>
                <TableCell align="right">{Number(r.qualifyingYears).toFixed(1)}</TableCell>
                <TableCell align="right">{cur.fmt(r.basicSalary)}</TableCell>
                <TableCell align="right">
                  <Typography fontWeight="bold" color="primary">{cur.fmt(r.eosbAmount)}</Typography>
                </TableCell>
              </TableRow>
            ))}
            {records.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                  No EOSB records yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {open && <EosbCalculatorDialog open onClose={() => setOpen(false)} />}
    </Box>
  );
}
