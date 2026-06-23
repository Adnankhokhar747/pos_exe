import { useState } from 'react';
import { Box, Snackbar, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { Plan } from '../api/types';
import { DataTable } from '../components/DataTable';
import { AppModal } from '../components/AppModal';
import { PrimaryButton, SecondaryButton } from '../components/buttons';

const EMPTY_FORM = { name: '', userLimit: '', invoiceLimit: '', branchLimit: '', priceMonthly: '' };

function toLimitPayload(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value);
}

export function PlansPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const plansQuery = useQuery({
    queryKey: ['platform-plans'],
    queryFn: () => apiFetch<Plan[]>('/api/v1/platform/plans'),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/platform/plans', {
        method: 'POST',
        body: JSON.stringify({
          name: createForm.name,
          userLimit: toLimitPayload(createForm.userLimit),
          invoiceLimit: toLimitPayload(createForm.invoiceLimit),
          branchLimit: toLimitPayload(createForm.branchLimit),
          priceMonthly: toLimitPayload(createForm.priceMonthly),
        }),
      }),
    onSuccess: () => {
      setSnackbar('Plan created.');
      setCreateForm(EMPTY_FORM);
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['platform-plans'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not create plan.'),
  });

  const [editTarget, setEditTarget] = useState<Plan | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const updateMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/platform/plans/${editTarget?.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editForm.name,
          userLimit: toLimitPayload(editForm.userLimit) ?? null,
          invoiceLimit: toLimitPayload(editForm.invoiceLimit) ?? null,
          branchLimit: toLimitPayload(editForm.branchLimit) ?? null,
          priceMonthly: toLimitPayload(editForm.priceMonthly),
        }),
      }),
    onSuccess: () => {
      setSnackbar('Plan updated.');
      setEditTarget(null);
      queryClient.invalidateQueries({ queryKey: ['platform-plans'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not update plan.'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (plan: Plan) =>
      apiFetch(`/api/v1/platform/plans/${plan.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !plan.isActive }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-plans'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not update plan.'),
  });

  function openEdit(plan: Plan): void {
    setEditTarget(plan);
    setEditForm({
      name: plan.name,
      userLimit: plan.userLimit !== null ? String(plan.userLimit) : '',
      invoiceLimit: plan.invoiceLimit !== null ? String(plan.invoiceLimit) : '',
      branchLimit: plan.branchLimit !== null ? String(plan.branchLimit) : '',
      priceMonthly: plan.priceMonthly !== null ? String(plan.priceMonthly) : '',
    });
  }

  return (
    <Box p={2} height="100%" overflow="auto">
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Plans</Typography>
        <PrimaryButton onClick={() => setCreateOpen(true)}>Create Plan</PrimaryButton>
      </Stack>

      <DataTable
        hideSearch
        emptyMessage="No plans yet."
        getRowId={(p: Plan) => p.id}
        rows={plansQuery.data ?? []}
        columns={[
          { key: 'name', label: 'Name', sortable: true, render: (p) => p.name },
          { key: 'userLimit', label: 'User Limit', align: 'right', render: (p) => p.userLimit ?? 'Unlimited' },
          { key: 'invoiceLimit', label: 'Invoice Limit', align: 'right', render: (p) => p.invoiceLimit ?? 'Unlimited' },
          { key: 'branchLimit', label: 'Branch Limit', align: 'right', render: (p) => p.branchLimit ?? 'Unlimited' },
          {
            key: 'priceMonthly',
            label: 'Price / Month',
            align: 'right',
            render: (p) => (p.priceMonthly !== null ? `$${Number(p.priceMonthly).toFixed(2)}` : '—'),
          },
          { key: 'isActive', label: 'Active', render: (p) => (p.isActive ? 'Yes' : 'No') },
          {
            key: 'actions',
            label: '',
            render: (p) => (
              <Stack direction="row" spacing={1}>
                <SecondaryButton size="small" onClick={() => openEdit(p)}>
                  Edit
                </SecondaryButton>
                <SecondaryButton size="small" onClick={() => toggleActiveMutation.mutate(p)}>
                  {p.isActive ? 'Deactivate' : 'Activate'}
                </SecondaryButton>
              </Stack>
            ),
          },
        ]}
      />

      <AppModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Plan"
        maxWidth="xs"
        actions={
          <>
            <SecondaryButton onClick={() => setCreateOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton disabled={!createForm.name || createMutation.isPending} onClick={() => createMutation.mutate()}>
              Create
            </PrimaryButton>
          </>
        }
      >
        <Stack spacing={2} mt={0.5}>
          <TextField label="Name" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} autoFocus />
          <TextField
            label="User Limit (blank = unlimited)"
            value={createForm.userLimit}
            onChange={(e) => setCreateForm({ ...createForm, userLimit: e.target.value })}
          />
          <TextField
            label="Invoice Limit (blank = unlimited)"
            value={createForm.invoiceLimit}
            onChange={(e) => setCreateForm({ ...createForm, invoiceLimit: e.target.value })}
          />
          <TextField
            label="Branch Limit (blank = unlimited)"
            value={createForm.branchLimit}
            onChange={(e) => setCreateForm({ ...createForm, branchLimit: e.target.value })}
          />
          <TextField
            label="Price / Month"
            value={createForm.priceMonthly}
            onChange={(e) => setCreateForm({ ...createForm, priceMonthly: e.target.value })}
          />
        </Stack>
      </AppModal>

      <AppModal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title="Edit Plan"
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
            label="User Limit (blank = unlimited)"
            value={editForm.userLimit}
            onChange={(e) => setEditForm({ ...editForm, userLimit: e.target.value })}
          />
          <TextField
            label="Invoice Limit (blank = unlimited)"
            value={editForm.invoiceLimit}
            onChange={(e) => setEditForm({ ...editForm, invoiceLimit: e.target.value })}
          />
          <TextField
            label="Branch Limit (blank = unlimited)"
            value={editForm.branchLimit}
            onChange={(e) => setEditForm({ ...editForm, branchLimit: e.target.value })}
          />
          <TextField
            label="Price / Month"
            value={editForm.priceMonthly}
            onChange={(e) => setEditForm({ ...editForm, priceMonthly: e.target.value })}
          />
        </Stack>
      </AppModal>

      <Snackbar open={Boolean(snackbar)} autoHideDuration={3000} onClose={() => setSnackbar(null)} message={snackbar} />
    </Box>
  );
}
