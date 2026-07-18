import { useState } from 'react';
import { Box, Chip, MenuItem, Snackbar, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { LeaseProperty } from '../api/types';
import { DataTable } from '../components/DataTable';
import { AppModal } from '../components/AppModal';
import { PrimaryButton, SecondaryButton } from '../components/buttons';

const TYPES = [
  { value: 'residential', label: 'Residential' },
  { value: 'commercial',  label: 'Commercial' },
  { value: 'equipment',   label: 'Equipment' },
  { value: 'other',       label: 'Other' },
];

const EMPTY = { name: '', type: 'residential', address: '', description: '', baseRent: '' };

export function LeasePropertiesPage(): JSX.Element {
  const qc = useQueryClient();
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const { data: properties = [], isLoading } = useQuery<LeaseProperty[]>({
    queryKey: ['lease-properties'],
    queryFn: () => apiFetch('/api/v1/lease/properties?includeInactive=true'),
  });

  // ── Create ────────────────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const createMut = useMutation({
    mutationFn: () => apiFetch('/api/v1/lease/properties', {
      method: 'POST',
      body: JSON.stringify({ ...form, baseRent: parseFloat(form.baseRent) || 0 }),
    }),
    onSuccess: () => {
      setSnackbar('Property added.');
      setForm(EMPTY);
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ['lease-properties'] });
    },
    onError: (e) => setSnackbar(e instanceof ApiError ? e.detail : 'Could not add property.'),
  });

  // ── Edit ──────────────────────────────────────────────────────────────────────
  const [editTarget, setEditTarget] = useState<LeaseProperty | null>(null);
  const [editForm, setEditForm] = useState(EMPTY);

  function openEdit(p: LeaseProperty) {
    setEditTarget(p);
    setEditForm({ name: p.name, type: p.type, address: p.address ?? '', description: p.description ?? '', baseRent: String(p.baseRent) });
  }

  const updateMut = useMutation({
    mutationFn: () => apiFetch(`/api/v1/lease/properties/${editTarget?.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...editForm, baseRent: parseFloat(editForm.baseRent) || 0 }),
    }),
    onSuccess: () => {
      setSnackbar('Property updated.');
      setEditTarget(null);
      qc.invalidateQueries({ queryKey: ['lease-properties'] });
    },
    onError: (e) => setSnackbar(e instanceof ApiError ? e.detail : 'Could not update.'),
  });

  const toggleMut = useMutation({
    mutationFn: (p: LeaseProperty) => apiFetch(`/api/v1/lease/properties/${p.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !p.isActive }),
    }),
    onSuccess: (_d, p) => {
      setSnackbar(p.isActive ? 'Property deactivated.' : 'Property activated.');
      qc.invalidateQueries({ queryKey: ['lease-properties'] });
    },
    onError: (e) => setSnackbar(e instanceof ApiError ? e.detail : 'Could not update.'),
  });

  const activeForm = editTarget ? editForm : form;
  const setActiveForm = editTarget ? setEditForm : setForm;

  const formBody = (
    <Stack spacing={2}>
      <TextField label="Property Name" fullWidth value={activeForm.name} onChange={(e) => setActiveForm((p) => ({ ...p, name: e.target.value }))} />
      <TextField label="Type" select fullWidth value={activeForm.type} onChange={(e) => setActiveForm((p) => ({ ...p, type: e.target.value }))}>
        {TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
      </TextField>
      <TextField label="Address" fullWidth multiline rows={2} value={activeForm.address} onChange={(e) => setActiveForm((p) => ({ ...p, address: e.target.value }))} />
      <TextField label="Description" fullWidth multiline rows={2} value={activeForm.description} onChange={(e) => setActiveForm((p) => ({ ...p, description: e.target.value }))} />
      <TextField label="Base Rent" type="number" fullWidth inputProps={{ min: 0, step: 0.01 }} value={activeForm.baseRent} onChange={(e) => setActiveForm((p) => ({ ...p, baseRent: e.target.value }))} />
    </Stack>
  );

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>Properties</Typography>
        <PrimaryButton onClick={() => setCreateOpen(true)}>+ Add Property</PrimaryButton>
      </Box>

      {isLoading && <Typography color="text.secondary" mb={2}>Loading…</Typography>}
      <DataTable
        rows={properties}
        getRowId={(r) => r.id}
        getSearchText={(r) => `${r.name} ${r.type} ${r.address ?? ''}`}
        columns={[
          { key: 'name',     label: 'Name',      render: (r) => r.name },
          { key: 'type',     label: 'Type',      render: (r) => <Chip label={r.type} size="small" /> },
          { key: 'address',  label: 'Address',   render: (r) => r.address ?? '—' },
          { key: 'baseRent', label: 'Base Rent', align: 'right', render: (r) => parseFloat(r.baseRent).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
          { key: 'isActive', label: 'Status',    render: (r) => <Chip label={r.isActive ? 'Active' : 'Inactive'} color={r.isActive ? 'success' : 'default'} size="small" /> },
          {
            key: 'actions', label: '', render: (r) => (
              <Stack direction="row" spacing={1}>
                <SecondaryButton size="small" onClick={() => openEdit(r)}>Edit</SecondaryButton>
                <SecondaryButton size="small" onClick={() => toggleMut.mutate(r)}>{r.isActive ? 'Deactivate' : 'Activate'}</SecondaryButton>
              </Stack>
            ),
          },
        ]}
      />

      <AppModal open={createOpen} onClose={() => setCreateOpen(false)} title="Add Property"
        actions={<><SecondaryButton onClick={() => setCreateOpen(false)}>Cancel</SecondaryButton><PrimaryButton loading={createMut.isPending} onClick={() => createMut.mutate()}>Save</PrimaryButton></>}
      >{formBody}</AppModal>

      <AppModal open={Boolean(editTarget)} onClose={() => setEditTarget(null)} title="Edit Property"
        actions={<><SecondaryButton onClick={() => setEditTarget(null)}>Cancel</SecondaryButton><PrimaryButton loading={updateMut.isPending} onClick={() => updateMut.mutate()}>Update</PrimaryButton></>}
      >{formBody}</AppModal>

      <Snackbar open={Boolean(snackbar)} autoHideDuration={3000} onClose={() => setSnackbar(null)} message={snackbar} />
    </Box>
  );
}
