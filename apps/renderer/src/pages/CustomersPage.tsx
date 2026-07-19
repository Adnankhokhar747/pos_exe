import { useState } from 'react';
import { Box, Chip, Divider, Snackbar, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { Customer, CustomerLedgerEntry, LoyaltyTransaction } from '../api/types';
import { DataTable } from '../components/DataTable';
import { AppModal } from '../components/AppModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PrimaryButton, SecondaryButton } from '../components/buttons';
import { formatEnumLabel } from '../utils/format';
import { useModules } from '../state/modules-context';

const EMPTY_FORM = {
  name: '', phone: '', email: '', address: '', creditLimit: '0',
  taxNumber: '', crNumber: '', buildingNumber: '', streetName: '', district: '', city: '', postalCode: '', countryCode: '',
};

export function CustomersPage(): JSX.Element {
  const queryClient = useQueryClient();
  const { isModuleEnabled } = useModules();
  const einvoiceEnabled = isModuleEnabled('einvoice');
  const [selected, setSelected]       = useState<Customer | null>(null);
  const [createOpen, setCreateOpen]   = useState(false);
  const [editTarget, setEditTarget]   = useState<Customer | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [snackbar, setSnackbar]       = useState<string | null>(null);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [editForm, setEditForm]       = useState(EMPTY_FORM);

  const customersQuery = useQuery({
    queryKey: ['customers'],
    queryFn: () => apiFetch<Customer[]>('/api/v1/customers?includeInactive=true'),
  });

  const ledgerQuery = useQuery({
    queryKey: ['customer-ledger', selected?.id],
    queryFn: () => apiFetch<CustomerLedgerEntry[]>(`/api/v1/customers/${selected?.id}/ledger`),
    enabled: Boolean(selected),
  });

  const loyaltyQuery = useQuery({
    queryKey: ['customer-loyalty', selected?.id],
    queryFn: () => apiFetch<LoyaltyTransaction[]>(`/api/v1/customers/${selected?.id}/loyalty-transactions`),
    enabled: Boolean(selected),
  });

  const createMutation = useMutation({
    mutationFn: () => apiFetch('/api/v1/customers', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      setSnackbar('Customer created.');
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (e) => setSnackbar(e instanceof ApiError ? e.detail : 'Could not create customer.'),
  });

  const updateMutation = useMutation({
    mutationFn: () => apiFetch(`/api/v1/customers/${editTarget?.id}`, { method: 'PATCH', body: JSON.stringify(editForm) }),
    onSuccess: () => {
      setSnackbar('Customer updated.');
      setEditTarget(null);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (e) => setSnackbar(e instanceof ApiError ? e.detail : 'Could not update customer.'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/customers/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setSnackbar('Customer deactivated.');
      setConfirmTarget(null);
      if (selected?.id === confirmTarget?.id) setSelected(null);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (e) => setSnackbar(e instanceof ApiError ? e.detail : 'Could not deactivate customer.'),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/customers/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive: true }) }),
    onSuccess: () => {
      setSnackbar('Customer reactivated.');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (e) => setSnackbar(e instanceof ApiError ? e.detail : 'Could not reactivate customer.'),
  });

  const paymentMutation = useMutation({
    mutationFn: () => apiFetch(`/api/v1/customers/${selected?.id}/payments`, {
      method: 'POST',
      body: JSON.stringify({ amount: paymentAmount }),
    }),
    onSuccess: () => {
      setSnackbar('Payment recorded.');
      setPaymentAmount('');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-ledger', selected?.id] });
    },
    onError: (e) => setSnackbar(e instanceof ApiError ? e.detail : 'Could not record payment.'),
  });

  function openEdit(customer: Customer): void {
    setEditTarget(customer);
    setEditForm({
      name:          customer.name,
      phone:         customer.phone        ?? '',
      email:         customer.email        ?? '',
      address:       customer.address      ?? '',
      creditLimit:   customer.creditLimit,
      taxNumber:     customer.taxNumber    ?? '',
      crNumber:      customer.crNumber     ?? '',
      buildingNumber:customer.buildingNumber ?? '',
      streetName:    customer.streetName   ?? '',
      district:      customer.district     ?? '',
      city:          customer.city         ?? '',
      postalCode:    customer.postalCode   ?? '',
      countryCode:   customer.countryCode  ?? '',
    });
  }

  function openDetail(customer: Customer): void {
    setSelected(customer);
    setPaymentAmount('');
  }

  return (
    <Box p={2}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Customers</Typography>
        <PrimaryButton onClick={() => setCreateOpen(true)}>New Customer</PrimaryButton>
      </Stack>

      {/* Full-width customer table */}
      <DataTable
        searchPlaceholder="Search customers…"
        emptyMessage="No customers found."
        getRowId={(c: Customer) => c.id}
        rows={customersQuery.data ?? []}
        getSearchText={(c) => `${c.name} ${c.phone ?? ''} ${c.email ?? ''}`}
        columns={[
          { key: 'name',    label: 'Name',    sortable: true, render: (c) => c.name },
          { key: 'phone',   label: 'Phone',   render: (c) => c.phone ?? '—' },
          { key: 'email',   label: 'Email',   render: (c) => c.email ?? '—' },
          {
            key: 'currentBalance',
            label: 'Balance',
            align: 'right',
            sortable: true,
            sortValue: (c) => Number(c.currentBalance),
            render: (c) => `$${Number(c.currentBalance).toFixed(2)}`,
          },
          {
            key: 'isActive',
            label: 'Status',
            render: (c) => (
              <Chip size="small" label={c.isActive ? 'Active' : 'Inactive'} color={c.isActive ? 'success' : 'default'} />
            ),
          },
          {
            key: 'actions',
            label: '',
            render: (c) => (
              <Stack direction="row" spacing={1} onClick={(e) => e.stopPropagation()}>
                <SecondaryButton size="small" onClick={() => openDetail(c)}>View</SecondaryButton>
                <SecondaryButton size="small" onClick={() => openEdit(c)}>Edit</SecondaryButton>
                {c.isActive ? (
                  <SecondaryButton size="small" color="error" onClick={() => setConfirmTarget(c)}>Deactivate</SecondaryButton>
                ) : (
                  <SecondaryButton size="small" onClick={() => reactivateMutation.mutate(c.id)}>Reactivate</SecondaryButton>
                )}
              </Stack>
            ),
          },
        ]}
      />

      {/* ── Customer Detail Modal ──────────────────────────────────────── */}
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
                <Typography variant="caption" color="text.secondary">Balance</Typography>
                <Typography fontWeight={700} color={Number(selected.currentBalance) < 0 ? 'error.main' : 'text.primary'}>
                  ${Number(selected.currentBalance).toFixed(2)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Credit Limit</Typography>
                <Typography fontWeight={700}>${Number(selected.creditLimit).toFixed(2)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Loyalty Points</Typography>
                <Typography fontWeight={700}>{selected.loyaltyPoints}</Typography>
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
            </Stack>

            {/* Record payment */}
            <Stack direction="row" spacing={1} mb={2} alignItems="center">
              <TextField
                size="small"
                label="Payment amount"
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                sx={{ width: 180 }}
              />
              <SecondaryButton
                disabled={!paymentAmount || paymentMutation.isPending}
                onClick={() => paymentMutation.mutate()}
              >
                Apply Payment
              </SecondaryButton>
            </Stack>

            <Divider sx={{ mb: 1.5 }} />

            {/* Ledger */}
            <Typography variant="subtitle2" fontWeight={700} mb={1}>Ledger</Typography>
            <DataTable
              hideSearch
              defaultRowsPerPage={10}
              emptyMessage="No ledger entries yet."
              getRowId={(e: CustomerLedgerEntry) => e.id}
              rows={ledgerQuery.data ?? []}
              columns={[
                {
                  key: 'occurredAt',
                  label: 'Date',
                  sortable: true,
                  sortValue: (e) => new Date(e.occurredAt).getTime(),
                  render: (e) => new Date(e.occurredAt).toLocaleString(),
                },
                { key: 'entryType', label: 'Type',           render: (e) => formatEnumLabel(e.entryType) },
                { key: 'amount',    label: 'Amount',  align: 'right', sortable: true, sortValue: (e) => Number(e.amount), render: (e) => `$${Number(e.amount).toFixed(2)}` },
                { key: 'balanceAfter', label: 'Balance After', align: 'right', render: (e) => `$${Number(e.balanceAfter).toFixed(2)}` },
              ]}
            />

            {/* Loyalty */}
            <Typography variant="subtitle2" fontWeight={700} mt={2} mb={1}>Loyalty Points History</Typography>
            <DataTable
              hideSearch
              defaultRowsPerPage={10}
              emptyMessage="No loyalty activity yet."
              getRowId={(e: LoyaltyTransaction) => e.id}
              rows={loyaltyQuery.data ?? []}
              columns={[
                {
                  key: 'occurredAt',
                  label: 'Date',
                  sortable: true,
                  sortValue: (e) => new Date(e.occurredAt).getTime(),
                  render: (e) => new Date(e.occurredAt).toLocaleString(),
                },
                { key: 'type',         label: 'Type',         render: (e) => formatEnumLabel(e.type) },
                { key: 'points',       label: 'Points',       align: 'right', sortable: true, render: (e) => e.points },
                { key: 'balanceAfter', label: 'Balance After', align: 'right', render: (e) => e.balanceAfter },
              ]}
            />
          </Box>
        )}
      </AppModal>

      {/* ── Create modal ─────────────────────────────────────────────────── */}
      <AppModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Customer"
        maxWidth={einvoiceEnabled ? 'sm' : 'xs'}
        actions={
          <>
            <SecondaryButton onClick={() => setCreateOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton disabled={!form.name || createMutation.isPending} onClick={() => createMutation.mutate()}>Create</PrimaryButton>
          </>
        }
      >
        <Stack spacing={2} mt={0.5}>
          <TextField label="Name"         value={form.name}        onChange={(e) => setForm({ ...form, name: e.target.value })}        autoFocus />
          <TextField label="Phone"        value={form.phone}       onChange={(e) => setForm({ ...form, phone: e.target.value })}       />
          <TextField label="Email"        value={form.email}       onChange={(e) => setForm({ ...form, email: e.target.value })}       />
          <TextField label="Address"      value={form.address}     onChange={(e) => setForm({ ...form, address: e.target.value })}     />
          <TextField label="Credit Limit" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} type="number" />
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

      {/* ── Edit modal ───────────────────────────────────────────────────── */}
      <AppModal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title="Edit Customer"
        maxWidth={einvoiceEnabled ? 'sm' : 'xs'}
        actions={
          <>
            <SecondaryButton onClick={() => setEditTarget(null)}>Cancel</SecondaryButton>
            <PrimaryButton disabled={!editForm.name || updateMutation.isPending} onClick={() => updateMutation.mutate()}>Save</PrimaryButton>
          </>
        }
      >
        <Stack spacing={2} mt={0.5}>
          <TextField label="Name"         value={editForm.name}        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}        autoFocus />
          <TextField label="Phone"        value={editForm.phone}       onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}       />
          <TextField label="Email"        value={editForm.email}       onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}       />
          <TextField label="Address"      value={editForm.address}     onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}     />
          <TextField label="Credit Limit" value={editForm.creditLimit} onChange={(e) => setEditForm({ ...editForm, creditLimit: e.target.value })} type="number" />
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
        title="Deactivate Customer"
        message={`Deactivate "${confirmTarget?.name}"? They will no longer appear in the POS customer picker, but their ledger and invoice history stay intact. You can reactivate them later.`}
        confirmLabel="Deactivate"
        destructive
        onConfirm={() => confirmTarget && deactivateMutation.mutate(confirmTarget.id)}
        onCancel={() => setConfirmTarget(null)}
      />

      <Snackbar open={Boolean(snackbar)} autoHideDuration={3000} onClose={() => setSnackbar(null)} message={snackbar} />
    </Box>
  );
}
