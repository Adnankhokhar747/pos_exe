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

const EMPTY_FORM = { name: '', phone: '', email: '', address: '', creditLimit: '0' };

export function CustomersPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Customer | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

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
    mutationFn: () =>
      apiFetch('/api/v1/customers', {
        method: 'POST',
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      setSnackbar('Customer created.');
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not create customer.'),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/customers/${editTarget?.id}`, {
        method: 'PATCH',
        body: JSON.stringify(editForm),
      }),
    onSuccess: () => {
      setSnackbar('Customer updated.');
      setEditTarget(null);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not update customer.'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/customers/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setSnackbar('Customer deactivated.');
      setConfirmTarget(null);
      if (selected?.id === confirmTarget?.id) setSelected(null);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not deactivate customer.'),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/customers/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive: true }) }),
    onSuccess: () => {
      setSnackbar('Customer reactivated.');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not reactivate customer.'),
  });

  const paymentMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/customers/${selected?.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ amount: paymentAmount }),
      }),
    onSuccess: () => {
      setSnackbar('Payment recorded.');
      setPaymentAmount('');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-ledger', selected?.id] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not record payment.'),
  });

  function openEdit(customer: Customer): void {
    setEditTarget(customer);
    setEditForm({
      name: customer.name,
      phone: customer.phone ?? '',
      email: customer.email ?? '',
      address: customer.address ?? '',
      creditLimit: customer.creditLimit,
    });
  }

  return (
    <Box display="flex" height="100%">
      <Box flex={1} p={2} overflow="auto" borderRight="1px solid #e0e0e0">
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Customers</Typography>
          <PrimaryButton onClick={() => setCreateOpen(true)}>New Customer</PrimaryButton>
        </Stack>
        <DataTable
          searchPlaceholder="Search customers…"
          emptyMessage="No customers found."
          getRowId={(c: Customer) => c.id}
          rows={customersQuery.data ?? []}
          getSearchText={(c) => `${c.name} ${c.phone ?? ''} ${c.email ?? ''}`}
          selectedRowId={selected?.id}
          onRowClick={(c) => setSelected(c)}
          columns={[
            { key: 'name', label: 'Name', sortable: true, render: (c) => c.name },
            { key: 'phone', label: 'Phone', render: (c) => c.phone ?? '—' },
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
                <Chip
                  size="small"
                  label={c.isActive ? 'Active' : 'Inactive'}
                  color={c.isActive ? 'success' : 'default'}
                />
              ),
            },
            {
              key: 'actions',
              label: '',
              render: (c) => (
                <Stack direction="row" spacing={1} onClick={(e) => e.stopPropagation()}>
                  <SecondaryButton size="small" onClick={() => openEdit(c)}>
                    Edit
                  </SecondaryButton>
                  {c.isActive ? (
                    <SecondaryButton size="small" color="error" onClick={() => setConfirmTarget(c)}>
                      Deactivate
                    </SecondaryButton>
                  ) : (
                    <SecondaryButton size="small" onClick={() => reactivateMutation.mutate(c.id)}>
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
        {!selected && <Typography color="text.secondary">Select a customer to view their ledger.</Typography>}
        {selected && (
          <>
            <Typography variant="h6">{selected.name}</Typography>
            <Typography color="text.secondary" gutterBottom>
              Balance: ${Number(selected.currentBalance).toFixed(2)} · Credit limit: $
              {Number(selected.creditLimit).toFixed(2)} · Loyalty points: {selected.loyaltyPoints}
            </Typography>
            <Stack direction="row" spacing={1} mb={2}>
              <TextField
                size="small"
                label="Record payment"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
              <SecondaryButton disabled={!paymentAmount || paymentMutation.isPending} onClick={() => paymentMutation.mutate()}>
                Apply Payment
              </SecondaryButton>
            </Stack>
            <Divider sx={{ mb: 2 }} />
            <DataTable
              hideSearch
              defaultRowsPerPage={10}
              emptyMessage="No ledger entries yet."
              getRowId={(entry: CustomerLedgerEntry) => entry.id}
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

            <Typography variant="subtitle1" sx={{ mt: 3 }} gutterBottom>
              Loyalty Points History
            </Typography>
            <DataTable
              hideSearch
              defaultRowsPerPage={10}
              emptyMessage="No loyalty activity yet."
              getRowId={(entry: LoyaltyTransaction) => entry.id}
              rows={loyaltyQuery.data ?? []}
              columns={[
                {
                  key: 'occurredAt',
                  label: 'Date',
                  sortable: true,
                  sortValue: (e) => new Date(e.occurredAt).getTime(),
                  render: (e) => new Date(e.occurredAt).toLocaleString(),
                },
                { key: 'type', label: 'Type', sortable: true, render: (e) => formatEnumLabel(e.type) },
                { key: 'points', label: 'Points', align: 'right', sortable: true, render: (e) => e.points },
                { key: 'balanceAfter', label: 'Balance After', align: 'right', render: (e) => e.balanceAfter },
              ]}
            />
          </>
        )}
      </Box>

      <AppModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Customer"
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
          <TextField
            label="Credit Limit"
            value={form.creditLimit}
            onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
          />
        </Stack>
      </AppModal>

      <AppModal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title="Edit Customer"
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
          <TextField
            label="Credit Limit"
            value={editForm.creditLimit}
            onChange={(e) => setEditForm({ ...editForm, creditLimit: e.target.value })}
          />
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
