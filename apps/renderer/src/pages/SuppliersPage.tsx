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
import { useModules } from '../state/modules-context';

const EMPTY_FORM = {
  name: '', phone: '', email: '', address: '',
  taxNumber: '', crNumber: '', buildingNumber: '', streetName: '', district: '', city: '', postalCode: '', countryCode: '',
};

export function SuppliersPage(): JSX.Element {
  const queryClient = useQueryClient();
  const { isModuleEnabled } = useModules();
  const einvoiceEnabled = isModuleEnabled('einvoice');
  const [selected, setSelected]       = useState<Supplier | null>(null);
  const [createOpen, setCreateOpen]   = useState(false);
  const [editTarget, setEditTarget]   = useState<Supplier | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Supplier | null>(null);
  const [snackbar, setSnackbar]       = useState<string | null>(null);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [editForm, setEditForm]       = useState(EMPTY_FORM);

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
    mutationFn: () => apiFetch('/api/v1/suppliers', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      setSnackbar('Supplier created.');
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (e) => setSnackbar(e instanceof ApiError ? e.detail : 'Could not create supplier.'),
  });

  const updateMutation = useMutation({
    mutationFn: () => apiFetch(`/api/v1/suppliers/${editTarget?.id}`, { method: 'PATCH', body: JSON.stringify(editForm) }),
    onSuccess: () => {
      setSnackbar('Supplier updated.');
      setEditTarget(null);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (e) => setSnackbar(e instanceof ApiError ? e.detail : 'Could not update supplier.'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/suppliers/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setSnackbar('Supplier deactivated.');
      setConfirmTarget(null);
      if (selected?.id === confirmTarget?.id) setSelected(null);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (e) => setSnackbar(e instanceof ApiError ? e.detail : 'Could not deactivate supplier.'),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/suppliers/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive: true }) }),
    onSuccess: () => {
      setSnackbar('Supplier reactivated.');
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (e) => setSnackbar(e instanceof ApiError ? e.detail : 'Could not reactivate supplier.'),
  });

  function openEdit(supplier: Supplier): void {
    setEditTarget(supplier);
    setEditForm({
      name:           supplier.name,
      phone:          supplier.phone          ?? '',
      email:          supplier.email          ?? '',
      address:        supplier.address        ?? '',
      taxNumber:      supplier.taxNumber      ?? '',
      crNumber:       supplier.crNumber       ?? '',
      buildingNumber: supplier.buildingNumber ?? '',
      streetName:     supplier.streetName     ?? '',
      district:       supplier.district       ?? '',
      city:           supplier.city           ?? '',
      postalCode:     supplier.postalCode     ?? '',
      countryCode:    supplier.countryCode    ?? '',
    });
  }

  return (
    <Box p={2}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Suppliers</Typography>
        <PrimaryButton onClick={() => setCreateOpen(true)}>New Supplier</PrimaryButton>
      </Stack>

      {/* Full-width supplier table */}
      <DataTable
        searchPlaceholder="Search suppliers…"
        emptyMessage="No suppliers found."
        getRowId={(s: Supplier) => s.id}
        rows={suppliersQuery.data ?? []}
        getSearchText={(s) => `${s.name} ${s.phone ?? ''} ${s.email ?? ''}`}
        columns={[
          { key: 'name',  label: 'Name',  sortable: true, render: (s) => s.name },
          { key: 'phone', label: 'Phone', render: (s) => s.phone ?? '—' },
          { key: 'email', label: 'Email', render: (s) => s.email ?? '—' },
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
              <Chip size="small" label={s.isActive ? 'Active' : 'Inactive'} color={s.isActive ? 'success' : 'default'} />
            ),
          },
          {
            key: 'actions',
            label: '',
            render: (s) => (
              <Stack direction="row" spacing={1} onClick={(e) => e.stopPropagation()}>
                <SecondaryButton size="small" onClick={() => setSelected(s)}>View</SecondaryButton>
                <SecondaryButton size="small" onClick={() => openEdit(s)}>Edit</SecondaryButton>
                {s.isActive ? (
                  <SecondaryButton size="small" color="error" onClick={() => setConfirmTarget(s)}>Deactivate</SecondaryButton>
                ) : (
                  <SecondaryButton size="small" onClick={() => reactivateMutation.mutate(s.id)}>Reactivate</SecondaryButton>
                )}
              </Stack>
            ),
          },
        ]}
      />

      {/* ── Supplier Detail Modal ─────────────────────────────────────── */}
      <AppModal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ''}
        maxWidth="md"
        actions={<SecondaryButton onClick={() => setSelected(null)}>Close</SecondaryButton>}
      >
        {selected && (
          <Box>
            {/* Summary bar */}
            <Stack direction="row" spacing={3} mb={2} flexWrap="wrap">
              <Box>
                <Typography variant="caption" color="text.secondary">Balance Owed</Typography>
                <Typography fontWeight={700} color={Number(selected.currentBalance) > 0 ? 'warning.main' : 'text.primary'}>
                  ${Number(selected.currentBalance).toFixed(2)}
                </Typography>
              </Box>
              {selected.phone && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Phone</Typography>
                  <Typography fontWeight={700}>{selected.phone}</Typography>
                </Box>
              )}
              {selected.email && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Email</Typography>
                  <Typography fontWeight={700}>{selected.email}</Typography>
                </Box>
              )}
              {selected.address && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Address</Typography>
                  <Typography fontWeight={700}>{selected.address}</Typography>
                </Box>
              )}
            </Stack>

            <Divider sx={{ mb: 1.5 }} />

            {/* Ledger */}
            <Typography variant="subtitle2" fontWeight={700} mb={1}>Ledger</Typography>
            <DataTable
              hideSearch
              defaultRowsPerPage={10}
              emptyMessage="No ledger entries yet."
              getRowId={(e: SupplierLedgerEntry) => e.id}
              rows={ledgerQuery.data ?? []}
              columns={[
                {
                  key: 'occurredAt',
                  label: 'Date',
                  sortable: true,
                  sortValue: (e) => new Date(e.occurredAt).getTime(),
                  render: (e) => new Date(e.occurredAt).toLocaleString(),
                },
                { key: 'entryType',    label: 'Type',         sortable: true, render: (e) => formatEnumLabel(e.entryType) },
                { key: 'amount',       label: 'Amount',       align: 'right', sortable: true, sortValue: (e) => Number(e.amount), render: (e) => `$${Number(e.amount).toFixed(2)}` },
                { key: 'balanceAfter', label: 'Balance After', align: 'right', render: (e) => `$${Number(e.balanceAfter).toFixed(2)}` },
              ]}
            />
          </Box>
        )}
      </AppModal>

      {/* ── Create modal ─────────────────────────────────────────────── */}
      <AppModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Supplier"
        maxWidth={einvoiceEnabled ? 'sm' : 'xs'}
        actions={
          <>
            <SecondaryButton onClick={() => setCreateOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton disabled={!form.name || createMutation.isPending} onClick={() => createMutation.mutate()}>Create</PrimaryButton>
          </>
        }
      >
        <Stack spacing={2} mt={0.5}>
          <TextField label="Name"    value={form.name}    onChange={(e) => setForm({ ...form, name: e.target.value })}    autoFocus />
          <TextField label="Phone"   value={form.phone}   onChange={(e) => setForm({ ...form, phone: e.target.value })}   />
          <TextField label="Email"   value={form.email}   onChange={(e) => setForm({ ...form, email: e.target.value })}   />
          <TextField label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          {einvoiceEnabled && (
            <>
              <Divider><Typography variant="caption" color="text.secondary">VAT / Tax Info (E-Invoice)</Typography></Divider>
              <Stack direction="row" spacing={1.5}>
                <TextField label="VAT / Tax Number" value={form.taxNumber} onChange={(e) => setForm({ ...form, taxNumber: e.target.value })} fullWidth />
                <TextField label="CR Number" value={form.crNumber} onChange={(e) => setForm({ ...form, crNumber: e.target.value })} fullWidth />
              </Stack>
              <Stack direction="row" spacing={1.5}>
                <TextField label="Building No." value={form.buildingNumber} onChange={(e) => setForm({ ...form, buildingNumber: e.target.value })} sx={{ width: 140 }} />
                <TextField label="Street Name" value={form.streetName} onChange={(e) => setForm({ ...form, streetName: e.target.value })} fullWidth />
              </Stack>
              <Stack direction="row" spacing={1.5}>
                <TextField label="District" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} fullWidth />
                <TextField label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} fullWidth />
              </Stack>
              <Stack direction="row" spacing={1.5}>
                <TextField label="Postal Code" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} sx={{ width: 140 }} />
                <TextField label="Country Code" value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value.toUpperCase() })} sx={{ width: 120 }} inputProps={{ maxLength: 2 }} />
              </Stack>
            </>
          )}
        </Stack>
      </AppModal>

      {/* ── Edit modal ───────────────────────────────────────────────── */}
      <AppModal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title="Edit Supplier"
        maxWidth={einvoiceEnabled ? 'sm' : 'xs'}
        actions={
          <>
            <SecondaryButton onClick={() => setEditTarget(null)}>Cancel</SecondaryButton>
            <PrimaryButton disabled={!editForm.name || updateMutation.isPending} onClick={() => updateMutation.mutate()}>Save</PrimaryButton>
          </>
        }
      >
        <Stack spacing={2} mt={0.5}>
          <TextField label="Name"    value={editForm.name}    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}    autoFocus />
          <TextField label="Phone"   value={editForm.phone}   onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}   />
          <TextField label="Email"   value={editForm.email}   onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}   />
          <TextField label="Address" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
          {einvoiceEnabled && (
            <>
              <Divider><Typography variant="caption" color="text.secondary">VAT / Tax Info (E-Invoice)</Typography></Divider>
              <Stack direction="row" spacing={1.5}>
                <TextField label="VAT / Tax Number" value={editForm.taxNumber} onChange={(e) => setEditForm({ ...editForm, taxNumber: e.target.value })} fullWidth />
                <TextField label="CR Number" value={editForm.crNumber} onChange={(e) => setEditForm({ ...editForm, crNumber: e.target.value })} fullWidth />
              </Stack>
              <Stack direction="row" spacing={1.5}>
                <TextField label="Building No." value={editForm.buildingNumber} onChange={(e) => setEditForm({ ...editForm, buildingNumber: e.target.value })} sx={{ width: 140 }} />
                <TextField label="Street Name" value={editForm.streetName} onChange={(e) => setEditForm({ ...editForm, streetName: e.target.value })} fullWidth />
              </Stack>
              <Stack direction="row" spacing={1.5}>
                <TextField label="District" value={editForm.district} onChange={(e) => setEditForm({ ...editForm, district: e.target.value })} fullWidth />
                <TextField label="City" value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} fullWidth />
              </Stack>
              <Stack direction="row" spacing={1.5}>
                <TextField label="Postal Code" value={editForm.postalCode} onChange={(e) => setEditForm({ ...editForm, postalCode: e.target.value })} sx={{ width: 140 }} />
                <TextField label="Country Code" value={editForm.countryCode} onChange={(e) => setEditForm({ ...editForm, countryCode: e.target.value.toUpperCase() })} sx={{ width: 120 }} inputProps={{ maxLength: 2 }} />
              </Stack>
            </>
          )}
        </Stack>
      </AppModal>

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        title="Deactivate Supplier"
        message={`Deactivate "${confirmTarget?.name}"? Their purchase and ledger history stays intact. You can reactivate them later.`}
        confirmLabel="Deactivate"
        destructive
        onConfirm={() => confirmTarget && deactivateMutation.mutate(confirmTarget.id)}
        onCancel={() => setConfirmTarget(null)}
      />

      <Snackbar open={Boolean(snackbar)} autoHideDuration={3000} onClose={() => setSnackbar(null)} message={snackbar} />
    </Box>
  );
}
