import { useState } from 'react';
import { Box, Chip, MenuItem, Snackbar, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { Appointment, Patient } from '../api/types';
import { DataTable } from '../components/DataTable';
import { AppModal } from '../components/AppModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PrimaryButton, SecondaryButton } from '../components/buttons';
import { formatEnumLabel } from '../utils/format';

const EMPTY_FORM = { name: '', phone: '', gender: '', dateOfBirth: '', address: '' };

export function PatientsPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Patient | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const patientsQuery = useQuery({
    queryKey: ['patients'],
    queryFn: () => apiFetch<Patient[]>('/api/v1/hospital/patients?includeInactive=true'),
  });

  const historyQuery = useQuery({
    queryKey: ['patient-appointments', selected?.id],
    queryFn: () => apiFetch<Appointment[]>(`/api/v1/hospital/patients/${selected?.id}/appointments`),
    enabled: Boolean(selected),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/hospital/patients', {
        method: 'POST',
        body: JSON.stringify({ ...form, dateOfBirth: form.dateOfBirth || undefined, gender: form.gender || undefined }),
      }),
    onSuccess: () => {
      setSnackbar('Patient added.');
      setForm(EMPTY_FORM);
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not add patient.'),
  });

  const [editTarget, setEditTarget] = useState<Patient | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const updateMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/hospital/patients/${editTarget?.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...editForm, dateOfBirth: editForm.dateOfBirth || undefined, gender: editForm.gender || undefined }),
      }),
    onSuccess: () => {
      setSnackbar('Patient updated.');
      setEditTarget(null);
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not update patient.'),
  });

  const [confirmTarget, setConfirmTarget] = useState<Patient | null>(null);
  const deactivateMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/hospital/patients/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setSnackbar('Patient deactivated.');
      setConfirmTarget(null);
      if (selected?.id === confirmTarget?.id) setSelected(null);
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not deactivate patient.'),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/hospital/patients/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive: true }) }),
    onSuccess: () => {
      setSnackbar('Patient reactivated.');
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not reactivate patient.'),
  });

  function openEdit(patient: Patient): void {
    setEditTarget(patient);
    setEditForm({
      name: patient.name,
      phone: patient.phone ?? '',
      gender: patient.gender ?? '',
      dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.slice(0, 10) : '',
      address: patient.address ?? '',
    });
  }

  return (
    <Box display="flex" height="100%">
      <Box flex={1} p={2} overflow="auto" borderRight="1px solid #e0e0e0">
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Patients</Typography>
          <PrimaryButton onClick={() => setCreateOpen(true)}>Add Patient</PrimaryButton>
        </Stack>
        <DataTable
          searchPlaceholder="Search patients…"
          emptyMessage="No patients yet."
          getRowId={(p: Patient) => p.id}
          rows={patientsQuery.data ?? []}
          getSearchText={(p) => `${p.name} ${p.phone ?? ''}`}
          selectedRowId={selected?.id}
          onRowClick={(p) => setSelected(p)}
          columns={[
            { key: 'name', label: 'Name', sortable: true, render: (p) => p.name },
            { key: 'phone', label: 'Phone', render: (p) => p.phone ?? '—' },
            { key: 'gender', label: 'Gender', render: (p) => (p.gender ? formatEnumLabel(p.gender) : '—') },
            {
              key: 'isActive',
              label: 'Status',
              render: (p) => <Chip size="small" label={p.isActive ? 'Active' : 'Inactive'} color={p.isActive ? 'success' : 'default'} />,
            },
            {
              key: 'actions',
              label: '',
              render: (p) => (
                <Stack direction="row" spacing={1} onClick={(e) => e.stopPropagation()}>
                  <SecondaryButton size="small" onClick={() => openEdit(p)}>
                    Edit
                  </SecondaryButton>
                  {p.isActive ? (
                    <SecondaryButton size="small" color="error" onClick={() => setConfirmTarget(p)}>
                      Deactivate
                    </SecondaryButton>
                  ) : (
                    <SecondaryButton size="small" onClick={() => reactivateMutation.mutate(p.id)}>
                      Reactivate
                    </SecondaryButton>
                  )}
                </Stack>
              ),
            },
          ]}
        />
      </Box>

      <Box flex={1} p={2} overflow="auto">
        {!selected && <Typography color="text.secondary">Select a patient to view their appointment history.</Typography>}
        {selected && (
          <>
            <Typography variant="h6" gutterBottom>
              {selected.name}
            </Typography>
            <Typography color="text.secondary" gutterBottom>
              {selected.phone ?? 'No phone'} · {selected.address ?? 'No address'}
            </Typography>
            <DataTable
              hideSearch
              defaultRowsPerPage={10}
              emptyMessage="No appointments yet."
              getRowId={(a: Appointment) => a.id}
              rows={historyQuery.data ?? []}
              columns={[
                {
                  key: 'appointmentDate',
                  label: 'Date',
                  sortable: true,
                  sortValue: (a) => new Date(a.appointmentDate).getTime(),
                  render: (a) => new Date(a.appointmentDate).toLocaleDateString(),
                },
                { key: 'doctor', label: 'Doctor', render: (a) => a.doctor.name },
                { key: 'tokenNumber', label: 'Token', align: 'right', render: (a) => a.tokenNumber },
                { key: 'appointmentType', label: 'Type', render: (a) => formatEnumLabel(a.appointmentType) },
                { key: 'status', label: 'Status', render: (a) => formatEnumLabel(a.status) },
              ]}
            />
          </>
        )}
      </Box>

      <AppModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add Patient"
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
          <TextField label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <TextField select label="Gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            <MenuItem value="">Unspecified</MenuItem>
            <MenuItem value="male">Male</MenuItem>
            <MenuItem value="female">Female</MenuItem>
            <MenuItem value="other">Other</MenuItem>
          </TextField>
          <TextField
            label="Date of Birth"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={form.dateOfBirth}
            onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
          />
          <TextField label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </Stack>
      </AppModal>

      <AppModal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title="Edit Patient"
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
          <TextField label="Phone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
          <TextField select label="Gender" value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}>
            <MenuItem value="">Unspecified</MenuItem>
            <MenuItem value="male">Male</MenuItem>
            <MenuItem value="female">Female</MenuItem>
            <MenuItem value="other">Other</MenuItem>
          </TextField>
          <TextField
            label="Date of Birth"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={editForm.dateOfBirth}
            onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
          />
          <TextField label="Address" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
        </Stack>
      </AppModal>

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        title="Deactivate Patient"
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
