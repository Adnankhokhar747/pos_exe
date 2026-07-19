import { useState } from 'react';
import {
  Alert, Box, Chip, DialogActions, MenuItem, Snackbar, Stack, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { HrShift } from '../api/types';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { AppModal } from '../components/AppModal';
import { PrimaryButton, SecondaryButton } from '../components/buttons';

const EMPTY: Partial<HrShift> = { name: '', startTime: '08:00', endTime: '17:00', graceMinutes: 15, isActive: true };

export function HrShiftsPage(): JSX.Element {
  const qc = useQueryClient();
  const [open, setOpen]       = useState(false);
  const [form, setForm]       = useState<Partial<HrShift>>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [snack, setSnack]     = useState<string | null>(null);

  const { data: shifts = [] } = useQuery<HrShift[]>({
    queryKey: ['hr-shifts'],
    queryFn: () => apiFetch('/api/v1/hr/shifts'),
  });

  const f = (k: keyof HrShift, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: () => {
      const url    = editing ? `/api/v1/hr/shifts/${editing}` : '/api/v1/hr/shifts';
      const method = editing ? 'PATCH' : 'POST';
      return apiFetch(url, {
        method, body: JSON.stringify({
          name: form.name, startTime: form.startTime, endTime: form.endTime,
          graceMinutes: form.graceMinutes, isActive: form.isActive,
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-shifts'] });
      setOpen(false);
      setSnack(editing ? 'Shift updated.' : 'Shift created.');
    },
    onError: (e) => setSnack(e instanceof ApiError ? e.detail : 'Failed to save.'),
  });

  function openAdd() { setForm(EMPTY); setEditing(null); setOpen(true); }
  function openEdit(s: HrShift) { setForm(s); setEditing(s.id); setOpen(true); }

  const COLS: DataTableColumn<HrShift>[] = [
    { key: 'name',  label: 'Shift Name', sortable: true, render: (r) => <Typography fontWeight={600}>{r.name}</Typography> },
    { key: 'start', label: 'Start',  render: (r) => r.startTime },
    { key: 'end',   label: 'End',    render: (r) => r.endTime },
    { key: 'grace', label: 'Grace',  render: (r) => `${r.graceMinutes} min` },
    { key: 'status', label: 'Status', render: (r) => <Chip label={r.isActive ? 'Active' : 'Inactive'} size="small" color={r.isActive ? 'success' : 'default'} variant="outlined" /> },
    { key: 'actions', label: '', render: (r) => <SecondaryButton size="small" onClick={(e) => { e.stopPropagation(); openEdit(r); }}>Edit</SecondaryButton> },
  ];

  return (
    <Box p={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" fontWeight={700}>Work Shifts</Typography>
        <PrimaryButton startIcon={<AddIcon />} onClick={openAdd}>Add Shift</PrimaryButton>
      </Stack>

      <DataTable columns={COLS} rows={shifts} getRowId={(r) => r.id} getSearchText={(r) => r.name} emptyMessage="No shifts defined." onRowClick={openEdit} />

      <AppModal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Shift' : 'Add Shift'}>
        <Stack spacing={2} pt={0.5}>
          <TextField label="Shift Name *" value={form.name ?? ''} onChange={(e) => f('name', e.target.value)} fullWidth size="small" />
          <Stack direction="row" spacing={2}>
            <TextField label="Start Time" value={form.startTime ?? '08:00'} onChange={(e) => f('startTime', e.target.value)} size="small" type="time" InputLabelProps={{ shrink: true }} fullWidth />
            <TextField label="End Time" value={form.endTime ?? '17:00'} onChange={(e) => f('endTime', e.target.value)} size="small" type="time" InputLabelProps={{ shrink: true }} fullWidth />
            <TextField label="Grace (min)" value={form.graceMinutes ?? 15} onChange={(e) => f('graceMinutes', parseInt(e.target.value) || 0)} size="small" type="number" inputProps={{ min: 0, max: 120 }} fullWidth />
          </Stack>
          {editing && (
            <TextField select label="Status" value={form.isActive ? 'active' : 'inactive'} onChange={(e) => f('isActive', e.target.value === 'active')} size="small" fullWidth>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </TextField>
          )}
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
