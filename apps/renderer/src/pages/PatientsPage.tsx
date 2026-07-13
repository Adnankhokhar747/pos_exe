import { useState } from 'react';
import { Box, Chip, MenuItem, Snackbar, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { Appointment, Patient, PatientLedgerEntry } from '../api/types';
import { DataTable } from '../components/DataTable';
import { AppModal } from '../components/AppModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PrimaryButton, SecondaryButton } from '../components/buttons';
import { formatEnumLabel } from '../utils/format';

const EMPTY_FORM = { name: '', phone: '', gender: '', dateOfBirth: '', address: '' };
const ADVANCE_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' },
];

function n(v: string | number): number {
  return typeof v === 'string' ? parseFloat(v) || 0 : v;
}

function fmt(v: string | number): string {
  const num = n(v);
  return isNaN(num) ? '0' : num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

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

  // ── Create ────────────────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/hospital/patients', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          dateOfBirth: form.dateOfBirth || undefined,
          gender: form.gender || undefined,
        }),
      }),
    onSuccess: () => {
      setSnackbar('Patient added.');
      setForm(EMPTY_FORM);
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not add patient.'),
  });

  // ── Edit ──────────────────────────────────────────────────────────────────────
  const [editTarget, setEditTarget] = useState<Patient | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const updateMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/hospital/patients/${editTarget?.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...editForm,
          dateOfBirth: editForm.dateOfBirth || undefined,
          gender: editForm.gender || undefined,
        }),
      }),
    onSuccess: () => {
      setSnackbar('Patient updated.');
      setEditTarget(null);
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not update patient.'),
  });

  // ── Deactivate / Reactivate ───────────────────────────────────────────────────
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
      apiFetch(`/api/v1/hospital/patients/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: true }),
      }),
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

  // ── Record Advance ────────────────────────────────────────────────────────────
  const [advanceTarget, setAdvanceTarget] = useState<Patient | null>(null);
  const [advanceForm, setAdvanceForm] = useState({ amount: '', method: 'cash', reference: '', notes: '' });

  const advanceMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/hospital/patients/${advanceTarget!.id}/advance`, {
        method: 'POST',
        body: JSON.stringify({
          payments: [
            {
              amount: parseFloat(advanceForm.amount),
              method: advanceForm.method,
              reference: advanceForm.reference || undefined,
            },
          ],
          notes: advanceForm.notes || undefined,
        }),
      }),
    onSuccess: () => {
      setSnackbar('Advance recorded.');
      setAdvanceTarget(null);
      setAdvanceForm({ amount: '', method: 'cash', reference: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patients-active'] });
      queryClient.invalidateQueries({ queryKey: ['patients-pos-lookup'] });
      queryClient.invalidateQueries({ queryKey: ['patient-ledger', advanceTarget?.id] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not record advance.'),
  });

  // ── Refund (money paid back out of the advance balance) ───────────────────────
  const [refundTarget, setRefundTarget] = useState<Patient | null>(null);
  const [refundForm, setRefundForm] = useState({ amount: '', method: 'cash', reference: '', notes: '' });

  const refundMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/hospital/patients/${refundTarget!.id}/refund`, {
        method: 'POST',
        body: JSON.stringify({
          amount: parseFloat(refundForm.amount),
          method: refundForm.method,
          reference: refundForm.reference || undefined,
          notes: refundForm.notes || undefined,
        }),
      }),
    onSuccess: () => {
      setSnackbar('Refund recorded.');
      setRefundTarget(null);
      setRefundForm({ amount: '', method: 'cash', reference: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patients-active'] });
      queryClient.invalidateQueries({ queryKey: ['patients-pos-lookup'] });
      queryClient.invalidateQueries({ queryKey: ['patient-ledger', refundTarget?.id] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not record refund.'),
  });

  // ── Complete Treatment (final settlement — refund what's left, or collect a
  // shortfall, in one step rather than requiring a manual ledger calculation) ────
  const [settleTarget, setSettleTarget] = useState<Patient | null>(null);
  const [settleMethod, setSettleMethod] = useState('cash');

  const settleMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ action: 'refunded' | 'collected' | 'none'; amount: string }>(
        `/api/v1/hospital/patients/${settleTarget!.id}/settle-treatment`,
        { method: 'POST', body: JSON.stringify({ method: settleMethod }) },
      ),
    onSuccess: (result) => {
      if (result.action === 'refunded') setSnackbar(`Treatment completed — ${fmt(result.amount)} refunded via ${settleMethod}.`);
      else if (result.action === 'collected') setSnackbar(`Treatment completed — ${fmt(result.amount)} collected via ${settleMethod}.`);
      else setSnackbar('Treatment completed — balance was already settled.');
      setSettleTarget(null);
      setSettleMethod('cash');
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patients-active'] });
      queryClient.invalidateQueries({ queryKey: ['patients-pos-lookup'] });
      queryClient.invalidateQueries({ queryKey: ['patient-ledger', settleTarget?.id] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not complete treatment.'),
  });

  // ── Ledger ────────────────────────────────────────────────────────────────────
  const [ledgerTarget, setLedgerTarget] = useState<Patient | null>(null);

  const ledgerQuery = useQuery({
    queryKey: ['patient-ledger', ledgerTarget?.id],
    queryFn: () => apiFetch<PatientLedgerEntry[]>(`/api/v1/hospital/patients/${ledgerTarget!.id}/ledger`),
    enabled: Boolean(ledgerTarget),
  });

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <Box display="flex" height="100%">
      {/* ── Left panel: patients list ──────────────────────────────────────────── */}
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
              key: 'currentBalance',
              label: 'Advance',
              align: 'right' as const,
              render: (p) => (
                <Typography
                  variant="body2"
                  color={n(p.currentBalance) > 0 ? 'success.main' : 'text.secondary'}
                  fontWeight={n(p.currentBalance) > 0 ? 600 : 400}
                >
                  {n(p.currentBalance) > 0 ? fmt(p.currentBalance) : '—'}
                </Typography>
              ),
            },
            {
              key: 'isActive',
              label: 'Status',
              render: (p) => (
                <Chip
                  size="small"
                  label={p.isActive ? 'Active' : 'Inactive'}
                  color={p.isActive ? 'success' : 'default'}
                />
              ),
            },
            {
              key: 'actions',
              label: '',
              render: (p) => (
                <Stack direction="row" spacing={1} onClick={(e) => e.stopPropagation()} flexWrap="wrap">
                  <SecondaryButton size="small" onClick={() => openEdit(p)}>
                    Edit
                  </SecondaryButton>
                  <SecondaryButton
                    size="small"
                    onClick={() => {
                      setAdvanceTarget(p);
                      setAdvanceForm({ amount: '', method: 'cash', reference: '', notes: '' });
                    }}
                  >
                    Record Advance
                  </SecondaryButton>
                  {n(p.currentBalance) > 0 && (
                    <SecondaryButton
                      size="small"
                      onClick={() => {
                        setRefundTarget(p);
                        setRefundForm({ amount: '', method: 'cash', reference: '', notes: '' });
                      }}
                    >
                      Refund
                    </SecondaryButton>
                  )}
                  {n(p.currentBalance) !== 0 && (
                    <SecondaryButton
                      size="small"
                      onClick={() => {
                        setSettleTarget(p);
                        setSettleMethod('cash');
                      }}
                    >
                      Complete Treatment
                    </SecondaryButton>
                  )}
                  <SecondaryButton size="small" onClick={() => setLedgerTarget(p)}>
                    Ledger
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

      {/* ── Right panel: appointment history ──────────────────────────────────── */}
      <Box flex={1} p={2} overflow="auto">
        {!selected && (
          <Typography color="text.secondary">Select a patient to view their appointment history.</Typography>
        )}
        {selected && (
          <>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
              <Box>
                <Typography variant="h6" gutterBottom>
                  {selected.name}
                </Typography>
                <Typography color="text.secondary" gutterBottom>
                  {selected.phone ?? 'No phone'} · {selected.address ?? 'No address'}
                </Typography>
              </Box>
              {n(selected.currentBalance) > 0 && (
                <Box
                  sx={{
                    bgcolor: 'success.50',
                    border: '1px solid',
                    borderColor: 'success.200',
                    borderRadius: 1,
                    px: 2,
                    py: 1,
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    Advance Balance
                  </Typography>
                  <Typography variant="h6" color="success.main" fontWeight={700}>
                    {fmt(selected.currentBalance)}
                  </Typography>
                </Box>
              )}
            </Stack>
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
                { key: 'tokenNumber', label: 'Token', align: 'right' as const, render: (a) => a.tokenNumber },
                { key: 'appointmentType', label: 'Type', render: (a) => formatEnumLabel(a.appointmentType) },
                { key: 'status', label: 'Status', render: (a) => formatEnumLabel(a.status) },
              ]}
            />
          </>
        )}
      </Box>

      {/* ── Add Patient Modal ──────────────────────────────────────────────────── */}
      <AppModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add Patient"
        maxWidth="xs"
        actions={
          <>
            <SecondaryButton onClick={() => setCreateOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton
              disabled={!form.name || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              Add
            </PrimaryButton>
          </>
        }
      >
        <Stack spacing={2} mt={0.5}>
          <TextField
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoFocus
          />
          <TextField
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <TextField
            select
            label="Gender"
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value })}
          >
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
          <TextField
            label="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </Stack>
      </AppModal>

      {/* ── Edit Patient Modal ─────────────────────────────────────────────────── */}
      <AppModal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title="Edit Patient"
        maxWidth="xs"
        actions={
          <>
            <SecondaryButton onClick={() => setEditTarget(null)}>Cancel</SecondaryButton>
            <PrimaryButton
              disabled={!editForm.name || updateMutation.isPending}
              onClick={() => updateMutation.mutate()}
            >
              Save
            </PrimaryButton>
          </>
        }
      >
        <Stack spacing={2} mt={0.5}>
          <TextField
            label="Name"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            autoFocus
          />
          <TextField
            label="Phone"
            value={editForm.phone}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
          />
          <TextField
            select
            label="Gender"
            value={editForm.gender}
            onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
          >
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
          <TextField
            label="Address"
            value={editForm.address}
            onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
          />
        </Stack>
      </AppModal>

      {/* ── Record Advance Modal ───────────────────────────────────────────────── */}
      <AppModal
        open={Boolean(advanceTarget)}
        onClose={() => setAdvanceTarget(null)}
        title={`Record Advance — ${advanceTarget?.name}`}
        maxWidth="xs"
        actions={
          <>
            <SecondaryButton onClick={() => setAdvanceTarget(null)}>Cancel</SecondaryButton>
            <PrimaryButton
              disabled={!advanceForm.amount || parseFloat(advanceForm.amount) <= 0 || advanceMutation.isPending}
              onClick={() => advanceMutation.mutate()}
            >
              Record
            </PrimaryButton>
          </>
        }
      >
        <Stack spacing={2} mt={0.5}>
          {advanceTarget && n(advanceTarget.currentBalance) > 0 && (
            <Typography variant="body2" color="success.main">
              Current balance: {fmt(advanceTarget.currentBalance)}
            </Typography>
          )}
          <TextField
            autoFocus
            label="Amount"
            type="number"
            value={advanceForm.amount}
            onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })}
            inputProps={{ min: 0.01, step: 1 }}
          />
          <TextField
            select
            label="Payment Method"
            value={advanceForm.method}
            onChange={(e) => setAdvanceForm({ ...advanceForm, method: e.target.value })}
          >
            {ADVANCE_METHODS.map((m) => (
              <MenuItem key={m.value} value={m.value}>
                {m.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Reference (optional)"
            value={advanceForm.reference}
            onChange={(e) => setAdvanceForm({ ...advanceForm, reference: e.target.value })}
          />
          <TextField
            label="Notes (optional)"
            value={advanceForm.notes}
            onChange={(e) => setAdvanceForm({ ...advanceForm, notes: e.target.value })}
          />
        </Stack>
      </AppModal>

      {/* ── Refund Modal ───────────────────────────────────────────────────────── */}
      <AppModal
        open={Boolean(refundTarget)}
        onClose={() => setRefundTarget(null)}
        title={`Refund — ${refundTarget?.name}`}
        maxWidth="xs"
        actions={
          <>
            <SecondaryButton onClick={() => setRefundTarget(null)}>Cancel</SecondaryButton>
            <PrimaryButton
              disabled={
                !refundForm.amount ||
                parseFloat(refundForm.amount) <= 0 ||
                (refundTarget ? parseFloat(refundForm.amount) > n(refundTarget.currentBalance) : true) ||
                refundMutation.isPending
              }
              onClick={() => refundMutation.mutate()}
            >
              Refund
            </PrimaryButton>
          </>
        }
      >
        <Stack spacing={2} mt={0.5}>
          {refundTarget && (
            <Typography variant="body2" color="success.main">
              Available to refund: {fmt(refundTarget.currentBalance)}
            </Typography>
          )}
          <TextField
            autoFocus
            label="Amount"
            type="number"
            value={refundForm.amount}
            onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })}
            inputProps={{ min: 0.01, step: 1, max: refundTarget ? n(refundTarget.currentBalance) : undefined }}
            error={Boolean(refundTarget && parseFloat(refundForm.amount) > n(refundTarget.currentBalance))}
            helperText={
              refundTarget && parseFloat(refundForm.amount) > n(refundTarget.currentBalance)
                ? 'Cannot exceed the available advance balance.'
                : undefined
            }
          />
          <TextField
            select
            label="Refund Method"
            value={refundForm.method}
            onChange={(e) => setRefundForm({ ...refundForm, method: e.target.value })}
          >
            {ADVANCE_METHODS.map((m) => (
              <MenuItem key={m.value} value={m.value}>
                {m.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Reference (optional)"
            value={refundForm.reference}
            onChange={(e) => setRefundForm({ ...refundForm, reference: e.target.value })}
          />
          <TextField
            label="Notes (optional)"
            value={refundForm.notes}
            onChange={(e) => setRefundForm({ ...refundForm, notes: e.target.value })}
          />
        </Stack>
      </AppModal>

      {/* ── Complete Treatment (final settlement) Modal ───────────────────────── */}
      <AppModal
        open={Boolean(settleTarget)}
        onClose={() => setSettleTarget(null)}
        title={`Complete Treatment — ${settleTarget?.name}`}
        maxWidth="xs"
        actions={
          <>
            <SecondaryButton onClick={() => setSettleTarget(null)}>Cancel</SecondaryButton>
            <PrimaryButton disabled={settleMutation.isPending} onClick={() => settleMutation.mutate()}>
              {settleTarget && n(settleTarget.currentBalance) > 0 ? 'Refund & Complete' : 'Collect & Complete'}
            </PrimaryButton>
          </>
        }
      >
        <Stack spacing={2} mt={0.5}>
          {settleTarget && n(settleTarget.currentBalance) > 0 && (
            <Typography variant="body2">
              This patient has an advance balance of <strong>{fmt(settleTarget.currentBalance)}</strong>. Completing
              treatment will refund the full amount and bring their balance to zero.
            </Typography>
          )}
          {settleTarget && n(settleTarget.currentBalance) < 0 && (
            <Typography variant="body2">
              This patient owes <strong>{fmt(Math.abs(n(settleTarget.currentBalance)))}</strong>. Completing treatment
              will collect the full amount and bring their balance to zero.
            </Typography>
          )}
          <TextField
            select
            label={settleTarget && n(settleTarget.currentBalance) > 0 ? 'Refund Method' : 'Collection Method'}
            value={settleMethod}
            onChange={(e) => setSettleMethod(e.target.value)}
          >
            {ADVANCE_METHODS.map((m) => (
              <MenuItem key={m.value} value={m.value}>
                {m.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </AppModal>

      {/* ── Ledger Modal ──────────────────────────────────────────────────────── */}
      <AppModal
        open={Boolean(ledgerTarget)}
        onClose={() => setLedgerTarget(null)}
        title={`Ledger — ${ledgerTarget?.name}`}
        maxWidth="md"
        actions={<SecondaryButton onClick={() => setLedgerTarget(null)}>Close</SecondaryButton>}
      >
        <Box mt={0.5}>
          {ledgerTarget && n(ledgerTarget.currentBalance) > 0 && (
            <Typography variant="body2" color="success.main" mb={1} fontWeight={600}>
              Current balance: {fmt(ledgerTarget.currentBalance)}
            </Typography>
          )}
          <DataTable
            hideSearch
            defaultRowsPerPage={20}
            emptyMessage="No ledger entries yet."
            getRowId={(e: PatientLedgerEntry) => e.id}
            rows={ledgerQuery.data ?? []}
            columns={[
              {
                key: 'occurredAt',
                label: 'Date',
                sortable: true,
                sortValue: (e) => new Date(e.occurredAt).getTime(),
                render: (e) => new Date(e.occurredAt).toLocaleString(),
              },
              {
                key: 'entryType',
                label: 'Type',
                render: (e) => formatEnumLabel(e.entryType),
              },
              {
                key: 'description',
                label: 'Description',
                render: (e) => e.description ?? '—',
              },
              {
                key: 'amount',
                label: 'Amount',
                align: 'right' as const,
                render: (e) => {
                  const amt = n(e.amount);
                  return (
                    <Typography
                      variant="body2"
                      color={amt >= 0 ? 'success.main' : 'error.main'}
                      fontWeight={600}
                    >
                      {amt >= 0 ? '+' : ''}
                      {fmt(amt)}
                    </Typography>
                  );
                },
              },
              {
                key: 'balanceAfter',
                label: 'Balance After',
                align: 'right' as const,
                render: (e) => fmt(e.balanceAfter),
              },
            ]}
          />
        </Box>
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

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={3000}
        onClose={() => setSnackbar(null)}
        message={snackbar}
      />
    </Box>
  );
}
