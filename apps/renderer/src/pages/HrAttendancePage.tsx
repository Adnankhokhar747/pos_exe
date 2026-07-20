import { useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, DialogActions, Divider,
  FormControl, InputLabel, MenuItem, Select, Snackbar, Stack,
  Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Tooltip, Typography,
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import ListAltIcon from '@mui/icons-material/ListAlt';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { HrAttendance, HrEmployee, AttendanceStatus } from '../api/types';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { AppModal } from '../components/AppModal';
import { PrimaryButton, SecondaryButton } from '../components/buttons';

interface TodayRecord {
  hasEmployee: boolean;
  employee: HrEmployee | null;
  attendance: HrAttendance | null;
}

const STATUS_COLORS: Record<AttendanceStatus, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
  present: 'success', late: 'warning', absent: 'error', half_day: 'info', on_leave: 'default',
};

function fmtMins(mins: number | null): string {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtTime(dt: string | null): string {
  if (!dt) return '—';
  try { return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return dt; }
}

function today(): string { return new Date().toISOString().slice(0, 10); }

interface BulkRow { employeeId: string; employeeName: string; employeeCode: string; status: AttendanceStatus; notes: string; }

export function HrAttendancePage(): JSX.Element {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ date: today(), employeeId: '' });
  const [upsertOpen, setUpsertOpen] = useState(false);
  const [upsertForm, setUpsertForm] = useState<{
    employeeId: string; workDate: string; status: AttendanceStatus; clockIn: string; clockOut: string; notes: string;
  }>({ employeeId: '', workDate: today(), status: 'present', clockIn: '', clockOut: '', notes: '' });
  const [bulkOpen, setBulkOpen]     = useState(false);
  const [bulkDate, setBulkDate]     = useState(today());
  const [bulkRows, setBulkRows]     = useState<BulkRow[]>([]);
  const [snack, setSnack] = useState<string | null>(null);

  const { data: todayData } = useQuery<TodayRecord>({
    queryKey: ['hr-attendance-today'],
    queryFn: () => apiFetch('/api/v1/hr/attendance/my-today'),
    retry: false,
  });

  const { data: records = [] } = useQuery<HrAttendance[]>({
    queryKey: ['hr-attendance', filters],
    queryFn: () => {
      const p = new URLSearchParams({ date: filters.date });
      if (filters.employeeId) p.set('employeeId', filters.employeeId);
      return apiFetch(`/api/v1/hr/attendance?${p}`);
    },
  });

  const { data: employees = [] } = useQuery<HrEmployee[]>({
    queryKey: ['hr-employees'],
    queryFn: () => apiFetch('/api/v1/hr/employees'),
  });

  const clockInMut = useMutation({
    mutationFn: () => apiFetch('/api/v1/hr/attendance/clock-in', { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr-attendance-today'] }); qc.invalidateQueries({ queryKey: ['hr-attendance'] }); setSnack('Clocked in.'); },
    onError: (e) => setSnack(e instanceof ApiError ? e.detail : 'Clock-in failed.'),
  });

  const clockOutMut = useMutation({
    mutationFn: () => apiFetch('/api/v1/hr/attendance/clock-out', { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr-attendance-today'] }); qc.invalidateQueries({ queryKey: ['hr-attendance'] }); setSnack('Clocked out.'); },
    onError: (e) => setSnack(e instanceof ApiError ? e.detail : 'Clock-out failed.'),
  });

  const upsertMut = useMutation({
    mutationFn: () => apiFetch('/api/v1/hr/attendance/upsert', { method: 'POST', body: JSON.stringify(upsertForm) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr-attendance'] }); setUpsertOpen(false); setSnack('Attendance saved.'); },
    onError: (e) => setSnack(e instanceof ApiError ? e.detail : 'Failed to save.'),
  });

  const bulkMut = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/hr/attendance/bulk', {
        method: 'POST',
        body: {
          records: bulkRows.map(r => ({
            employeeId: r.employeeId,
            workDate: bulkDate,
            status: r.status,
            notes: r.notes || undefined,
          })),
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-attendance'] });
      setBulkOpen(false);
      setSnack(`Bulk attendance saved for ${bulkRows.length} employees.`);
    },
    onError: (e) => setSnack(e instanceof ApiError ? e.detail : 'Bulk save failed.'),
  });

  const openBulkModal = () => {
    const activeEmps = employees.filter(e => e.isActive);
    setBulkRows(activeEmps.map(e => ({
      employeeId: e.id,
      employeeName: e.name,
      employeeCode: e.employeeCode ?? '',
      status: 'present' as AttendanceStatus,
      notes: '',
    })));
    setBulkDate(today());
    setBulkOpen(true);
  };

  const setBulkRowField = (idx: number, field: keyof BulkRow, value: string) => {
    setBulkRows(rows => rows.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const COLS: DataTableColumn<HrAttendance>[] = [
    { key: 'emp', label: 'Employee', sortable: true, render: (r) => <Typography fontWeight={600}>{r.employeeName}</Typography> },
    { key: 'date', label: 'Date', render: (r) => r.workDate },
    {
      key: 'status', label: 'Status', render: (r) =>
        <Chip label={r.status.replace('_', ' ')} size="small" color={STATUS_COLORS[r.status] ?? 'default'} variant="outlined" />,
    },
    { key: 'in', label: 'Clock In', render: (r) => fmtTime(r.clockIn) },
    { key: 'out', label: 'Clock Out', render: (r) => fmtTime(r.clockOut) },
    { key: 'work', label: 'Work Time', align: 'right', render: (r) => fmtMins(r.workMinutes) },
    { key: 'ot', label: 'Overtime', align: 'right', render: (r) => r.overtimeMinutes ? <Chip label={fmtMins(r.overtimeMinutes)} size="small" color="info" variant="outlined" /> : '—' },
    { key: 'notes', label: 'Notes', render: (r) => r.notes ?? '—' },
  ];

  const att = todayData?.attendance;
  const hasEmployee = todayData?.hasEmployee;
  const canClockIn  = hasEmployee && !att?.clockIn;
  const canClockOut = hasEmployee && !!att?.clockIn && !att?.clockOut;

  return (
    <Box p={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" fontWeight={700}>Attendance</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<ListAltIcon />}
            onClick={openBulkModal}
            disabled={employees.length === 0}
          >
            Bulk Entry
          </Button>
          <SecondaryButton onClick={() => { setUpsertForm({ employeeId: '', workDate: today(), status: 'present', clockIn: '', clockOut: '', notes: '' }); setUpsertOpen(true); }}>
            Manual Entry
          </SecondaryButton>
        </Stack>
      </Stack>

      {hasEmployee && (
        <Card variant="outlined" sx={{ mb: 2.5 }}>
          <CardContent>
            <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap" gap={1}>
              <AccessTimeIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
              <Box flex={1}>
                <Typography fontWeight={700}>{todayData?.employee?.name}</Typography>
                <Typography variant="body2" color="text.secondary">Today: {today()}</Typography>
              </Box>
              <Stack direction="row" spacing={2} alignItems="center">
                <Box textAlign="center">
                  <Typography variant="caption" color="text.secondary">Clock In</Typography>
                  <Typography fontWeight={600}>{fmtTime(att?.clockIn ?? null)}</Typography>
                </Box>
                <Box textAlign="center">
                  <Typography variant="caption" color="text.secondary">Clock Out</Typography>
                  <Typography fontWeight={600}>{fmtTime(att?.clockOut ?? null)}</Typography>
                </Box>
                {att?.status && (
                  <Chip label={att.status.replace('_', ' ')} size="small" color={STATUS_COLORS[att.status] ?? 'default'} />
                )}
              </Stack>
              <Stack direction="row" spacing={1}>
                <Tooltip title={canClockIn ? 'Clock In' : 'Already clocked in'}>
                  <span>
                    <PrimaryButton
                      startIcon={<LoginIcon />}
                      onClick={() => clockInMut.mutate()}
                      disabled={!canClockIn || clockInMut.isPending}
                    >
                      Clock In
                    </PrimaryButton>
                  </span>
                </Tooltip>
                <Tooltip title={canClockOut ? 'Clock Out' : att?.clockOut ? 'Already clocked out' : 'Clock in first'}>
                  <span>
                    <SecondaryButton
                      startIcon={<LogoutIcon />}
                      onClick={() => clockOutMut.mutate()}
                      disabled={!canClockOut || clockOutMut.isPending}
                    >
                      Clock Out
                    </SecondaryButton>
                  </span>
                </Tooltip>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Stack direction="row" spacing={2} mb={2}>
        <TextField label="Date" type="date" value={filters.date} onChange={(e) => setFilters((p) => ({ ...p, date: e.target.value }))} size="small" InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
        <TextField select label="Employee" value={filters.employeeId} onChange={(e) => setFilters((p) => ({ ...p, employeeId: e.target.value }))} size="small" sx={{ minWidth: 180 }}>
          <MenuItem value="">All Employees</MenuItem>
          {employees.map((emp) => <MenuItem key={emp.id} value={emp.id}>{emp.name}</MenuItem>)}
        </TextField>
      </Stack>

      <DataTable columns={COLS} rows={records} getRowId={(r) => r.id} getSearchText={(r) => `${r.employeeName} ${r.workDate}`} emptyMessage="No attendance records for the selected date." />

      <AppModal open={upsertOpen} onClose={() => setUpsertOpen(false)} title="Manual Attendance Entry">
        <Stack spacing={2} pt={0.5}>
          <TextField select label="Employee *" value={upsertForm.employeeId} onChange={(e) => setUpsertForm((p) => ({ ...p, employeeId: e.target.value }))} size="small" fullWidth>
            {employees.map((emp) => <MenuItem key={emp.id} value={emp.id}>{emp.name}</MenuItem>)}
          </TextField>
          <Stack direction="row" spacing={2}>
            <TextField label="Date" type="date" value={upsertForm.workDate} onChange={(e) => setUpsertForm((p) => ({ ...p, workDate: e.target.value }))} size="small" InputLabelProps={{ shrink: true }} fullWidth />
            <TextField select label="Status" value={upsertForm.status} onChange={(e) => setUpsertForm((p) => ({ ...p, status: e.target.value as AttendanceStatus }))} size="small" fullWidth>
              {(['present', 'absent', 'late', 'half_day', 'on_leave'] as AttendanceStatus[]).map((s) => (
                <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>
              ))}
            </TextField>
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField label="Clock In" type="time" value={upsertForm.clockIn} onChange={(e) => setUpsertForm((p) => ({ ...p, clockIn: e.target.value }))} size="small" InputLabelProps={{ shrink: true }} fullWidth />
            <TextField label="Clock Out" type="time" value={upsertForm.clockOut} onChange={(e) => setUpsertForm((p) => ({ ...p, clockOut: e.target.value }))} size="small" InputLabelProps={{ shrink: true }} fullWidth />
          </Stack>
          <TextField label="Notes" value={upsertForm.notes} onChange={(e) => setUpsertForm((p) => ({ ...p, notes: e.target.value }))} size="small" multiline minRows={2} fullWidth />
        </Stack>
        <DialogActions sx={{ mt: 1 }}>
          <SecondaryButton onClick={() => setUpsertOpen(false)}>Cancel</SecondaryButton>
          <PrimaryButton onClick={() => upsertMut.mutate()} disabled={!upsertForm.employeeId || upsertMut.isPending}>
            {upsertMut.isPending ? 'Saving…' : 'Save'}
          </PrimaryButton>
        </DialogActions>
      </AppModal>

      {/* Bulk Entry Modal */}
      <AppModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Bulk Attendance Entry"
        maxWidth="md"
      >
        <Stack spacing={2} mt={1}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <TextField
              label="Date"
              type="date"
              value={bulkDate}
              onChange={e => setBulkDate(e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
              sx={{ width: 180 }}
            />
            <Typography variant="body2" color="text.secondary">
              Mark attendance for all {bulkRows.length} active employees
            </Typography>
          </Stack>

          <Divider />

          <Box sx={{ maxHeight: 420, overflowY: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Employee</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} width={180}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bulkRows.map((row, idx) => (
                  <TableRow key={row.employeeId}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{row.employeeName}</Typography>
                      <Typography variant="caption" color="text.secondary">{row.employeeCode}</Typography>
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" fullWidth>
                        <Select
                          value={row.status}
                          onChange={e => setBulkRowField(idx, 'status', e.target.value)}
                        >
                          {(['present', 'absent', 'late', 'half_day', 'on_leave'] as AttendanceStatus[]).map(s => (
                            <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        placeholder="Optional"
                        value={row.notes}
                        onChange={e => setBulkRowField(idx, 'notes', e.target.value)}
                        fullWidth
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Stack>
        <DialogActions sx={{ mt: 2, px: 0 }}>
          <SecondaryButton onClick={() => setBulkOpen(false)}>Cancel</SecondaryButton>
          <PrimaryButton
            onClick={() => bulkMut.mutate()}
            disabled={bulkMut.isPending || bulkRows.length === 0 || !bulkDate}
          >
            {bulkMut.isPending ? 'Saving…' : `Save All (${bulkRows.length})`}
          </PrimaryButton>
        </DialogActions>
      </AppModal>

      <Snackbar open={!!snack} autoHideDuration={3500} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="info" onClose={() => setSnack(null)} variant="filled">{snack}</Alert>
      </Snackbar>
    </Box>
  );
}
