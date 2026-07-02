import { useEffect, useState } from 'react';
import { Box, Chip, IconButton, MenuItem, Snackbar, Stack, TextField, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { Doctor, DayOfWeek, DoctorSchedule, LinkableUser } from '../api/types';
import { DataTable } from '../components/DataTable';
import { AppModal } from '../components/AppModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PrimaryButton, SecondaryButton } from '../components/buttons';

const EMPTY_FORM = {
  name: '',
  specialization: '',
  phone: '',
  email: '',
  roomNumber: '',
  consultationFee: '0',
  linkedUserId: '',
};

const DAYS_OF_WEEK: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

type ScheduleSlotRow = { dayOfWeek: DayOfWeek; startTime: string; endTime: string };

export function DoctorsPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const doctorsQuery = useQuery({
    queryKey: ['doctors'],
    queryFn: () => apiFetch<Doctor[]>('/api/v1/hospital/doctors?includeInactive=true'),
  });

  const linkableUsersQuery = useQuery({
    queryKey: ['hospital-linkable-users'],
    queryFn: () => apiFetch<LinkableUser[]>('/api/v1/hospital/doctors/linkable-users'),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/hospital/doctors', {
        method: 'POST',
        body: JSON.stringify({ ...form, linkedUserId: form.linkedUserId || undefined }),
      }),
    onSuccess: () => {
      setSnackbar('Doctor added.');
      setForm(EMPTY_FORM);
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
      queryClient.invalidateQueries({ queryKey: ['hospital-linkable-users'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not add doctor.'),
  });

  const [editTarget, setEditTarget] = useState<Doctor | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const updateMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/hospital/doctors/${editTarget?.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...editForm, linkedUserId: editForm.linkedUserId || null }),
      }),
    onSuccess: () => {
      setSnackbar('Doctor updated.');
      setEditTarget(null);
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
      queryClient.invalidateQueries({ queryKey: ['hospital-linkable-users'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not update doctor.'),
  });

  const [confirmTarget, setConfirmTarget] = useState<Doctor | null>(null);
  const deactivateMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/hospital/doctors/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setSnackbar('Doctor deactivated.');
      setConfirmTarget(null);
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not deactivate doctor.'),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/hospital/doctors/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive: true }) }),
    onSuccess: () => {
      setSnackbar('Doctor reactivated.');
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not reactivate doctor.'),
  });

  const [scheduleTarget, setScheduleTarget] = useState<Doctor | null>(null);
  const [scheduleRows, setScheduleRows] = useState<ScheduleSlotRow[]>([]);

  const scheduleQuery = useQuery({
    queryKey: ['doctor-schedule', scheduleTarget?.id],
    queryFn: () => apiFetch<DoctorSchedule[]>(`/api/v1/hospital/doctors/${scheduleTarget?.id}/schedule`),
    enabled: Boolean(scheduleTarget),
  });

  const setScheduleMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/hospital/doctors/${scheduleTarget?.id}/schedule`, {
        method: 'PATCH',
        body: JSON.stringify({ slots: scheduleRows }),
      }),
    onSuccess: () => {
      setSnackbar('Schedule saved.');
      setScheduleTarget(null);
      queryClient.invalidateQueries({ queryKey: ['doctor-schedule'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not save schedule.'),
  });

  function openEdit(doctor: Doctor): void {
    setEditTarget(doctor);
    setEditForm({
      name: doctor.name,
      specialization: doctor.specialization ?? '',
      phone: doctor.phone ?? '',
      email: doctor.email ?? '',
      roomNumber: doctor.roomNumber ?? '',
      consultationFee: doctor.consultationFee,
      linkedUserId: doctor.linkedUserId ?? '',
    });
  }

  function openSchedule(doctor: Doctor): void {
    setScheduleTarget(doctor);
    setScheduleRows([]);
  }

  useEffect(() => {
    if (scheduleQuery.data) {
      setScheduleRows(scheduleQuery.data.map((s) => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime })));
    }
  }, [scheduleQuery.data]);

  function linkOptionsFor(currentLinkedUser: Doctor['linkedUser']): LinkableUser[] {
    const linkable = linkableUsersQuery.data ?? [];
    if (currentLinkedUser && !linkable.some((u) => u.id === currentLinkedUser.id)) {
      return [currentLinkedUser, ...linkable];
    }
    return linkable;
  }

  return (
    <Box p={2} height="100%" overflow="auto">
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Doctors</Typography>
        <PrimaryButton onClick={() => setCreateOpen(true)}>Add Doctor</PrimaryButton>
      </Stack>

      <DataTable
        searchPlaceholder="Search doctors…"
        emptyMessage="No doctors yet."
        getRowId={(d: Doctor) => d.id}
        rows={doctorsQuery.data ?? []}
        getSearchText={(d) => `${d.name} ${d.specialization ?? ''}`}
        columns={[
          { key: 'name', label: 'Name', sortable: true, render: (d) => d.name },
          { key: 'specialization', label: 'Specialization', render: (d) => d.specialization ?? '—' },
          { key: 'roomNumber', label: 'Room', render: (d) => d.roomNumber ?? '—' },
          {
            key: 'consultationFee',
            label: 'Fee',
            align: 'right',
            sortValue: (d) => Number(d.consultationFee),
            render: (d) => `$${Number(d.consultationFee).toFixed(2)}`,
          },
          { key: 'linkedUser', label: 'Linked User', render: (d) => d.linkedUser?.fullName ?? '—' },
          {
            key: 'isActive',
            label: 'Status',
            render: (d) => <Chip size="small" label={d.isActive ? 'Active' : 'Inactive'} color={d.isActive ? 'success' : 'default'} />,
          },
          {
            key: 'actions',
            label: '',
            render: (d) => (
              <Stack direction="row" spacing={1}>
                <SecondaryButton size="small" onClick={() => openEdit(d)}>
                  Edit
                </SecondaryButton>
                <SecondaryButton size="small" onClick={() => openSchedule(d)}>
                  Schedule
                </SecondaryButton>
                {d.isActive ? (
                  <SecondaryButton size="small" color="error" onClick={() => setConfirmTarget(d)}>
                    Deactivate
                  </SecondaryButton>
                ) : (
                  <SecondaryButton size="small" onClick={() => reactivateMutation.mutate(d.id)}>
                    Reactivate
                  </SecondaryButton>
                )}
              </Stack>
            ),
          },
        ]}
      />

      <AppModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add Doctor"
        maxWidth="xs"
        actions={
          <>
            <SecondaryButton onClick={() => setCreateOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton disabled={!form.name || createMutation.isPending} onClick={() => createMutation.mutate()}>
              Add
            </PrimaryButton>
          </>
        }
      >
        <Stack spacing={2} mt={0.5}>
          <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          <TextField label="Specialization" value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} />
          <TextField label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <TextField label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <TextField label="Room Number" value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} />
          <TextField
            label="Consultation Fee"
            value={form.consultationFee}
            onChange={(e) => setForm({ ...form, consultationFee: e.target.value })}
          />
          <TextField
            select
            label="Linked User (optional)"
            value={form.linkedUserId}
            onChange={(e) => setForm({ ...form, linkedUserId: e.target.value })}
          >
            <MenuItem value="">None</MenuItem>
            {(linkableUsersQuery.data ?? []).map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.fullName} ({u.username})
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </AppModal>

      <AppModal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title="Edit Doctor"
        maxWidth="xs"
        actions={
          <>
            <SecondaryButton onClick={() => setEditTarget(null)}>Cancel</SecondaryButton>
            <PrimaryButton disabled={!editForm.name || updateMutation.isPending} onClick={() => updateMutation.mutate()}>
              Save
            </PrimaryButton>
          </>
        }
      >
        <Stack spacing={2} mt={0.5}>
          <TextField label="Name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} autoFocus />
          <TextField
            label="Specialization"
            value={editForm.specialization}
            onChange={(e) => setEditForm({ ...editForm, specialization: e.target.value })}
          />
          <TextField label="Phone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
          <TextField label="Email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
          <TextField
            label="Room Number"
            value={editForm.roomNumber}
            onChange={(e) => setEditForm({ ...editForm, roomNumber: e.target.value })}
          />
          <TextField
            label="Consultation Fee"
            value={editForm.consultationFee}
            onChange={(e) => setEditForm({ ...editForm, consultationFee: e.target.value })}
          />
          <TextField
            select
            label="Linked User (optional)"
            value={editForm.linkedUserId}
            onChange={(e) => setEditForm({ ...editForm, linkedUserId: e.target.value })}
          >
            <MenuItem value="">None</MenuItem>
            {linkOptionsFor(editTarget?.linkedUser ?? null).map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.fullName} ({u.username})
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </AppModal>

      <AppModal
        open={Boolean(scheduleTarget)}
        onClose={() => setScheduleTarget(null)}
        title={`Weekly Schedule — ${scheduleTarget?.name ?? ''}`}
        actions={
          <>
            <SecondaryButton onClick={() => setScheduleTarget(null)}>Cancel</SecondaryButton>
            <PrimaryButton disabled={setScheduleMutation.isPending} onClick={() => setScheduleMutation.mutate()}>
              Save
            </PrimaryButton>
          </>
        }
      >
        <Stack spacing={2} mt={0.5}>
          <Typography variant="body2" color="text.secondary">
            Informational only — not enforced when booking appointments.
          </Typography>
          {scheduleRows.map((row, index) => (
            <Stack key={index} direction="row" spacing={1} alignItems="center">
              <TextField
                select
                size="small"
                label="Day"
                value={row.dayOfWeek}
                onChange={(e) =>
                  setScheduleRows((rows) => rows.map((r, i) => (i === index ? { ...r, dayOfWeek: e.target.value as DayOfWeek } : r)))
                }
                sx={{ minWidth: 130 }}
              >
                {DAYS_OF_WEEK.map((day) => (
                  <MenuItem key={day} value={day}>
                    {day.charAt(0).toUpperCase() + day.slice(1)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                label="Start"
                placeholder="09:00"
                value={row.startTime}
                onChange={(e) => setScheduleRows((rows) => rows.map((r, i) => (i === index ? { ...r, startTime: e.target.value } : r)))}
              />
              <TextField
                size="small"
                label="End"
                placeholder="17:00"
                value={row.endTime}
                onChange={(e) => setScheduleRows((rows) => rows.map((r, i) => (i === index ? { ...r, endTime: e.target.value } : r)))}
              />
              <IconButton size="small" onClick={() => setScheduleRows((rows) => rows.filter((_, i) => i !== index))}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          <SecondaryButton
            size="small"
            onClick={() => setScheduleRows((rows) => [...rows, { dayOfWeek: 'monday', startTime: '09:00', endTime: '17:00' }])}
          >
            Add Slot
          </SecondaryButton>
        </Stack>
      </AppModal>

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        title="Deactivate Doctor"
        message={`Deactivate "${confirmTarget?.name}"? Their appointment history stays intact and you can reactivate them later.`}
        confirmLabel="Deactivate"
        destructive
        onConfirm={() => confirmTarget && deactivateMutation.mutate(confirmTarget.id)}
        onCancel={() => setConfirmTarget(null)}
      />

      <Snackbar open={Boolean(snackbar)} autoHideDuration={3000} onClose={() => setSnackbar(null)} message={snackbar} />
    </Box>
  );
}
