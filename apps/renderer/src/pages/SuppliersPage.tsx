import { useState } from 'react';
import { Box, Chip, Divider, Snackbar, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { Supplier, SupplierLedgerEntry } from '../api/types';
import { DataTable } from '../components/DataTable';
import { AppModal } from '../components/AppModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PrimaryButton, SecondaryButton } from '../components/buttons';
import { formatEnumLabel } from '../utils/format';

const EMPTY_FORM = { name: '', phone: '', email: '', address: '' };

export function SuppliersPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Supplier | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Supplier | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const suppliersQuery = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => apiFetch<Supplier[]>('/api/v1/suppliers?includeInactive=true'),
  });

  const ledgerQuery = useQuery({
    queryKey: ['supplier-ledger', selected?.id],
    queryFn: () => apiFetch<SupplierLedgerEntry[]>(`/api/v1/suppliers/${selected?.id}/ledger`),
    enabled: Boolean(selected),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/suppliers', {
        method: 'POST',
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      setSnackbar('Supplier created.');
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not create supplier.'),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/suppliers/${editTarget?.id}`, {
        method: 'PATCH',
        body: JSON.stringify(editForm),
      }),
    onSuccess: () => {
      setSnackbar('Supplier updated.');
      setEditTarget(null);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not update supplier.'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/suppliers/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setSnackbar('Supplier deactivated.');
      setConfirmTarget(null);
      if (selected?.id === confirmTarget?.id) setSelected(null);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not deactivate supplier.'),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/suppliers/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive: true }) }),
    onSuccess: () => {
      setSnackbar('Supplier reactivated.');
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not reactivate supplier.'),
  });

  function openEdit(supplier: Supplier): void {
    setEditTarget(supplier);
    setEditForm({
      name: supplier.name,
      phone: supplier.phone ?? '',
      email: supplier.email ?? '',
      address: supplier.address ?? '',
    });
  }

  return (
    <Box display="flex" height="100%">
      <Box flex={1} p={2} overflow="auto" borderRight="1px solid #e0e0e0">
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Suppliers</Typography>
          <PrimaryButton onClick={() => setCreateOpen(true)}>New Supplier</PrimaryButton>
        </Stack>
        <DataTable
          searchPlaceholder="Search suppliers…"
          emptyMessage="No suppliers found."
          getRowId={(s: Supplier) => s.id}
          rows={suppliersQuery.data ?? []}
          getSearchText={(s) => `${s.name} ${s.phone ?? ''} ${s.email ?? ''}`}
          selectedRowId={selected?.id}
          onRowClick={(s) => setSelected(s)}
          columns={[
            { key: 'name', label: 'Name', sortable: true, render: (s) => s.name },
            { key: 'phone', label: 'Phone', render: (s) => s.phone ?? '—' },
            {
              key: 'currentBalance',
              label: 'Balance',
              align: 'right',
              sortable: true,
              sortValue: (s) => Number(s.currentBalance),
              render: (s) => `$${Number(s.currentBalance).toFixed(2)}`,
            },
            {
              key: 'isActive',
              label: 'Status',
              render: (s) => (
                <Chip
                  size="small"
                  label={s.isActive ? 'Active' : 'Inactive'}
                  color={s.isActive ? 'success' : 'default'}
                />
              ),
            },
            {
              key: 'actions',
              label: '',
              render: (s) => (
                <Stack direction="row" spacing={1} onClick={(e) => e.stopPropagation()}>
                  <SecondaryButton size="small" onClick={() => openEdit(s)}>
                    Edit
                  </SecondaryButton>
                  {s.isActive ? (
                    <SecondaryButton size="small" color="error" onClick={() => setConfirmTarget(s)}>
                      Deactivate
                    </SecondaryButton>
                  ) : (
                    <SecondaryButton size="small" onClick={() => reactivateMutation.mutate(s.id)}>
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
        {!selected && <Typography color="text.secondary">Select a supplier to view their ledger.</Typography>}
        {selected && (
          <>
            <Typography variant="h6">{selected.name}</Typography>
            <Typography color="text.secondary" gutterBottom>
              Balance owed: ${Number(selected.currentBalance).toFixed(2)}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <DataTable
              hideSearch
              defaultRowsPerPage={10}
              emptyMessage="No ledger entries yet."
              getRowId={(entry: SupplierLedgerEntry) => entry.id}
              rows={ledgerQuery.data ?? []}
              columns={[
                {
                  key: 'occurredAt',
                  label: 'Date',
                  sortable: true,
                  sortValue: (e) => new Date(e.occurredAt).getTime(),
                  render: (e) => new Date(e.occurredAt).toLocaleString(),
                },
                { key: 'entryType', label: 'Type', sortable: true, render: (e) => formatEnumLabel(e.entryType) },
                {
                  key: 'amount',
                  label: 'Amount',
                  align: 'right',
                  sortable: true,
                  sortValue: (e) => Number(e.amount),
                  render: (e) => `$${Number(e.amount).toFixed(2)}`,
                },
                {
                  key: 'balanceAfter',
                  label: 'Balance After',
                  align: 'right',
                  render: (e) => `$${Number(e.balanceAfter).toFixed(2)}`,
                },
              ]}
            />
          </>
        )}
      </Box>

      <AppModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Supplier"
        maxWidth="xs"
        actions={
          <>
            <SecondaryButton onClick={() => setCreateOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton disabled={!form.name || createMutation.isPending} onClick={() => createMutation.mutate()}>
              Create
            </PrimaryButton>
          </>
        }
      >
        <Stack spacing={2} mt={0.5}>
          <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          <TextField label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <TextField label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <TextField label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </Stack>
      </AppModal>

      <AppModal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title="Edit Supplier"
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
          <TextField label="Email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
          <TextField label="Address" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
        </Stack>
      </AppModal>

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        title="Deactivate Supplier"
        message={`Deactivate "${confirmTarget?.name}"? Their purchase/ledger history stays intact. You can reactivate them later.`}
        confirmLabel="Deactivate"
        destructive
        onConfirm={() => confirmTarget && deactivateMutation.mutate(confirmTarget.id)}
        onCancel={() => setConfirmTarget(null)}
      />

      <Snackbar open={Boolean(snackbar)} autoHideDuration={3000} onClose={() => setSnackbar(null)} message={snackbar} />
    </Box>
  );
}
