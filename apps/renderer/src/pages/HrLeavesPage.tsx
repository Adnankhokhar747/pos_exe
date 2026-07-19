import { useState } from 'react';
import {
  Alert, Box, Chip, DialogActions, MenuItem, Snackbar,
  Stack, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { HrEmployee, HrLeave, HrLeaveType, LeaveStatus } from '../api/types';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { AppModal } from '../components/AppModal';
import { PrimaryButton, SecondaryButton } from '../components/buttons';

const STATUS_COLORS: Record<LeaveStatus, 'warning' | 'success' | 'error'> = {
  pending: 'warning', approved: 'success', rejected: 'error',
};

export function HrLeavesPage(): JSX.Element {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);

  /* ─── Leave Types ─── */
  const [ltOpen, setLtOpen]       = useState(false);
  const [ltForm, setLtForm]       = useState<Partial<HrLeaveType>>({ name: '', isPaid: true, daysPerYear: 21, isActive: true });
  const [ltEditing, setLtEditing] = useState<string | null>(null);
  const [snack, setSnack]         = useState<string | null>(null);

  const { data: leaveTypes = [] } = useQuery<HrLeaveType[]>({
    queryKey: ['hr-leave-types'],
    queryFn: () => apiFetch('/api/v1/hr/leave-types'),
  });

  const ltSave = useMutation({
    mutationFn: () => {
      const url    = ltEditing ? `/api/v1/hr/leave-types/${ltEditing}` : '/api/v1/hr/leave-types';
      const method = ltEditing ? 'PATCH' : 'POST';
      return apiFetch(url, { method, body: JSON.stringify(ltForm) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr-leave-types'] }); setLtOpen(false); setSnack('Leave type saved.'); },
    onError: (e) => setSnack(e instanceof ApiError ? e.detail : 'Failed.'),
  });

  /* ─── Leave Requests ─── */
  const [lrOpen, setLrOpen] = useState(false);
  const [lrForm, setLrForm] = useState<{
    employeeId: string; leaveTypeId: string; fromDate: string; toDate: string; reason: string;
  }>({ employeeId: '', leaveTypeId: '', fromDate: '', toDate: '', reason: '' });
  const [rejReason, setRejReason] = useState('');
  const [rejId, setRejId]         = useState<string | null>(null);

  const { data: leaves = [] } = useQuery<HrLeave[]>({
    queryKey: ['hr-leaves'],
    queryFn: () => apiFetch('/api/v1/hr/leaves'),
  });

  const { data: employees = [] } = useQuery<HrEmployee[]>({
    queryKey: ['hr-employees'],
    queryFn: () => apiFetch('/api/v1/hr/employees'),
  });

  const lrCreate = useMutation({
    mutationFn: () => apiFetch('/api/v1/hr/leaves', { method: 'POST', body: JSON.stringify(lrForm) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr-leaves'] }); setLrOpen(false); setSnack('Leave request submitted.'); },
    onError: (e) => setSnack(e instanceof ApiError ? e.detail : 'Failed.'),
  });

  const approve = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/hr/leaves/${id}/approve`, { method: 'PATCH', body: JSON.stringify({}) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr-leaves'] }); setSnack('Leave approved.'); },
    onError: (e) => setSnack(e instanceof ApiError ? e.detail : 'Failed.'),
  });

  const reject = useMutation({
    mutationFn: () => apiFetch(`/api/v1/hr/leaves/${rejId}/reject`, { method: 'PATCH', body: JSON.stringify({ rejectionReason: rejReason }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr-leaves'] }); setRejId(null); setRejReason(''); setSnack('Leave rejected.'); },
    onError: (e) => setSnack(e instanceof ApiError ? e.detail : 'Failed.'),
  });

  const LT_COLS: DataTableColumn<HrLeaveType>[] = [
    { key: 'name', label: 'Name', sortable: true, render: (r) => <Typography fontWeight={600}>{r.name}</Typography> },
    { key: 'paid', label: 'Paid?', render: (r) => <Chip label={r.isPaid ? 'Paid' : 'Unpaid'} size="small" color={r.isPaid ? 'success' : 'default'} variant="outlined" /> },
    { key: 'days', label: 'Days/Year', align: 'right', render: (r) => r.daysPerYear },
    { key: 'status', label: 'Status', render: (r) => <Chip label={r.isActive ? 'Active' : 'Inactive'} size="small" color={r.isActive ? 'success' : 'default'} variant="outlined" /> },
    {
      key: 'edit', label: '', render: (r) => (
        <SecondaryButton size="small" onClick={(e) => { e.stopPropagation(); setLtForm(r); setLtEditing(r.id); setLtOpen(true); }}>Edit</SecondaryButton>
      ),
    },
  ];

  const LR_COLS: DataTableColumn<HrLeave>[] = [
    { key: 'emp', label: 'Employee', sortable: true, render: (r) => <Typography fontWeight={600}>{r.employeeName}</Typography> },
    { key: 'type', label: 'Leave Type', render: (r) => r.leaveTypeName },
    { key: 'from', label: 'From', render: (r) => r.fromDate },
    { key: 'to', label: 'To', render: (r) => r.toDate },
    { key: 'days', label: 'Days', align: 'right', render: (r) => r.days },
    {
      key: 'status', label: 'Status', render: (r) =>
        <Chip label={r.status} size="small" color={STATUS_COLORS[r.status]} variant="outlined" />,
    },
    { key: 'reason', label: 'Reason', render: (r) => r.reason ?? '—' },
    {
      key: 'actions', label: '', render: (r) => r.status === 'pending' ? (
        <Stack direction="row" spacing={0.5}>
          <PrimaryButton size="small" startIcon={<CheckIcon />} onClick={(e) => { e.stopPropagation(); approve.mutate(r.id); }}>Approve</PrimaryButton>
          <SecondaryButton size="small" startIcon={<CloseIcon />} onClick={(e) => { e.stopPropagation(); setRejId(r.id); setRejReason(''); }}>Reject</SecondaryButton>
        </Stack>
      ) : null,
    },
  ];

  return (
    <Box p={3}>
      <Typography variant="h6" fontWeight={700} mb={2}>Leave Management</Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Leave Requests" />
        <Tab label="Leave Types" />
      </Tabs>

      {tab === 0 && (
        <>
          <Stack direction="row" justifyContent="flex-end" mb={2}>
            <PrimaryButton startIcon={<AddIcon />} onClick={() => { setLrForm({ employeeId: '', leaveTypeId: '', fromDate: '', toDate: '', reason: '' }); setLrOpen(true); }}>
              New Request
            </PrimaryButton>
          </Stack>
          <DataTable
            columns={LR_COLS}
            rows={leaves}
            getRowId={(r) => r.id}
            getSearchText={(r) => `${r.employeeName} ${r.leaveTypeName} ${r.status}`}
            searchPlaceholder="Search leaves…"
            emptyMessage="No leave requests."
            defaultSortKey="emp"
          />
        </>
      )}

      {tab === 1 && (
        <>
          <Stack direction="row" justifyContent="flex-end" mb={2}>
            <PrimaryButton startIcon={<AddIcon />} onClick={() => { setLtForm({ name: '', isPaid: true, daysPerYear: 21, isActive: true }); setLtEditing(null); setLtOpen(true); }}>
              Add Leave Type
            </PrimaryButton>
          </Stack>
          <DataTable columns={LT_COLS} rows={leaveTypes} getRowId={(r) => r.id} getSearchText={(r) => r.name} emptyMessage="No leave types." onRowClick={(r) => { setLtForm(r); setLtEditing(r.id); setLtOpen(true); }} />
        </>
      )}

      {/* Leave Type Modal */}
      <AppModal open={ltOpen} onClose={() => setLtOpen(false)} title={ltEditing ? 'Edit Leave Type' : 'Add Leave Type'}>
        <Stack spacing={2} pt={0.5}>
          <TextField label="Name *" value={ltForm.name ?? ''} onChange={(e) => setLtForm((p) => ({ ...p, name: e.target.value }))} size="small" fullWidth />
          <Stack direction="row" spacing={2}>
            <TextField select label="Paid?" value={ltForm.isPaid ? 'paid' : 'unpaid'} onChange={(e) => setLtForm((p) => ({ ...p, isPaid: e.target.value === 'paid' }))} size="small" fullWidth>
              <MenuItem value="paid">Paid</MenuItem>
              <MenuItem value="unpaid">Unpaid</MenuItem>
            </TextField>
            <TextField label="Days/Year" value={ltForm.daysPerYear ?? 21} onChange={(e) => setLtForm((p) => ({ ...p, daysPerYear: parseInt(e.target.value) || 0 }))} size="small" type="number" inputProps={{ min: 0 }} fullWidth />
          </Stack>
          {ltEditing && (
            <TextField select label="Status" value={ltForm.isActive ? 'active' : 'inactive'} onChange={(e) => setLtForm((p) => ({ ...p, isActive: e.target.value === 'active' }))} size="small" fullWidth>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </TextField>
          )}
        </Stack>
        <DialogActions sx={{ mt: 1 }}>
          <SecondaryButton onClick={() => setLtOpen(false)}>Cancel</SecondaryButton>
          <PrimaryButton onClick={() => ltSave.mutate()} disabled={!ltForm.name || ltSave.isPending}>{ltSave.isPending ? 'Saving…' : 'Save'}</PrimaryButton>
        </DialogActions>
      </AppModal>

      {/* New Leave Request Modal */}
      <AppModal open={lrOpen} onClose={() => setLrOpen(false)} title="New Leave Request">
        <Stack spacing={2} pt={0.5}>
          <TextField select label="Employee *" value={lrForm.employeeId} onChange={(e) => setLrForm((p) => ({ ...p, employeeId: e.target.value }))} size="small" fullWidth>
            {employees.map((emp) => <MenuItem key={emp.id} value={emp.id}>{emp.name}</MenuItem>)}
          </TextField>
          <TextField select label="Leave Type *" value={lrForm.leaveTypeId} onChange={(e) => setLrForm((p) => ({ ...p, leaveTypeId: e.target.value }))} size="small" fullWidth>
            {leaveTypes.map((lt) => <MenuItem key={lt.id} value={lt.id}>{lt.name} ({lt.isPaid ? 'Paid' : 'Unpaid'})</MenuItem>)}
          </TextField>
          <Stack direction="row" spacing={2}>
            <TextField label="From *" type="date" value={lrForm.fromDate} onChange={(e) => setLrForm((p) => ({ ...p, fromDate: e.target.value }))} size="small" InputLabelProps={{ shrink: true }} fullWidth />
            <TextField label="To *" type="date" value={lrForm.toDate} onChange={(e) => setLrForm((p) => ({ ...p, toDate: e.target.value }))} size="small" InputLabelProps={{ shrink: true }} fullWidth />
          </Stack>
          <TextField label="Reason" value={lrForm.reason} onChange={(e) => setLrForm((p) => ({ ...p, reason: e.target.value }))} size="small" multiline minRows={2} fullWidth />
        </Stack>
        <DialogActions sx={{ mt: 1 }}>
          <SecondaryButton onClick={() => setLrOpen(false)}>Cancel</SecondaryButton>
          <PrimaryButton onClick={() => lrCreate.mutate()} disabled={!lrForm.employeeId || !lrForm.leaveTypeId || !lrForm.fromDate || !lrForm.toDate || lrCreate.isPending}>
            {lrCreate.isPending ? 'Submitting…' : 'Submit'}
          </PrimaryButton>
        </DialogActions>
      </AppModal>

      {/* Rejection reason modal */}
      <AppModal open={!!rejId} onClose={() => setRejId(null)} title="Reject Leave Request">
        <TextField label="Rejection Reason" value={rejReason} onChange={(e) => setRejReason(e.target.value)} size="small" multiline minRows={2} fullWidth sx={{ mt: 0.5 }} />
        <DialogActions sx={{ mt: 1 }}>
          <SecondaryButton onClick={() => setRejId(null)}>Cancel</SecondaryButton>
          <PrimaryButton onClick={() => reject.mutate()} disabled={!rejReason || reject.isPending} color="error">
            {reject.isPending ? 'Rejecting…' : 'Reject'}
          </PrimaryButton>
        </DialogActions>
      </AppModal>

      <Snackbar open={!!snack} autoHideDuration={3500} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="info" onClose={() => setSnack(null)} variant="filled">{snack}</Alert>
      </Snackbar>
    </Box>
  );
}
