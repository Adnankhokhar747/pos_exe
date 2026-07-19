import { useState } from 'react';
import {
  Alert, Box, Chip, DialogActions, Divider, MenuItem,
  Snackbar, Stack, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { HrEmployee, HrShift } from '../api/types';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { AppModal } from '../components/AppModal';
import { PrimaryButton, SecondaryButton } from '../components/buttons';

const EMPTY: Partial<HrEmployee & { apiUserId: string }> = {
  name: '', employeeCode: '', email: '', phone: '', department: '',
  jobTitle: '', joinDate: '', shiftId: '', userId: '',
  salaryType: 'monthly', basicSalary: 0, housingAllowance: 0,
  transportAllowance: 0, otherAllowances: 0, annualLeaveDays: 21,
  overtimeRate: 1.5, notes: '', isActive: true,
};

export function HrEmployeesPage(): JSX.Element {
  const qc = useQueryClient();
  const [open, setOpen]   = useState(false);
  const [form, setForm]   = useState<Partial<HrEmployee>>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  const { data: employees = [] } = useQuery<HrEmployee[]>({
    queryKey: ['hr-employees'],
    queryFn: () => apiFetch('/api/v1/hr/employees'),
  });

  const { data: shifts = [] } = useQuery<HrShift[]>({
    queryKey: ['hr-shifts'],
    queryFn: () => apiFetch('/api/v1/hr/shifts'),
  });

  const { data: linkableUsers = [] } = useQuery<{ id: string; username: string; fullName: string }[]>({
    queryKey: ['hr-linkable-users'],
    queryFn: () => apiFetch('/api/v1/hr/employees/linkable-users'),
    enabled: open,
  });

  const f = (k: keyof HrEmployee, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: () => {
      const url    = editing ? `/api/v1/hr/employees/${editing}` : '/api/v1/hr/employees';
      const method = editing ? 'PATCH' : 'POST';
      return apiFetch(url, { method, body: JSON.stringify(form) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-employees'] });
      qc.invalidateQueries({ queryKey: ['hr-linkable-users'] });
      setOpen(false);
      setSnack(editing ? 'Employee updated.' : 'Employee added.');
    },
    onError: (e) => setSnack(e instanceof ApiError ? e.detail : 'Failed to save.'),
  });

  function openAdd() { setForm(EMPTY); setEditing(null); setOpen(true); }
  function openEdit(emp: HrEmployee) { setForm(emp); setEditing(emp.id); setOpen(true); }

  const COLS: DataTableColumn<HrEmployee>[] = [
    { key: 'code', label: 'Code', render: (r) => r.employeeCode ?? '—' },
    { key: 'name', label: 'Name', sortable: true, render: (r) => <Typography fontWeight={600}>{r.name}</Typography> },
    { key: 'dept', label: 'Department', render: (r) => r.department ?? '—' },
    { key: 'title', label: 'Job Title', render: (r) => r.jobTitle ?? '—' },
    { key: 'shift', label: 'Shift', render: (r) => r.shiftName ?? '—' },
    { key: 'salary', label: 'Gross Salary', align: 'right', render: (r) => r.grossSalary.toFixed(2) },
    {
      key: 'status', label: 'Status', render: (r) =>
        <Chip label={r.isActive ? 'Active' : 'Inactive'} size="small" color={r.isActive ? 'success' : 'default'} variant="outlined" />,
    },
    {
      key: 'actions', label: '', render: (r) =>
        <SecondaryButton size="small" onClick={(e) => { e.stopPropagation(); openEdit(r); }}>Edit</SecondaryButton>,
    },
  ];

  return (
    <Box p={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" fontWeight={700}>Employees</Typography>
        <PrimaryButton startIcon={<AddIcon />} onClick={openAdd}>Add Employee</PrimaryButton>
      </Stack>

      <DataTable
        columns={COLS}
        rows={employees}
        getRowId={(r) => r.id}
        getSearchText={(r) => `${r.name} ${r.employeeCode ?? ''} ${r.department ?? ''} ${r.jobTitle ?? ''}`}
        searchPlaceholder="Search employees…"
        emptyMessage="No employees yet."
        defaultSortKey="name"
        onRowClick={openEdit}
      />

      <AppModal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Employee' : 'Add Employee'} maxWidth="md">
        <Stack spacing={2} pt={0.5}>
          <Stack direction="row" spacing={2}>
            <TextField label="Full Name *" value={form.name ?? ''} onChange={(e) => f('name', e.target.value)} fullWidth size="small" />
            <TextField label="Employee Code" value={form.employeeCode ?? ''} onChange={(e) => f('employeeCode', e.target.value)} size="small" sx={{ width: 140 }} />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField label="Department" value={form.department ?? ''} onChange={(e) => f('department', e.target.value)} fullWidth size="small" />
            <TextField label="Job Title" value={form.jobTitle ?? ''} onChange={(e) => f('jobTitle', e.target.value)} fullWidth size="small" />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField label="Email" value={form.email ?? ''} onChange={(e) => f('email', e.target.value)} fullWidth size="small" type="email" />
            <TextField label="Phone" value={form.phone ?? ''} onChange={(e) => f('phone', e.target.value)} fullWidth size="small" />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField label="Join Date" value={form.joinDate ?? ''} onChange={(e) => f('joinDate', e.target.value)} size="small" type="date" InputLabelProps={{ shrink: true }} sx={{ flex: 1 }} />
            <TextField select label="Shift" value={form.shiftId ?? ''} onChange={(e) => f('shiftId', e.target.value)} size="small" sx={{ flex: 1 }}>
              <MenuItem value="">— No shift —</MenuItem>
              {shifts.map((s) => <MenuItem key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</MenuItem>)}
            </TextField>
            <TextField select label="Linked User" value={form.userId ?? ''} onChange={(e) => f('userId', e.target.value)} size="small" sx={{ flex: 1 }}>
              <MenuItem value="">— None —</MenuItem>
              {linkableUsers.map((u) => <MenuItem key={u.id} value={u.id}>{u.fullName} (@{u.username})</MenuItem>)}
              {form.userId && <MenuItem value={form.userId}>{form.userName ?? form.userId}</MenuItem>}
            </TextField>
          </Stack>

          <Divider><Typography variant="caption" color="text.secondary">Salary</Typography></Divider>

          <Stack direction="row" spacing={2}>
            <TextField select label="Salary Type" value={form.salaryType ?? 'monthly'} onChange={(e) => f('salaryType', e.target.value)} size="small" sx={{ width: 130 }}>
              <MenuItem value="monthly">Monthly</MenuItem>
              <MenuItem value="daily">Daily</MenuItem>
              <MenuItem value="hourly">Hourly</MenuItem>
            </TextField>
            <TextField label="Basic Salary *" value={form.basicSalary ?? ''} onChange={(e) => f('basicSalary', parseFloat(e.target.value) || 0)} size="small" type="number" inputProps={{ min: 0, step: 0.01 }} sx={{ flex: 1 }} />
            <TextField label="Housing" value={form.housingAllowance ?? ''} onChange={(e) => f('housingAllowance', parseFloat(e.target.value) || 0)} size="small" type="number" inputProps={{ min: 0 }} sx={{ flex: 1 }} />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField label="Transport" value={form.transportAllowance ?? ''} onChange={(e) => f('transportAllowance', parseFloat(e.target.value) || 0)} size="small" type="number" inputProps={{ min: 0 }} sx={{ flex: 1 }} />
            <TextField label="Other Allowances" value={form.otherAllowances ?? ''} onChange={(e) => f('otherAllowances', parseFloat(e.target.value) || 0)} size="small" type="number" inputProps={{ min: 0 }} sx={{ flex: 1 }} />
            <TextField label="Annual Leave Days" value={form.annualLeaveDays ?? 21} onChange={(e) => f('annualLeaveDays', parseInt(e.target.value) || 21)} size="small" type="number" inputProps={{ min: 0 }} sx={{ flex: 1 }} />
            <TextField label="OT Rate (×)" value={form.overtimeRate ?? 1.5} onChange={(e) => f('overtimeRate', parseFloat(e.target.value) || 1.5)} size="small" type="number" inputProps={{ min: 1, step: 0.25 }} sx={{ flex: 1 }} />
          </Stack>
          {editing && (
            <TextField select label="Status" value={form.isActive ? 'active' : 'inactive'} onChange={(e) => f('isActive', e.target.value === 'active')} size="small">
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </TextField>
          )}
          <TextField label="Notes" value={form.notes ?? ''} onChange={(e) => f('notes', e.target.value)} size="small" multiline minRows={2} />
        </Stack>

        <DialogActions sx={{ mt: 1 }}>
          <SecondaryButton onClick={() => setOpen(false)}>Cancel</SecondaryButton>
          <PrimaryButton onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </PrimaryButton>
        </DialogActions>
      </AppModal>

      <Snackbar open={!!snack} autoHideDuration={3500} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="info" onClose={() => setSnack(null)} variant="filled">{snack}</Alert>
      </Snackbar>
    </Box>
  );
}
