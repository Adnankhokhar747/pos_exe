import { useState } from 'react';
import { Box, Chip, MenuItem, Snackbar, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { CompanySummary, Plan } from '../api/types';
import { DataTable } from '../components/DataTable';
import { AppModal } from '../components/AppModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PrimaryButton, SecondaryButton } from '../components/buttons';

const CREATE_EMPTY_FORM = {
  companyName: '',
  baseCurrency: 'USD',
  planId: '',
  adminFullName: '',
  adminUsername: '',
  adminEmail: '',
  adminPassword: '',
};

function statusChipColor(status: string): 'success' | 'warning' | 'default' {
  if (status === 'active') return 'success';
  if (status === 'suspended') return 'warning';
  return 'default';
}

function licenseChipColor(subscriptionStatus: string, blocked: boolean): 'success' | 'warning' | 'error' | 'default' {
  if (blocked) return 'error';
  if (subscriptionStatus === 'active') return 'success';
  return 'warning';
}

export function CompaniesPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const companiesQuery = useQuery({
    queryKey: ['platform-companies'],
    queryFn: () => apiFetch<CompanySummary[]>('/api/v1/platform/companies'),
  });

  const plansQuery = useQuery({
    queryKey: ['platform-plans'],
    queryFn: () => apiFetch<Plan[]>('/api/v1/platform/plans'),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(CREATE_EMPTY_FORM);

  const createCompanyMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/platform/companies', {
        method: 'POST',
        body: JSON.stringify({ ...createForm, adminEmail: createForm.adminEmail || undefined }),
      }),
    onSuccess: () => {
      setSnackbar('Company created.');
      setCreateForm(CREATE_EMPTY_FORM);
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['platform-companies'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not create company.'),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/platform/companies/${id}/activate`, { method: 'PATCH' }),
    onSuccess: () => {
      setSnackbar('Company activated.');
      queryClient.invalidateQueries({ queryKey: ['platform-companies'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not activate company.'),
  });

  const suspendMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/platform/companies/${id}/suspend`, { method: 'PATCH' }),
    onSuccess: () => {
      setSnackbar('Company suspended.');
      queryClient.invalidateQueries({ queryKey: ['platform-companies'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not suspend company.'),
  });

  const [deleteTarget, setDeleteTarget] = useState<CompanySummary | null>(null);
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/platform/companies/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setSnackbar('Company deleted.');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['platform-companies'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not delete company.'),
  });

  const [renewTarget, setRenewTarget] = useState<CompanySummary | null>(null);
  const [extendMonths, setExtendMonths] = useState('12');
  const renewMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/platform/companies/${renewTarget?.id}/subscription/renew`, {
        method: 'POST',
        body: JSON.stringify({ extendMonths: Number(extendMonths) }),
      }),
    onSuccess: () => {
      setSnackbar('Subscription renewed.');
      setRenewTarget(null);
      setExtendMonths('12');
      queryClient.invalidateQueries({ queryKey: ['platform-companies'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not renew subscription.'),
  });

  const [planChangeTarget, setPlanChangeTarget] = useState<CompanySummary | null>(null);
  const [newPlanId, setNewPlanId] = useState('');
  const changePlanMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/platform/companies/${planChangeTarget?.id}/subscription/plan`, {
        method: 'PATCH',
        body: JSON.stringify({ planId: newPlanId }),
      }),
    onSuccess: () => {
      setSnackbar('Plan changed.');
      setPlanChangeTarget(null);
      setNewPlanId('');
      queryClient.invalidateQueries({ queryKey: ['platform-companies'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not change plan.'),
  });

  return (
    <Box p={2} height="100%" overflow="auto">
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Companies</Typography>
        <PrimaryButton onClick={() => setCreateOpen(true)}>Create Company</PrimaryButton>
      </Stack>

      <DataTable
        searchPlaceholder="Search companies…"
        emptyMessage="No companies yet."
        getRowId={(c: CompanySummary) => c.id}
        rows={companiesQuery.data ?? []}
        getSearchText={(c) => c.name}
        columns={[
          { key: 'name', label: 'Company', sortable: true, render: (c) => c.name },
          {
            key: 'status',
            label: 'Status',
            sortable: true,
            render: (c) => <Chip size="small" label={c.status} color={statusChipColor(c.status)} />,
          },
          { key: 'plan', label: 'Plan', render: (c) => c.plan?.name ?? '—' },
          {
            key: 'license',
            label: 'Subscription',
            render: (c) => (
              <Chip
                size="small"
                label={c.license.blocked ? 'Blocked' : c.license.subscriptionStatus}
                color={licenseChipColor(c.license.subscriptionStatus, c.license.blocked)}
              />
            ),
          },
          {
            key: 'expiry',
            label: 'Expires In',
            align: 'right',
            sortable: true,
            sortValue: (c) => c.license.daysUntilExpiry,
            render: (c) => `${c.license.daysUntilExpiry} day(s)`,
          },
          {
            key: 'users',
            label: 'Users',
            align: 'right',
            render: (c) => `${c.license.userCount}${c.license.userLimit !== null ? ` / ${c.license.userLimit}` : ''}`,
          },
          {
            key: 'invoices',
            label: 'Invoices',
            align: 'right',
            render: (c) =>
              `${c.license.invoiceCount}${c.license.invoiceLimit !== null ? ` / ${c.license.invoiceLimit}` : ''}`,
          },
          {
            key: 'actions',
            label: '',
            render: (c) => (
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {c.status === 'active' ? (
                  <SecondaryButton size="small" onClick={() => suspendMutation.mutate(c.id)}>
                    Suspend
                  </SecondaryButton>
                ) : (
                  <SecondaryButton size="small" onClick={() => activateMutation.mutate(c.id)}>
                    Activate
                  </SecondaryButton>
                )}
                <SecondaryButton size="small" onClick={() => setRenewTarget(c)}>
                  Renew
                </SecondaryButton>
                <SecondaryButton
                  size="small"
                  onClick={() => {
                    setPlanChangeTarget(c);
                    setNewPlanId(c.plan?.id ?? '');
                  }}
                >
                  Change Plan
                </SecondaryButton>
                <SecondaryButton size="small" color="error" onClick={() => setDeleteTarget(c)}>
                  Delete
                </SecondaryButton>
              </Stack>
            ),
          },
        ]}
      />

      <AppModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Company"
        actions={
          <>
            <SecondaryButton onClick={() => setCreateOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton
              disabled={
                !createForm.companyName ||
                !createForm.planId ||
                !createForm.adminFullName ||
                !createForm.adminUsername ||
                createForm.adminPassword.length < 8 ||
                createCompanyMutation.isPending
              }
              onClick={() => createCompanyMutation.mutate()}
            >
              Create
            </PrimaryButton>
          </>
        }
      >
        <Stack spacing={2} mt={0.5}>
          <TextField
            label="Company Name"
            value={createForm.companyName}
            onChange={(e) => setCreateForm({ ...createForm, companyName: e.target.value })}
            autoFocus
          />
          <TextField
            label="Base Currency"
            value={createForm.baseCurrency}
            onChange={(e) => setCreateForm({ ...createForm, baseCurrency: e.target.value.toUpperCase() })}
          />
          <TextField
            select
            label="Plan"
            value={createForm.planId}
            onChange={(e) => setCreateForm({ ...createForm, planId: e.target.value })}
          >
            {(plansQuery.data ?? [])
              .filter((p) => p.isActive)
              .map((plan) => (
                <MenuItem key={plan.id} value={plan.id}>
                  {plan.name}
                </MenuItem>
              ))}
          </TextField>
          <Typography variant="subtitle2">Initial Company Admin</Typography>
          <TextField
            label="Full Name"
            value={createForm.adminFullName}
            onChange={(e) => setCreateForm({ ...createForm, adminFullName: e.target.value })}
          />
          <TextField
            label="Username"
            value={createForm.adminUsername}
            onChange={(e) => setCreateForm({ ...createForm, adminUsername: e.target.value })}
          />
          <TextField
            label="Email (optional)"
            value={createForm.adminEmail}
            onChange={(e) => setCreateForm({ ...createForm, adminEmail: e.target.value })}
          />
          <TextField
            label="Password"
            type="password"
            helperText="At least 8 characters"
            value={createForm.adminPassword}
            onChange={(e) => setCreateForm({ ...createForm, adminPassword: e.target.value })}
          />
        </Stack>
      </AppModal>

      <AppModal
        open={Boolean(renewTarget)}
        onClose={() => setRenewTarget(null)}
        title={`Renew Subscription — ${renewTarget?.name ?? ''}`}
        maxWidth="xs"
        actions={
          <>
            <SecondaryButton onClick={() => setRenewTarget(null)}>Cancel</SecondaryButton>
            <PrimaryButton disabled={renewMutation.isPending} onClick={() => renewMutation.mutate()}>
              Renew
            </PrimaryButton>
          </>
        }
      >
        <TextField
          label="Extend by (months)"
          type="number"
          value={extendMonths}
          onChange={(e) => setExtendMonths(e.target.value)}
          fullWidth
          autoFocus
        />
      </AppModal>

      <AppModal
        open={Boolean(planChangeTarget)}
        onClose={() => setPlanChangeTarget(null)}
        title={`Change Plan — ${planChangeTarget?.name ?? ''}`}
        maxWidth="xs"
        actions={
          <>
            <SecondaryButton onClick={() => setPlanChangeTarget(null)}>Cancel</SecondaryButton>
            <PrimaryButton disabled={!newPlanId || changePlanMutation.isPending} onClick={() => changePlanMutation.mutate()}>
              Save
            </PrimaryButton>
          </>
        }
      >
        <TextField select label="Plan" value={newPlanId} onChange={(e) => setNewPlanId(e.target.value)} fullWidth>
          {(plansQuery.data ?? [])
            .filter((p) => p.isActive)
            .map((plan) => (
              <MenuItem key={plan.id} value={plan.id}>
                {plan.name}
              </MenuItem>
            ))}
        </TextField>
      </AppModal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Company"
        message={`Delete "${deleteTarget?.name}"? Only companies with zero sales/catalog data can be deleted — others must be suspended instead.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      <Snackbar open={Boolean(snackbar)} autoHideDuration={3000} onClose={() => setSnackbar(null)} message={snackbar} />
    </Box>
  );
}
