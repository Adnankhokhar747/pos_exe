import React, { useState } from 'react';
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControl, FormControlLabel, IconButton, InputLabel, MenuItem,
  Paper, Select, Stack, Switch, Tab, Tabs, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import {
  HrBenefitType, HrEmployeeBenefit, HrEmployee, HrTaxSetting,
} from '../api/types';
import { useCurrency } from '../hooks/useCurrency';

// ── Benefit Types Tab ─────────────────────────────────────────────────────────

function BenefitTypeDialog({
  open, onClose, type,
}: { open: boolean; onClose: () => void; type?: HrBenefitType | null }) {
  const qc = useQueryClient();
  const isEdit = !!type;
  const [name, setName]   = useState(type?.name ?? '');
  const [desc, setDesc]   = useState(type?.description ?? '');
  const [taxable, setTaxable] = useState(type?.isTaxable ?? false);

  const mut = useMutation({
    mutationFn: () => isEdit
      ? apiFetch(`/api/v1/hr/benefits/types/${type!.id}`, { method: 'PATCH', body: JSON.stringify({ name, description: desc, isTaxable: taxable }) })
      : apiFetch('/api/v1/hr/benefits/types', { method: 'POST', body: JSON.stringify({ name, description: desc, isTaxable: taxable }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr-benefit-types'] }); onClose(); },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{isEdit ? 'Edit Benefit Type' : 'Add Benefit Type'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Name" value={name} onChange={e => setName(e.target.value)} />
          <TextField label="Description" multiline rows={2} value={desc}
            onChange={e => setDesc(e.target.value)} />
          <FormControlLabel control={<Switch checked={taxable} onChange={e => setTaxable(e.target.checked)} />}
            label="Taxable benefit" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!name || mut.isPending} onClick={() => mut.mutate()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function BenefitTypesTab() {
  const [dialog, setDialog] = useState<{ open: boolean; type?: HrBenefitType | null }>({ open: false });
  const { data: types = [] } = useQuery<HrBenefitType[]>({
    queryKey: ['hr-benefit-types'],
    queryFn: () => apiFetch<HrBenefitType[]>('/api/v1/hr/benefits/types'),
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="flex-end" mb={2}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialog({ open: true, type: null })}>
          Add Type
        </Button>
      </Stack>
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Taxable</TableCell>
              <TableCell>Active</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {types.map(t => (
              <TableRow key={t.id}>
                <TableCell>{t.name}</TableCell>
                <TableCell>{t.description ?? '—'}</TableCell>
                <TableCell>{t.isTaxable ? 'Yes' : 'No'}</TableCell>
                <TableCell><Chip label={t.isActive ? 'Active' : 'Inactive'} size="small" color={t.isActive ? 'success' : 'default'} /></TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => setDialog({ open: true, type: t })}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {types.length === 0 && (
              <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>No benefit types configured</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
      <BenefitTypeDialog open={dialog.open} type={dialog.type} onClose={() => setDialog({ open: false })} />
    </Box>
  );
}

// ── Employee Benefits Tab ─────────────────────────────────────────────────────

function AssignBenefitDialog({
  open, onClose, employeeId,
}: { open: boolean; onClose: () => void; employeeId: string }) {
  const qc = useQueryClient();
  const { data: types = [] } = useQuery<HrBenefitType[]>({
    queryKey: ['hr-benefit-types'],
    queryFn: () => apiFetch<HrBenefitType[]>('/api/v1/hr/benefits/types'),
  });
  const [form, setForm] = useState({ benefitTypeId: '', amount: '', effectiveFrom: '', effectiveTo: '' });

  const mut = useMutation({
    mutationFn: () => apiFetch(`/api/v1/hr/benefits/employees/${employeeId}`, {
      method: 'POST',
      body: JSON.stringify({ ...form, amount: +form.amount }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr-employee-benefits', employeeId] }); onClose(); },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Assign Benefit</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>Benefit Type</InputLabel>
            <Select value={form.benefitTypeId} label="Benefit Type"
              onChange={e => setForm(p => ({ ...p, benefitTypeId: e.target.value }))}>
              {types.filter(t => t.isActive).map(t => (
                <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="Monthly Amount" type="number" value={form.amount}
            onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
          <TextField label="Effective From" type="date" InputLabelProps={{ shrink: true }}
            value={form.effectiveFrom} onChange={e => setForm(p => ({ ...p, effectiveFrom: e.target.value }))} />
          <TextField label="Effective To (optional)" type="date" InputLabelProps={{ shrink: true }}
            value={form.effectiveTo} onChange={e => setForm(p => ({ ...p, effectiveTo: e.target.value }))} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!form.benefitTypeId || !form.amount || !form.effectiveFrom || mut.isPending}
          onClick={() => mut.mutate()}>Assign</Button>
      </DialogActions>
    </Dialog>
  );
}

function EmployeeBenefitsTab() {
  const cur = useCurrency();
  const [empId, setEmpId]     = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const qc = useQueryClient();

  const { data: employees = [] } = useQuery<HrEmployee[]>({
    queryKey: ['hr-employees'],
    queryFn: () => apiFetch<HrEmployee[]>('/api/v1/hr/employees'),
  });

  const { data: benefits = [] } = useQuery<HrEmployeeBenefit[]>({
    queryKey: ['hr-employee-benefits', empId],
    queryFn: () => apiFetch<HrEmployeeBenefit[]>(`/api/v1/hr/benefits/employees/${empId}`),
    enabled: !!empId,
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/hr/benefits/employee-benefits/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr-employee-benefits', empId] }),
  });

  return (
    <Box>
      <Stack direction="row" gap={2} mb={2} alignItems="center">
        <FormControl sx={{ minWidth: 260 }}>
          <InputLabel>Select Employee</InputLabel>
          <Select value={empId} label="Select Employee" onChange={e => setEmpId(e.target.value)}>
            {employees.map(e => (
              <MenuItem key={e.id} value={e.id}>{e.name} ({e.employeeCode})</MenuItem>
            ))}
          </Select>
        </FormControl>
        {empId && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAssignOpen(true)}>
            Assign Benefit
          </Button>
        )}
      </Stack>
      {empId && (
        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Benefit</TableCell>
                <TableCell>Taxable</TableCell>
                <TableCell align="right">Monthly Amount</TableCell>
                <TableCell>Effective From</TableCell>
                <TableCell>Effective To</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {benefits.map(b => (
                <TableRow key={b.id}>
                  <TableCell>{b.benefitType?.name ?? b.benefitTypeId}</TableCell>
                  <TableCell>{b.benefitType?.isTaxable ? 'Yes' : 'No'}</TableCell>
                  <TableCell align="right">{cur.fmt(b.amount)}</TableCell>
                  <TableCell>{b.effectiveFrom}</TableCell>
                  <TableCell>{b.effectiveTo ?? 'Ongoing'}</TableCell>
                  <TableCell>
                    <IconButton size="small" color="error" onClick={() => remove.mutate(b.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {benefits.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No benefits assigned to this employee
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}
      {assignOpen && (
        <AssignBenefitDialog open employeeId={empId} onClose={() => setAssignOpen(false)} />
      )}
    </Box>
  );
}

// ── Tax Settings Tab ──────────────────────────────────────────────────────────

function TaxSettingsTab() {
  const qc = useQueryClient();
  const { data: settings } = useQuery<HrTaxSetting>({
    queryKey: ['hr-tax-settings'],
    queryFn: () => apiFetch<HrTaxSetting>('/api/v1/hr/benefits/tax-settings'),
  });

  const [form, setForm] = useState<Partial<HrTaxSetting>>({});
  const merged = { ...settings, ...form };

  const mut = useMutation({
    mutationFn: () => apiFetch('/api/v1/hr/benefits/tax-settings', {
      method: 'PUT',
      body: JSON.stringify(merged),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr-tax-settings'] }); setForm({}); },
  });

  if (!settings) return null;

  return (
    <Paper sx={{ p: 3, maxWidth: 500 }}>
      <Typography variant="subtitle1" fontWeight="bold" mb={2}>Tax / Payroll Tax Settings</Typography>
      <Stack spacing={2}>
        <FormControlLabel
          control={
            <Switch checked={merged.isEnabled ?? false}
              onChange={e => setForm(p => ({ ...p, isEnabled: e.target.checked }))} />
          }
          label="Enable payroll tax calculation"
        />
        <TextField
          label="Tax Rate (%)"
          type="number"
          disabled={!merged.isEnabled}
          value={merged.taxRatePct ?? ''}
          onChange={e => setForm(p => ({ ...p, taxRatePct: +e.target.value }))}
        />
        <TextField
          label="Tax-Free Amount"
          type="number"
          disabled={!merged.isEnabled}
          value={merged.taxFreeAmount ?? ''}
          onChange={e => setForm(p => ({ ...p, taxFreeAmount: +e.target.value }))}
          helperText="Tax is applied only on income above this threshold"
        />
        <FormControl disabled={!merged.isEnabled}>
          <InputLabel>Apply Tax On</InputLabel>
          <Select value={merged.appliesTo ?? 'gross'} label="Apply Tax On"
            onChange={e => setForm(p => ({ ...p, appliesTo: e.target.value as 'basic' | 'gross' }))}>
            <MenuItem value="basic">Basic Salary only</MenuItem>
            <MenuItem value="gross">Gross Salary (incl. allowances)</MenuItem>
          </Select>
        </FormControl>
        <TextField
          label="Notes"
          multiline rows={2}
          value={merged.notes ?? ''}
          onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
        />
        <Box>
          <Button variant="contained" disabled={mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? 'Saving...' : 'Save Tax Settings'}
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HrBenefitsPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" gap={1} mb={2}>
        <CardGiftcardIcon color="primary" />
        <Typography variant="h5">Benefits & Tax</Typography>
      </Stack>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Benefit Types" />
        <Tab label="Employee Benefits" />
        <Tab label="Tax Settings" />
      </Tabs>
      {tab === 0 && <BenefitTypesTab />}
      {tab === 1 && <EmployeeBenefitsTab />}
      {tab === 2 && <TaxSettingsTab />}
    </Box>
  );
}
