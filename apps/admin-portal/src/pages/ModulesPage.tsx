import { useState } from 'react';
import { Box, Chip, IconButton, MenuItem, Snackbar, Stack, TextField, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { apiFetch, ApiError } from '../api/client';
import type { CompanySummary, ModuleCatalogEntry, TenantModuleGrant } from '../api/types';
import { DataTable } from '../components/DataTable';
import { AppModal } from '../components/AppModal';
import { PrimaryButton, SecondaryButton } from '../components/buttons';

const EMPTY_CATALOG_FORM = { code: '', name: '', description: '' };

type LimitRow = { key: string; value: string };

function limitsToRows(limits: Record<string, number | null> | null): LimitRow[] {
  if (!limits) return [];
  return Object.entries(limits).map(([key, value]) => ({ key, value: value === null ? '' : String(value) }));
}

function rowsToLimits(rows: LimitRow[]): Record<string, number | null> {
  const limits: Record<string, number | null> = {};
  for (const row of rows) {
    if (!row.key.trim()) continue;
    limits[row.key.trim()] = row.value.trim() === '' ? null : Number(row.value);
  }
  return limits;
}

export function ModulesPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const catalogQuery = useQuery({
    queryKey: ['module-catalog'],
    queryFn: () => apiFetch<ModuleCatalogEntry[]>('/api/v1/platform/modules'),
  });

  const companiesQuery = useQuery({
    queryKey: ['platform-companies'],
    queryFn: () => apiFetch<CompanySummary[]>('/api/v1/platform/companies'),
  });

  const [registerOpen, setRegisterOpen] = useState(false);
  const [catalogForm, setCatalogForm] = useState(EMPTY_CATALOG_FORM);
  const registerMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/platform/modules', {
        method: 'POST',
        body: JSON.stringify({
          code: catalogForm.code,
          name: catalogForm.name,
          description: catalogForm.description || undefined,
        }),
      }),
    onSuccess: () => {
      setSnackbar('Module registered.');
      setCatalogForm(EMPTY_CATALOG_FORM);
      setRegisterOpen(false);
      queryClient.invalidateQueries({ queryKey: ['module-catalog'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not register module.'),
  });

  const toggleCatalogActiveMutation = useMutation({
    mutationFn: (entry: ModuleCatalogEntry) =>
      apiFetch(`/api/v1/platform/modules/${entry.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !entry.isActive }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['module-catalog'] }),
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not update module.'),
  });

  const [searchParams] = useSearchParams();
  const [selectedCompanyId, setSelectedCompanyId] = useState(searchParams.get('companyId') ?? '');
  const grantsQuery = useQuery({
    queryKey: ['tenant-module-grants', selectedCompanyId],
    queryFn: () => apiFetch<TenantModuleGrant[]>(`/api/v1/platform/companies/${selectedCompanyId}/modules`),
    enabled: Boolean(selectedCompanyId),
  });

  const [manageTarget, setManageTarget] = useState<TenantModuleGrant | null>(null);
  const [manageEnabled, setManageEnabled] = useState(true);
  const [managePeriod, setManagePeriod] = useState<'1' | '3' | '6' | '12'>('12');
  const [manageLimitRows, setManageLimitRows] = useState<LimitRow[]>([]);

  const manageMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/platform/companies/${selectedCompanyId}/modules/${manageTarget?.moduleCode}`, {
        method: 'PATCH',
        body: JSON.stringify({
          enabled: manageEnabled,
          periodMonths: Number(managePeriod),
          limits: rowsToLimits(manageLimitRows),
        }),
      }),
    onSuccess: () => {
      setSnackbar('Module grant updated.');
      setManageTarget(null);
      queryClient.invalidateQueries({ queryKey: ['tenant-module-grants', selectedCompanyId] });
      queryClient.invalidateQueries({ queryKey: ['platform-companies'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not update module grant.'),
  });

  function openManage(grant: TenantModuleGrant): void {
    setManageTarget(grant);
    setManageEnabled(grant.enabled);
    setManagePeriod('12');
    setManageLimitRows(limitsToRows(grant.limits));
  }

  function updateLimitRow(index: number, patch: Partial<LimitRow>): void {
    setManageLimitRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <Box p={2} height="100%" overflow="auto">
      <Typography variant="h6" gutterBottom>
        Module Catalog
      </Typography>
      <Stack direction="row" justifyContent="flex-end" mb={1}>
        <PrimaryButton onClick={() => setRegisterOpen(true)}>Register Module</PrimaryButton>
      </Stack>
      <Box mb={4}>
        <DataTable
          hideSearch
          emptyMessage="No modules registered yet."
          getRowId={(m: ModuleCatalogEntry) => m.id}
          rows={catalogQuery.data ?? []}
          columns={[
            { key: 'code', label: 'Code', sortable: true, render: (m) => m.code },
            { key: 'name', label: 'Name', sortable: true, render: (m) => m.name },
            { key: 'description', label: 'Description', render: (m) => m.description ?? '—' },
            { key: 'isActive', label: 'Active', render: (m) => (m.isActive ? 'Yes' : 'No') },
            {
              key: 'actions',
              label: '',
              render: (m) => (
                <SecondaryButton size="small" onClick={() => toggleCatalogActiveMutation.mutate(m)}>
                  {m.isActive ? 'Deactivate' : 'Activate'}
                </SecondaryButton>
              ),
            },
          ]}
        />
      </Box>

      <Typography variant="h6" gutterBottom>
        Company Grants
      </Typography>
      <TextField
        select
        label="Company"
        value={selectedCompanyId}
        onChange={(e) => setSelectedCompanyId(e.target.value)}
        sx={{ minWidth: 280, mb: 2 }}
      >
        {(companiesQuery.data ?? []).map((company) => (
          <MenuItem key={company.id} value={company.id}>
            {company.name}
          </MenuItem>
        ))}
      </TextField>

      {selectedCompanyId && (
        <DataTable
          hideSearch
          emptyMessage="No modules in the catalog yet."
          getRowId={(g: TenantModuleGrant) => g.moduleId}
          rows={grantsQuery.data ?? []}
          columns={[
            { key: 'name', label: 'Module', sortable: true, render: (g) => g.name },
            {
              key: 'enabled',
              label: 'Status',
              render: (g) => (
                <Chip
                  size="small"
                  label={g.blocked ? 'Blocked' : g.enabled ? 'Enabled' : 'Disabled'}
                  color={g.blocked ? 'error' : g.enabled ? 'success' : 'default'}
                />
              ),
            },
            {
              key: 'expiry',
              label: 'Expires In',
              align: 'right',
              render: (g) => (g.daysUntilExpiry !== null ? `${g.daysUntilExpiry} day(s)` : '—'),
            },
            {
              key: 'limits',
              label: 'Limits',
              render: (g) =>
                g.limits && Object.keys(g.limits).length > 0
                  ? Object.entries(g.limits)
                      .map(([k, v]) => `${k}=${v ?? '∞'}`)
                      .join(', ')
                  : '—',
            },
            {
              key: 'actions',
              label: '',
              render: (g) => (
                <SecondaryButton size="small" onClick={() => openManage(g)}>
                  Manage
                </SecondaryButton>
              ),
            },
          ]}
        />
      )}

      <AppModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        title="Register Module"
        maxWidth="xs"
        actions={
          <>
            <SecondaryButton onClick={() => setRegisterOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton
              disabled={!catalogForm.code || !catalogForm.name || registerMutation.isPending}
              onClick={() => registerMutation.mutate()}
            >
              Register
            </PrimaryButton>
          </>
        }
      >
        <Stack spacing={2} mt={0.5}>
          <TextField
            label="Code"
            helperText="Stable identifier, e.g. hospital"
            value={catalogForm.code}
            onChange={(e) => setCatalogForm({ ...catalogForm, code: e.target.value })}
            autoFocus
          />
          <TextField
            label="Name"
            value={catalogForm.name}
            onChange={(e) => setCatalogForm({ ...catalogForm, name: e.target.value })}
          />
          <TextField
            label="Description (optional)"
            value={catalogForm.description}
            onChange={(e) => setCatalogForm({ ...catalogForm, description: e.target.value })}
          />
        </Stack>
      </AppModal>

      <AppModal
        open={Boolean(manageTarget)}
        onClose={() => setManageTarget(null)}
        title={`Manage — ${manageTarget?.name ?? ''}`}
        actions={
          <>
            <SecondaryButton onClick={() => setManageTarget(null)}>Cancel</SecondaryButton>
            <PrimaryButton disabled={manageMutation.isPending} onClick={() => manageMutation.mutate()}>
              Save
            </PrimaryButton>
          </>
        }
      >
        <Stack spacing={2} mt={0.5}>
          <TextField
            select
            label="Status"
            value={manageEnabled ? 'enabled' : 'disabled'}
            onChange={(e) => setManageEnabled(e.target.value === 'enabled')}
          >
            <MenuItem value="enabled">Enabled</MenuItem>
            <MenuItem value="disabled">Disabled</MenuItem>
          </TextField>
          {manageEnabled && (
            <TextField
              select
              label="Period"
              value={managePeriod}
              onChange={(e) => setManagePeriod(e.target.value as '1' | '3' | '6' | '12')}
            >
              <MenuItem value="1">1 month</MenuItem>
              <MenuItem value="3">3 months</MenuItem>
              <MenuItem value="6">6 months</MenuItem>
              <MenuItem value="12">12 months</MenuItem>
            </TextField>
          )}
          <Typography variant="subtitle2">Limits (blank value = unlimited)</Typography>
          {manageLimitRows.map((row, index) => (
            <Stack key={index} direction="row" spacing={1} alignItems="center">
              <TextField
                label="Key"
                size="small"
                value={row.key}
                onChange={(e) => updateLimitRow(index, { key: e.target.value })}
                fullWidth
              />
              <TextField
                label="Value"
                size="small"
                value={row.value}
                onChange={(e) => updateLimitRow(index, { value: e.target.value })}
                fullWidth
              />
              <IconButton
                size="small"
                onClick={() => setManageLimitRows((rows) => rows.filter((_, i) => i !== index))}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          <SecondaryButton size="small" onClick={() => setManageLimitRows((rows) => [...rows, { key: '', value: '' }])}>
            Add Limit
          </SecondaryButton>
        </Stack>
      </AppModal>

      <Snackbar open={Boolean(snackbar)} autoHideDuration={3000} onClose={() => setSnackbar(null)} message={snackbar} />
    </Box>
  );
}
