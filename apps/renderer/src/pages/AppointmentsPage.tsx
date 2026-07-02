import { useState } from 'react';
import { Box, IconButton, MenuItem, Snackbar, Stack, TextField, Typography } from '@mui/material';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { Appointment, AppointmentStatus, Doctor, Patient, QueueStatus, ReceiptSettings } from '../api/types';
import { DataTable } from '../components/DataTable';
import { AppModal } from '../components/AppModal';
import { PrintPreviewModal } from '../components/PrintPreviewModal';
import { PrimaryButton, SecondaryButton, DangerButton } from '../components/buttons';
import { formatEnumLabel } from '../utils/format';
import { renderTokenSlipHtml } from '../printing/token-slip-template';
import { useAuth } from '../state/auth-context';

const LEGAL_NEXT_STATES: Record<AppointmentStatus, AppointmentStatus[]> = {
  booked: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'no_show', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
};

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  booked: 'Confirm Arrival',
  confirmed: 'Complete',
  completed: '',
  cancelled: '',
  no_show: '',
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AppointmentsPage(): JSX.Element {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [printPreview, setPrintPreview] = useState<{ open: boolean; html: string; title: string }>({
    open: false,
    html: '',
    title: '',
  });

  const [filterDoctorId, setFilterDoctorId] = useState('');
  const [filterDate, setFilterDate] = useState(todayIso());
  const [filterStatus, setFilterStatus] = useState('');

  const doctorsQuery = useQuery({
    queryKey: ['doctors-active'],
    queryFn: () => apiFetch<Doctor[]>('/api/v1/hospital/doctors'),
  });

  const patientsQuery = useQuery({
    queryKey: ['patients-active'],
    queryFn: () => apiFetch<Patient[]>('/api/v1/hospital/patients'),
  });

  const appointmentsQuery = useQuery({
    queryKey: ['hospital-appointments', filterDoctorId, filterDate, filterStatus],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterDoctorId) params.set('doctorId', filterDoctorId);
      if (filterDate) params.set('date', filterDate);
      if (filterStatus) params.set('status', filterStatus);
      return apiFetch<Appointment[]>(`/api/v1/hospital/appointments?${params.toString()}`);
    },
  });

  async function printSlip(appointment: Appointment): Promise<void> {
    try {
      const [queue, receiptSettings] = await Promise.all([
        apiFetch<QueueStatus>(`/api/v1/hospital/queue?doctorId=${appointment.doctorId}&date=${appointment.appointmentDate.slice(0, 10)}`),
        apiFetch<ReceiptSettings>('/api/v1/settings/receipt-settings'),
      ]);
      const queuePosition = appointment.tokenNumber - queue.currentToken;
      const html = renderTokenSlipHtml({
        appointment,
        branchName: user?.branchName ?? '',
        paperWidthMm: receiptSettings.paperWidthMm,
        queuePosition: queuePosition > 0 ? queuePosition : null,
      });
      setPrintPreview({ open: true, html, title: `Token Slip — #${appointment.tokenNumber}` });
    } catch {
      // best-effort — printing failure must never block the appointment/status action itself
    }
  }

  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInForm, setWalkInForm] = useState({ patientId: '', doctorId: '' });

  const [quickAddPatientOpen, setQuickAddPatientOpen] = useState(false);
  const [quickAddPatientName, setQuickAddPatientName] = useState('');
  const [quickAddPatientPhone, setQuickAddPatientPhone] = useState('');
  const createPatientMutation = useMutation({
    mutationFn: () =>
      apiFetch<Patient>('/api/v1/hospital/patients', {
        method: 'POST',
        body: JSON.stringify({ name: quickAddPatientName, phone: quickAddPatientPhone || undefined }),
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['patients-active'] });
      setWalkInForm((form) => ({ ...form, patientId: created.id }));
      setQuickAddPatientOpen(false);
      setQuickAddPatientName('');
      setQuickAddPatientPhone('');
      setSnackbar('Patient added.');
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not add patient.'),
  });

  const walkInMutation = useMutation({
    mutationFn: () =>
      apiFetch<Appointment>('/api/v1/hospital/appointments', {
        method: 'POST',
        body: JSON.stringify({ ...walkInForm, appointmentType: 'walk_in' }),
      }),
    onSuccess: async (appointment) => {
      setSnackbar(`Walk-in token #${appointment.tokenNumber} issued.`);
      setWalkInForm({ patientId: '', doctorId: '' });
      setWalkInOpen(false);
      queryClient.invalidateQueries({ queryKey: ['hospital-appointments'] });
      await printSlip(appointment);
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not issue walk-in token.'),
  });

  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advanceForm, setAdvanceForm] = useState({ patientId: '', doctorId: '', appointmentDate: '' });
  const advanceMutation = useMutation({
    mutationFn: () =>
      apiFetch<Appointment>('/api/v1/hospital/appointments', {
        method: 'POST',
        body: JSON.stringify({ ...advanceForm, appointmentType: 'advance' }),
      }),
    onSuccess: (appointment) => {
      setSnackbar(`Advance booking created — token #${appointment.tokenNumber} for ${appointment.appointmentDate.slice(0, 10)}.`);
      setAdvanceForm({ patientId: '', doctorId: '', appointmentDate: '' });
      setAdvanceOpen(false);
      queryClient.invalidateQueries({ queryKey: ['hospital-appointments'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not create advance booking.'),
  });

  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const statusMutation = useMutation({
    mutationFn: ({ appointment, status, reason }: { appointment: Appointment; status: AppointmentStatus; reason?: string }) =>
      apiFetch<Appointment>(`/api/v1/hospital/appointments/${appointment.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, cancelReason: reason }),
      }),
    onSuccess: async (appointment, variables) => {
      setSnackbar(`Appointment marked ${formatEnumLabel(appointment.status).toLowerCase()}.`);
      setCancelTarget(null);
      setCancelReason('');
      queryClient.invalidateQueries({ queryKey: ['hospital-appointments'] });
      // Confirming arrival on an advance booking is the "verify booking + print slip"
      // moment from the spec — same template, same token assigned at booking time.
      if (variables.status === 'confirmed') {
        await printSlip(appointment);
      }
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not update appointment.'),
  });

  return (
    <Box p={2} height="100%" overflow="auto">
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Appointments</Typography>
        <Stack direction="row" spacing={1}>
          <SecondaryButton onClick={() => setAdvanceOpen(true)}>New Advance Booking</SecondaryButton>
          <PrimaryButton onClick={() => setWalkInOpen(true)}>New Walk-In</PrimaryButton>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={2} mb={2}>
        <TextField select size="small" label="Doctor" value={filterDoctorId} onChange={(e) => setFilterDoctorId(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">All Doctors</MenuItem>
          {(doctorsQuery.data ?? []).map((d) => (
            <MenuItem key={d.id} value={d.id}>
              {d.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          label="Date"
          type="date"
          InputLabelProps={{ shrink: true }}
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
        />
        <TextField select size="small" label="Status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} sx={{ minWidth: 150 }}>
          <MenuItem value="">All Statuses</MenuItem>
          {(['booked', 'confirmed', 'completed', 'cancelled', 'no_show'] as AppointmentStatus[]).map((s) => (
            <MenuItem key={s} value={s}>
              {formatEnumLabel(s)}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <DataTable
        hideSearch
        emptyMessage="No appointments found."
        getRowId={(a: Appointment) => a.id}
        rows={appointmentsQuery.data ?? []}
        columns={[
          { key: 'tokenNumber', label: 'Token', align: 'right', sortable: true, render: (a) => a.tokenNumber },
          { key: 'patient', label: 'Patient', render: (a) => a.patient.name },
          { key: 'doctor', label: 'Doctor', render: (a) => a.doctor.name },
          { key: 'appointmentType', label: 'Type', render: (a) => formatEnumLabel(a.appointmentType) },
          { key: 'status', label: 'Status', render: (a) => formatEnumLabel(a.status) },
          {
            key: 'actions',
            label: '',
            render: (a) => {
              const legal = LEGAL_NEXT_STATES[a.status];
              return (
                <Stack direction="row" spacing={1}>
                  {legal.includes('confirmed') && (
                    <SecondaryButton size="small" onClick={() => statusMutation.mutate({ appointment: a, status: 'confirmed' })}>
                      {STATUS_LABELS.booked}
                    </SecondaryButton>
                  )}
                  {legal.includes('completed') && (
                    <SecondaryButton size="small" onClick={() => statusMutation.mutate({ appointment: a, status: 'completed' })}>
                      {STATUS_LABELS.confirmed}
                    </SecondaryButton>
                  )}
                  {legal.includes('no_show') && (
                    <SecondaryButton size="small" onClick={() => statusMutation.mutate({ appointment: a, status: 'no_show' })}>
                      No-Show
                    </SecondaryButton>
                  )}
                  {legal.includes('cancelled') && (
                    <DangerButton size="small" onClick={() => setCancelTarget(a)}>
                      Cancel
                    </DangerButton>
                  )}
                  {(a.status === 'confirmed' || a.status === 'booked') && (
                    <SecondaryButton size="small" onClick={() => printSlip(a)}>
                      Print Slip
                    </SecondaryButton>
                  )}
                </Stack>
              );
            },
          },
        ]}
      />

      <AppModal
        open={walkInOpen}
        onClose={() => setWalkInOpen(false)}
        title="New Walk-In"
        maxWidth="xs"
        actions={
          <>
            <SecondaryButton onClick={() => setWalkInOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton
              disabled={!walkInForm.patientId || !walkInForm.doctorId || walkInMutation.isPending}
              onClick={() => walkInMutation.mutate()}
            >
              Issue Token
            </PrimaryButton>
          </>
        }
      >
        <Stack spacing={2} mt={0.5}>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <TextField
              select
              fullWidth
              label="Patient"
              value={walkInForm.patientId}
              onChange={(e) => setWalkInForm({ ...walkInForm, patientId: e.target.value })}
            >
              {(patientsQuery.data ?? []).map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </TextField>
            <IconButton size="small" sx={{ mt: 0.5 }} title="Quick add patient" onClick={() => setQuickAddPatientOpen(true)}>
              <PersonAddAlt1Icon fontSize="small" />
            </IconButton>
          </Stack>
          <TextField select label="Doctor" value={walkInForm.doctorId} onChange={(e) => setWalkInForm({ ...walkInForm, doctorId: e.target.value })}>
            {(doctorsQuery.data ?? []).map((d) => (
              <MenuItem key={d.id} value={d.id}>
                {d.name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </AppModal>

      <AppModal
        open={quickAddPatientOpen}
        onClose={() => setQuickAddPatientOpen(false)}
        title="Quick Add Patient"
        maxWidth="xs"
        actions={
          <>
            <SecondaryButton onClick={() => setQuickAddPatientOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton disabled={!quickAddPatientName || createPatientMutation.isPending} onClick={() => createPatientMutation.mutate()}>
              Add
            </PrimaryButton>
          </>
        }
      >
        <TextField
          fullWidth
          autoFocus
          label="Name"
          value={quickAddPatientName}
          onChange={(e) => setQuickAddPatientName(e.target.value)}
          sx={{ mt: 1 }}
        />
        <TextField
          fullWidth
          label="Phone"
          value={quickAddPatientPhone}
          onChange={(e) => setQuickAddPatientPhone(e.target.value)}
          sx={{ mt: 2 }}
        />
      </AppModal>

      <AppModal
        open={advanceOpen}
        onClose={() => setAdvanceOpen(false)}
        title="New Advance Booking"
        maxWidth="xs"
        actions={
          <>
            <SecondaryButton onClick={() => setAdvanceOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton
              disabled={!advanceForm.patientId || !advanceForm.doctorId || !advanceForm.appointmentDate || advanceMutation.isPending}
              onClick={() => advanceMutation.mutate()}
            >
              Book
            </PrimaryButton>
          </>
        }
      >
        <Stack spacing={2} mt={0.5}>
          <TextField select label="Patient" value={advanceForm.patientId} onChange={(e) => setAdvanceForm({ ...advanceForm, patientId: e.target.value })}>
            {(patientsQuery.data ?? []).map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label="Doctor" value={advanceForm.doctorId} onChange={(e) => setAdvanceForm({ ...advanceForm, doctorId: e.target.value })}>
            {(doctorsQuery.data ?? []).map((d) => (
              <MenuItem key={d.id} value={d.id}>
                {d.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Appointment Date"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={advanceForm.appointmentDate}
            onChange={(e) => setAdvanceForm({ ...advanceForm, appointmentDate: e.target.value })}
          />
        </Stack>
      </AppModal>

      <AppModal
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title="Cancel Appointment"
        maxWidth="xs"
        actions={
          <>
            <SecondaryButton onClick={() => setCancelTarget(null)}>Back</SecondaryButton>
            <DangerButton
              disabled={statusMutation.isPending}
              onClick={() => cancelTarget && statusMutation.mutate({ appointment: cancelTarget, status: 'cancelled', reason: cancelReason })}
            >
              Cancel Appointment
            </DangerButton>
          </>
        }
      >
        <Stack spacing={2} mt={0.5}>
          <Typography variant="body2">
            Cancel token #{cancelTarget?.tokenNumber} for {cancelTarget?.patient.name}?
          </Typography>
          <TextField label="Reason (optional)" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
        </Stack>
      </AppModal>

      <PrintPreviewModal
        open={printPreview.open}
        title={printPreview.title}
        html={printPreview.html}
        onClose={() => setPrintPreview((current) => ({ ...current, open: false }))}
      />

      <Snackbar open={Boolean(snackbar)} autoHideDuration={3000} onClose={() => setSnackbar(null)} message={snackbar} />
    </Box>
  );
}
