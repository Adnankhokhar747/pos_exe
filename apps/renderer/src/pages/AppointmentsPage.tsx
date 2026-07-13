import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Chip,
  Divider,
  IconButton,
  MenuItem,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type {
  Appointment,
  AppointmentBill,
  AppointmentStatus,
  Doctor,
  Invoice,
  Patient,
  ProductWithStock,
  QueueStatus,
  ReceiptSettings,
} from '../api/types';
import { DataTable } from '../components/DataTable';
import { AppModal } from '../components/AppModal';
import { PrintPreviewModal } from '../components/PrintPreviewModal';
import { PrimaryButton, SecondaryButton, DangerButton } from '../components/buttons';
import { formatEnumLabel } from '../utils/format';
import { renderTokenSlipHtml } from '../printing/token-slip-template';
import { useAuth } from '../state/auth-context';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'online', label: 'Online' },
  { value: 'other', label: 'Other' },
];

const LEGAL_NEXT_STATES: Record<AppointmentStatus, AppointmentStatus[]> = {
  booked: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'no_show', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
};

interface MedicineLine {
  productId: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

interface PaymentLine {
  method: string;
  amount: string;
  reference: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function n(v: string | number): number {
  return typeof v === 'string' ? parseFloat(v) || 0 : v;
}

function fmt(v: string | number): string {
  const num = n(v);
  return isNaN(num) ? '0' : num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function AppointmentsPage(): JSX.Element {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.permissions.includes('hospital.appointment.manage') ?? false;
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

  const productsQuery = useQuery({
    queryKey: ['products-pos-grid-bill'],
    queryFn: () =>
      apiFetch<ProductWithStock[]>(
        `/api/v1/products/pos-grid?warehouseId=${user!.warehouseId}&search=`,
      ),
  });

  const appointmentsQuery = useQuery({
    queryKey: ['hospital-appointments', filterDoctorId, filterDate, filterStatus],
    queryFn: () => {
      const p = new URLSearchParams();
      if (filterDoctorId) p.set('doctorId', filterDoctorId);
      if (filterDate) p.set('date', filterDate);
      if (filterStatus) p.set('status', filterStatus);
      return apiFetch<Appointment[]>(`/api/v1/hospital/appointments?${p.toString()}`);
    },
  });

  async function printSlip(appointment: Appointment): Promise<void> {
    try {
      const [queue, rs] = await Promise.all([
        apiFetch<QueueStatus>(
          `/api/v1/hospital/queue?doctorId=${appointment.doctorId}&date=${appointment.appointmentDate.slice(0, 10)}`,
        ),
        apiFetch<ReceiptSettings>('/api/v1/settings/receipt-settings'),
      ]);
      const qp = appointment.tokenNumber - queue.currentToken;
      const html = renderTokenSlipHtml({
        appointment,
        branchName: user?.branchName ?? '',
        paperWidthMm: rs.paperWidthMm,
        queuePosition: qp > 0 ? qp : null,
      });
      setPrintPreview({ open: true, html, title: `Token Slip — #${appointment.tokenNumber}` });
    } catch {
      // printing failure must never block the appointment action
    }
  }

  // ── Walk-In ──────────────────────────────────────────────────────────────────

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

  // ── Advance Booking ───────────────────────────────────────────────────────────

  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advanceForm, setAdvanceForm] = useState({ patientId: '', doctorId: '', appointmentDate: '' });

  const advanceMutation = useMutation({
    mutationFn: () =>
      apiFetch<Appointment>('/api/v1/hospital/appointments', {
        method: 'POST',
        body: JSON.stringify({ ...advanceForm, appointmentType: 'advance' }),
      }),
    onSuccess: (appointment) => {
      setSnackbar(
        `Advance booking created — token #${appointment.tokenNumber} for ${appointment.appointmentDate.slice(0, 10)}.`,
      );
      setAdvanceForm({ patientId: '', doctorId: '', appointmentDate: '' });
      setAdvanceOpen(false);
      queryClient.invalidateQueries({ queryKey: ['hospital-appointments'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not create advance booking.'),
  });

  // ── Status transitions ────────────────────────────────────────────────────────

  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const statusMutation = useMutation({
    mutationFn: ({
      a,
      status,
      reason,
    }: {
      a: Appointment;
      status: AppointmentStatus;
      reason?: string;
    }) =>
      apiFetch<Appointment>(`/api/v1/hospital/appointments/${a.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, cancelReason: reason }),
      }),
    onSuccess: async (appointment, variables) => {
      setSnackbar(`Appointment ${formatEnumLabel(appointment.status).toLowerCase()}.`);
      setCancelTarget(null);
      setCancelReason('');
      queryClient.invalidateQueries({ queryKey: ['hospital-appointments'] });
      if (variables.status === 'confirmed') {
        await printSlip(appointment);
      }
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not update appointment.'),
  });

  // ── Record Advance ────────────────────────────────────────────────────────────

  const [advancePatientId, setAdvancePatientId] = useState<string | null>(null);
  const [advancePatientName, setAdvancePatientName] = useState('');
  const [advancePaymentLines, setAdvancePaymentLines] = useState<PaymentLine[]>([
    { method: 'cash', amount: '', reference: '' },
  ]);

  function openAdvanceModal(patientId: string, patientName: string): void {
    setAdvancePatientId(patientId);
    setAdvancePatientName(patientName);
    setAdvancePaymentLines([{ method: 'cash', amount: '', reference: '' }]);
  }

  function updateAdvPay(i: number, f: keyof PaymentLine, v: string): void {
    setAdvancePaymentLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, [f]: v } : l)));
  }

  const advanceMutationRecord = useMutation({
    mutationFn: () => {
      const payments = advancePaymentLines
        .filter((l) => n(l.amount) > 0)
        .map((l) => ({ method: l.method, amount: n(l.amount), reference: l.reference || undefined }));
      return apiFetch(`/api/v1/hospital/patients/${advancePatientId}/advance`, {
        method: 'POST',
        body: JSON.stringify({ payments }),
      });
    },
    onSuccess: () => {
      const total = advancePaymentLines.reduce((s, l) => s + n(l.amount), 0);
      setSnackbar(`Advance of ${fmt(total)} recorded for ${advancePatientName}.`);
      setAdvancePatientId(null);
      queryClient.invalidateQueries({ queryKey: ['patients-active'] });
      queryClient.invalidateQueries({ queryKey: ['patient-balance', advancePatientId] });
      queryClient.invalidateQueries({ queryKey: ['patients-pos-lookup'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not record advance.'),
  });

  // ── Billing Modal — two-phase: "Bill Items" tab then "Collect & Complete" tab ──

  const [billTarget, setBillTarget] = useState<Appointment | null>(null);
  const [billTab, setBillTab] = useState(0); // 0 = Bill Items, 1 = Collect Payment
  const [consultFee, setConsultFee] = useState('');
  const [medicineLines, setMedicineLines] = useState<MedicineLine[]>([]);
  const [advanceToApply, setAdvanceToApply] = useState('0');
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([{ method: 'cash', amount: '', reference: '' }]);

  const patientBalanceQuery = useQuery({
    queryKey: ['patient-balance', billTarget?.patientId],
    queryFn: () => apiFetch<Patient>(`/api/v1/hospital/patients/${billTarget!.patientId}`),
    enabled: Boolean(billTarget),
  });
  const patientBalance = n(patientBalanceQuery.data?.currentBalance ?? '0');

  const posInvoicesQuery = useQuery({
    queryKey: ['patient-pos-invoices-bill', billTarget?.patientId],
    queryFn: () => apiFetch<Invoice[]>(`/api/v1/hospital/patients/${billTarget!.patientId}/pos-invoices`),
    enabled: Boolean(billTarget),
  });
  const posInvoices = posInvoicesQuery.data ?? [];

  const medicineTotal = medicineLines.reduce((s, l) => s + n(l.quantity) * n(l.unitPrice), 0);
  const totalDue = n(consultFee) + medicineTotal;
  const advAmt = Math.min(n(advanceToApply), patientBalance, totalDue);
  const remaining = Math.max(0, totalDue - advAmt);
  const totalCollected = paymentLines.reduce((s, l) => s + n(l.amount), 0);
  const advanceCredited = Math.max(0, totalCollected - remaining);
  const patientBalanceAfter = patientBalance - advAmt + advanceCredited;

  // Deducting the consultation/medicine due from the patient's advance balance used to
  // require staff to notice and click "Apply Max" (or click "Next: Collect Payment", which
  // silently did it once) — not the fully-automatic deduction a hospital billing screen
  // should have. This keeps advanceToApply continuously synced to the max applicable amount
  // as soon as the balance loads or the bill total changes, with no click required, while
  // still letting staff type a smaller amount manually if they genuinely want to (tracked via
  // the ref so a manual edit isn't immediately clobbered by the next auto-sync).
  const advanceManuallyEditedRef = useRef(false);
  useEffect(() => {
    if (!billTarget || !patientBalanceQuery.isSuccess) return;
    if (advanceManuallyEditedRef.current) return;
    setAdvanceToApply(String(Math.min(patientBalance, totalDue)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billTarget, patientBalanceQuery.isSuccess, patientBalance, totalDue]);

  function openBillModal(a: Appointment, existingBill?: AppointmentBill | null): void {
    advanceManuallyEditedRef.current = false;
    setBillTarget(a);
    setBillTab(0);
    if (existingBill?.lines) {
      const consultLine = existingBill.lines.find((l) => l.lineType === 'consultation');
      const medLines = existingBill.lines.filter((l) => l.lineType === 'medicine');
      setConsultFee(consultLine?.unitPrice ?? a.doctor.consultationFee ?? '0');
      setMedicineLines(
        medLines.map((l) => ({
          productId: l.productId ?? '',
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
      );
    } else {
      setConsultFee(a.doctor.consultationFee ?? '0');
      setMedicineLines([]);
    }
    setAdvanceToApply('0');
    setPaymentLines([{ method: 'cash', amount: '', reference: '' }]);
  }

  async function openBillModalWithFetch(a: Appointment): Promise<void> {
    try {
      const bill = await apiFetch<AppointmentBill | null>(`/api/v1/hospital/appointments/${a.id}/bill`);
      openBillModal(a, bill);
    } catch {
      openBillModal(a, null);
    }
  }

  function addMedicineLine(): void {
    setMedicineLines((ls) => [...ls, { productId: '', description: '', quantity: '1', unitPrice: '' }]);
  }

  function updateMed(i: number, f: keyof MedicineLine, v: string): void {
    setMedicineLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, [f]: v } : l)));
  }

  function removeMed(i: number): void {
    setMedicineLines((ls) => ls.filter((_, idx) => idx !== i));
  }

  function addPaymentLine(): void {
    setPaymentLines((ls) => [...ls, { method: 'cash', amount: '', reference: '' }]);
  }

  function updatePay(i: number, f: keyof PaymentLine, v: string): void {
    setPaymentLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, [f]: v } : l)));
  }

  function removePaymentLine(i: number): void {
    setPaymentLines((ls) => ls.filter((_, idx) => idx !== i));
  }

  const products = productsQuery.data ?? [];

  function buildDraftBody() {
    return {
      consultationFee: n(consultFee),
      medicineLines: medicineLines.map((l) => ({
        productId: l.productId || undefined,
        description: l.description,
        quantity: n(l.quantity),
        unitPrice: n(l.unitPrice),
      })),
      notes: undefined,
    };
  }

  function buildFinalizeBody() {
    return {
      ...buildDraftBody(),
      advanceApplied: advAmt,
      payments:
        remaining > 0.005
          ? paymentLines
              .filter((l) => n(l.amount) > 0)
              .map((l) => ({ method: l.method, amount: n(l.amount), reference: l.reference || undefined }))
          : [],
    };
  }

  const saveDraftMutation = useMutation({
    mutationFn: () =>
      apiFetch<AppointmentBill>(`/api/v1/hospital/appointments/${billTarget!.id}/bill`, {
        method: 'PUT',
        body: JSON.stringify(buildDraftBody()),
      }),
    onSuccess: () => {
      setSnackbar('Bill items saved. You can collect payment later.');
      queryClient.invalidateQueries({ queryKey: ['hospital-appointments'] });
      setBillTab(1);
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not save bill items.'),
  });

  const billMutation = useMutation({
    mutationFn: () =>
      apiFetch<AppointmentBill>(`/api/v1/hospital/appointments/${billTarget!.id}/bill`, {
        method: 'POST',
        body: JSON.stringify(buildFinalizeBody()),
      }),
    onSuccess: (bill) => {
      const credited = n(bill.advanceCredited);
      setSnackbar(
        credited > 0
          ? `Bill finalized. ${fmt(credited)} credited to patient's advance balance.`
          : 'Bill finalized. Appointment completed.',
      );
      setBillTarget(null);
      queryClient.invalidateQueries({ queryKey: ['hospital-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['patients-active'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patients-pos-lookup'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not finalize bill.'),
  });

  const finalizeDisabled =
    billMutation.isPending ||
    totalDue < 0 ||
    (remaining > 0.005 && totalCollected - advanceCredited + advAmt < totalDue - 0.005);

  // ─────────────────────────────────────────────────────────────────────────────

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
        <TextField
          select
          size="small"
          label="Doctor"
          value={filterDoctorId}
          onChange={(e) => setFilterDoctorId(e.target.value)}
          sx={{ minWidth: 180 }}
        >
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
        <TextField
          select
          size="small"
          label="Status"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          sx={{ minWidth: 150 }}
        >
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
              const hasDraftBill = a.bill?.isDraft === true;
              const hasFinalBill = a.bill && !a.bill.isDraft;
              return (
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  {legal.includes('confirmed') && (
                    <SecondaryButton
                      size="small"
                      onClick={() => statusMutation.mutate({ a, status: 'confirmed' })}
                    >
                      Confirm Arrival
                    </SecondaryButton>
                  )}
                  {(a.status === 'booked' || a.status === 'confirmed') && (
                    <SecondaryButton
                      size="small"
                      onClick={() => openAdvanceModal(a.patientId, a.patient.name)}
                    >
                      + Advance
                    </SecondaryButton>
                  )}
                  {legal.includes('completed') && (
                    <PrimaryButton size="small" onClick={() => void openBillModalWithFetch(a)}>
                      {hasDraftBill ? 'Continue Bill' : 'Bill Patient'}
                    </PrimaryButton>
                  )}
                  {hasFinalBill && (
                    <Chip
                      label={`Billed ${fmt(a.bill!.totalDue)}`}
                      color="success"
                      size="small"
                      variant="outlined"
                    />
                  )}
                  {hasFinalBill && isAdmin && (
                    <SecondaryButton size="small" onClick={() => void openBillModalWithFetch(a)}>
                      Edit Bill
                    </SecondaryButton>
                  )}
                  {legal.includes('no_show') && (
                    <SecondaryButton
                      size="small"
                      onClick={() => statusMutation.mutate({ a, status: 'no_show' })}
                    >
                      No-Show
                    </SecondaryButton>
                  )}
                  {legal.includes('cancelled') && (
                    <DangerButton size="small" onClick={() => setCancelTarget(a)}>
                      Cancel
                    </DangerButton>
                  )}
                  {(a.status === 'confirmed' || a.status === 'booked' || a.status === 'completed') && (
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

      {/* ── Walk-In Modal ──────────────────────────────────────────────────────── */}
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
                  {n(p.currentBalance) > 0 ? ` (Adv: ${fmt(p.currentBalance)})` : ''}
                </MenuItem>
              ))}
            </TextField>
            <IconButton
              size="small"
              sx={{ mt: 0.5 }}
              title="Quick add patient"
              onClick={() => setQuickAddPatientOpen(true)}
            >
              <PersonAddAlt1Icon fontSize="small" />
            </IconButton>
          </Stack>
          <TextField
            select
            label="Doctor"
            value={walkInForm.doctorId}
            onChange={(e) => setWalkInForm({ ...walkInForm, doctorId: e.target.value })}
          >
            {(doctorsQuery.data ?? []).map((d) => (
              <MenuItem key={d.id} value={d.id}>
                {d.name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </AppModal>

      {/* ── Quick Add Patient ────────────────────────────────────────────────── */}
      <AppModal
        open={quickAddPatientOpen}
        onClose={() => setQuickAddPatientOpen(false)}
        title="Quick Add Patient"
        maxWidth="xs"
        actions={
          <>
            <SecondaryButton onClick={() => setQuickAddPatientOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton
              disabled={!quickAddPatientName || createPatientMutation.isPending}
              onClick={() => createPatientMutation.mutate()}
            >
              Add
            </PrimaryButton>
          </>
        }
      >
        <Stack spacing={2} mt={0.5}>
          <TextField
            fullWidth
            autoFocus
            label="Name"
            value={quickAddPatientName}
            onChange={(e) => setQuickAddPatientName(e.target.value)}
          />
          <TextField
            fullWidth
            label="Phone"
            value={quickAddPatientPhone}
            onChange={(e) => setQuickAddPatientPhone(e.target.value)}
          />
        </Stack>
      </AppModal>

      {/* ── Advance Booking Modal ────────────────────────────────────────────── */}
      <AppModal
        open={advanceOpen}
        onClose={() => setAdvanceOpen(false)}
        title="New Advance Booking"
        maxWidth="xs"
        actions={
          <>
            <SecondaryButton onClick={() => setAdvanceOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton
              disabled={
                !advanceForm.patientId || !advanceForm.doctorId || !advanceForm.appointmentDate || advanceMutation.isPending
              }
              onClick={() => advanceMutation.mutate()}
            >
              Book
            </PrimaryButton>
          </>
        }
      >
        <Stack spacing={2} mt={0.5}>
          <TextField
            select
            label="Patient"
            value={advanceForm.patientId}
            onChange={(e) => setAdvanceForm({ ...advanceForm, patientId: e.target.value })}
          >
            {(patientsQuery.data ?? []).map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
                {n(p.currentBalance) > 0 ? ` (Adv: ${fmt(p.currentBalance)})` : ''}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Doctor"
            value={advanceForm.doctorId}
            onChange={(e) => setAdvanceForm({ ...advanceForm, doctorId: e.target.value })}
          >
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

      {/* ── Cancel Modal ──────────────────────────────────────────────────────── */}
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
              onClick={() =>
                cancelTarget &&
                statusMutation.mutate({ a: cancelTarget, status: 'cancelled', reason: cancelReason })
              }
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
          <TextField
            label="Reason (optional)"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
        </Stack>
      </AppModal>

      {/* ── Record Advance Modal ─────────────────────────────────────────────── */}
      <AppModal
        open={Boolean(advancePatientId)}
        onClose={() => setAdvancePatientId(null)}
        title={`Record Advance — ${advancePatientName}`}
        maxWidth="sm"
        actions={
          <>
            <SecondaryButton onClick={() => setAdvancePatientId(null)}>Cancel</SecondaryButton>
            <PrimaryButton
              disabled={
                advanceMutationRecord.isPending ||
                advancePaymentLines.every((l) => n(l.amount) <= 0)
              }
              onClick={() => advanceMutationRecord.mutate()}
            >
              Record Advance
            </PrimaryButton>
          </>
        }
      >
        <Stack spacing={2} mt={0.5}>
          <Typography variant="body2" color="text.secondary">
            Enter the payment(s) the patient is depositing as advance. Each payment method can be added separately.
          </Typography>
          {advancePaymentLines.map((line, i) => (
            <Stack key={i} direction="row" spacing={1} alignItems="center">
              <TextField
                select
                size="small"
                label="Method"
                value={line.method}
                onChange={(e) => updateAdvPay(i, 'method', e.target.value)}
                sx={{ minWidth: 140 }}
              >
                {PAYMENT_METHODS.map((m) => (
                  <MenuItem key={m.value} value={m.value}>
                    {m.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                label="Amount"
                type="number"
                value={line.amount}
                onChange={(e) => updateAdvPay(i, 'amount', e.target.value)}
                inputProps={{ min: 0 }}
                sx={{ flex: 1 }}
              />
              <TextField
                size="small"
                label="Reference / Cheque #"
                value={line.reference}
                onChange={(e) => updateAdvPay(i, 'reference', e.target.value)}
                sx={{ flex: 1 }}
              />
              {advancePaymentLines.length > 1 && (
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => setAdvancePaymentLines((ls) => ls.filter((_, idx) => idx !== i))}
                >
                  <RemoveCircleOutlineIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>
          ))}
          <Box>
            <SecondaryButton
              size="small"
              onClick={() => setAdvancePaymentLines((ls) => [...ls, { method: 'cash', amount: '', reference: '' }])}
            >
              + Add Another Payment Method
            </SecondaryButton>
          </Box>
          {advancePaymentLines.some((l) => n(l.amount) > 0) && (
            <Box sx={{ bgcolor: 'success.50', border: '1px solid', borderColor: 'success.200', borderRadius: 1, p: 1.5 }}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="subtitle2" color="success.main">Total Advance</Typography>
                <Typography variant="subtitle2" color="success.main" fontWeight={700}>
                  {fmt(advancePaymentLines.reduce((s, l) => s + n(l.amount), 0))}
                </Typography>
              </Stack>
            </Box>
          )}
        </Stack>
      </AppModal>

      {/* ── Bill Modal ────────────────────────────────────────────────────────── */}
      <AppModal
        open={Boolean(billTarget)}
        onClose={() => setBillTarget(null)}
        title={`Bill — ${billTarget?.patient.name} · Token #${billTarget?.tokenNumber}`}
        maxWidth="md"
        actions={
          <>
            <SecondaryButton onClick={() => setBillTarget(null)}>Close</SecondaryButton>
            {billTab === 0 && (
              <SecondaryButton disabled={saveDraftMutation.isPending || totalDue <= 0} onClick={() => saveDraftMutation.mutate()}>
                Save Bill Items
              </SecondaryButton>
            )}
            {billTab === 0 && (
              <PrimaryButton
                disabled={saveDraftMutation.isPending || totalDue <= 0}
                onClick={() => setBillTab(1)}
              >
                Next: Collect Payment →
              </PrimaryButton>
            )}
            {billTab === 1 && (
              <SecondaryButton onClick={() => setBillTab(0)}>← Back to Items</SecondaryButton>
            )}
            {billTab === 1 && (
              <PrimaryButton disabled={finalizeDisabled} onClick={() => billMutation.mutate()}>
                Collect &amp; Complete
              </PrimaryButton>
            )}
          </>
        }
      >
        <Stack spacing={0} mt={0.5}>
          {/* Patient info bar */}
          <Box
            sx={{
              bgcolor: 'primary.50',
              border: '1px solid',
              borderColor: 'primary.200',
              borderRadius: 1,
              p: 1.5,
              mb: 2,
            }}
          >
            <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center">
              <Typography variant="body2">
                <strong>Patient:</strong> {billTarget?.patient.name}
              </Typography>
              <Typography variant="body2">
                <strong>Doctor:</strong> {billTarget?.doctor.name}
              </Typography>
              <Typography variant="body2" color={patientBalance > 0 ? 'success.main' : 'text.secondary'}>
                <strong>Advance Balance:</strong> {fmt(patientBalance)}
              </Typography>
              <Box sx={{ ml: 'auto' }}>
                <SecondaryButton
                  size="small"
                  onClick={() => billTarget && openAdvanceModal(billTarget.patientId, billTarget.patient.name)}
                >
                  + Record Advance
                </SecondaryButton>
              </Box>
            </Stack>
          </Box>

          <Tabs value={billTab} onChange={(_, v) => setBillTab(v as number)} sx={{ mb: 2 }}>
            <Tab label="1. Bill Items" />
            <Tab label="2. Collect Payment" />
          </Tabs>

          {/* ── Tab 0: Bill Items ── */}
          {billTab === 0 && (
            <Stack spacing={2}>

              {/* POS / pharmacy purchases — read-only reference */}
              {posInvoices.length > 0 && (
                <Box
                  sx={{
                    bgcolor: 'grey.50',
                    border: '1px solid',
                    borderColor: 'grey.300',
                    borderRadius: 1,
                    p: 1.5,
                  }}
                >
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Pharmacy / Store Purchases — already deducted from advance
                  </Typography>
                  {posInvoices.map((inv) => (
                    <Box key={inv.id} mb={0.5}>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(inv.createdAt).toLocaleDateString()} · Invoice #{inv.invoiceNo}
                      </Typography>
                      {(inv.lines ?? []).map((line) => (
                        <Stack key={line.id} direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">
                            {line.product?.name ?? 'Item'} × {n(line.quantity)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {fmt(line.lineTotal)}
                          </Typography>
                        </Stack>
                      ))}
                      <Stack direction="row" justifyContent="space-between" sx={{ borderTop: '1px dashed', borderColor: 'grey.300', mt: 0.5, pt: 0.5 }}>
                        <Typography variant="caption" fontWeight={600} color="text.secondary">Invoice Total</Typography>
                        <Typography variant="caption" fontWeight={600} color="text.secondary">{fmt(inv.grandTotal)}</Typography>
                      </Stack>
                    </Box>
                  ))}
                </Box>
              )}

              {/* Consultation fee */}
              <Stack direction="row" spacing={2} alignItems="center">
                <TextField
                  size="small"
                  label="Consultation Fee"
                  type="number"
                  value={consultFee}
                  onChange={(e) => setConsultFee(e.target.value)}
                  inputProps={{ min: 0 }}
                  sx={{ width: 200 }}
                />
                <Typography variant="body2" color="text.secondary">
                  Doctor's consultation fee
                </Typography>
              </Stack>

              {/* Clinic-only additional charges */}
              {medicineLines.length > 0 && (
                <Typography variant="caption" color="warning.main">
                  These are clinic charges (procedures, lab tests, in-clinic dispensed items). Do NOT add items bought at the pharmacy/POS — those are already deducted from advance above.
                </Typography>
              )}
              {medicineLines.map((line, i) => (
                <Stack key={i} direction="row" spacing={1} alignItems="center">
                  <TextField
                    select
                    size="small"
                    label="Item / Product"
                    value={line.productId}
                    onChange={(e) => {
                      const p = products.find((pr) => pr.id === e.target.value);
                      updateMed(i, 'productId', e.target.value);
                      if (p) {
                        updateMed(i, 'description', p.name);
                        updateMed(i, 'unitPrice', p.salePrice);
                      }
                    }}
                    sx={{ flex: 2 }}
                  >
                    <MenuItem value="">— Select product —</MenuItem>
                    {products.map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.name} ({fmt(p.salePrice)})
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    size="small"
                    label="Description"
                    value={line.description}
                    onChange={(e) => updateMed(i, 'description', e.target.value)}
                    sx={{ flex: 2 }}
                  />
                  <TextField
                    size="small"
                    label="Qty"
                    type="number"
                    value={line.quantity}
                    onChange={(e) => updateMed(i, 'quantity', e.target.value)}
                    inputProps={{ min: 0.01, step: 1 }}
                    sx={{ width: 80 }}
                  />
                  <TextField
                    size="small"
                    label="Unit Price"
                    type="number"
                    value={line.unitPrice}
                    onChange={(e) => updateMed(i, 'unitPrice', e.target.value)}
                    inputProps={{ min: 0 }}
                    sx={{ width: 120 }}
                  />
                  <Typography variant="body2" sx={{ minWidth: 80, textAlign: 'right' }}>
                    {fmt(n(line.quantity) * n(line.unitPrice))}
                  </Typography>
                  <IconButton size="small" color="error" onClick={() => removeMed(i)}>
                    <RemoveCircleOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}

              <Box>
                <SecondaryButton size="small" onClick={addMedicineLine}>
                  + Add Clinic Charge
                </SecondaryButton>
              </Box>

              <Divider />
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2">Consultation Fee</Typography>
                <Typography variant="body2">{fmt(consultFee)}</Typography>
              </Stack>
              {medicineTotal > 0 && (
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2">Additional Clinic Charges</Typography>
                  <Typography variant="body2">{fmt(medicineTotal)}</Typography>
                </Stack>
              )}
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="subtitle1" fontWeight={700}>Total Due (this bill)</Typography>
                <Typography variant="subtitle1" fontWeight={700}>{fmt(totalDue)}</Typography>
              </Stack>
            </Stack>
          )}

          {/* ── Tab 1: Collect Payment ── */}
          {billTab === 1 && (
            <Stack spacing={2}>
              {/* Bill summary (read-only) */}
              <Box sx={{ bgcolor: 'grey.50', borderRadius: 1, p: 1.5 }}>
                <Stack spacing={0.5}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">Consultation Fee</Typography>
                    <Typography variant="body2">{fmt(consultFee)}</Typography>
                  </Stack>
                  {medicineTotal > 0 && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2">Medicine Total</Typography>
                      <Typography variant="body2">{fmt(medicineTotal)}</Typography>
                    </Stack>
                  )}
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" fontWeight={600}>Total Due</Typography>
                    <Typography variant="body2" fontWeight={600}>{fmt(totalDue)}</Typography>
                  </Stack>
                </Stack>
              </Box>

              {/* Advance application */}
              <Stack direction="row" spacing={2} alignItems="center">
                <TextField
                  size="small"
                  label="Apply from Advance Balance"
                  type="number"
                  value={advanceToApply}
                  onChange={(e) => {
                    advanceManuallyEditedRef.current = true;
                    setAdvanceToApply(e.target.value);
                  }}
                  inputProps={{ min: 0, max: Math.min(patientBalance, totalDue) }}
                  helperText={`Available: ${fmt(patientBalance)} (applied automatically)`}
                  sx={{ width: 220 }}
                />
                <SecondaryButton
                  size="small"
                  onClick={() => {
                    advanceManuallyEditedRef.current = false;
                    setAdvanceToApply(String(Math.min(patientBalance, totalDue)));
                  }}
                >
                  Apply Max
                </SecondaryButton>
              </Stack>

              {/* Fully covered by advance — no cash needed */}
              {remaining <= 0.005 && advAmt > 0 && (
                <Box sx={{ bgcolor: 'success.50', border: '1px solid', borderColor: 'success.300', borderRadius: 1, p: 1.5 }}>
                  <Typography variant="body2" color="success.dark" fontWeight={600}>
                    ✓ Fully covered by advance balance — no cash payment required
                  </Typography>
                </Box>
              )}

              {/* Payment lines — only show when there's remaining to collect */}
              {remaining > 0.005 && (
                <>
                  <Typography variant="subtitle2">Remaining to Collect ({fmt(remaining)})</Typography>
                  {paymentLines.map((line, i) => (
                    <Stack key={i} direction="row" spacing={1} alignItems="center">
                      <TextField
                        select
                        size="small"
                        label="Method"
                        value={line.method}
                        onChange={(e) => updatePay(i, 'method', e.target.value)}
                        sx={{ minWidth: 140 }}
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <MenuItem key={m.value} value={m.value}>
                            {m.label}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        size="small"
                        label="Amount"
                        type="number"
                        value={line.amount}
                        onChange={(e) => updatePay(i, 'amount', e.target.value)}
                        inputProps={{ min: 0 }}
                        sx={{ flex: 1 }}
                      />
                      <TextField
                        size="small"
                        label="Reference"
                        value={line.reference}
                        onChange={(e) => updatePay(i, 'reference', e.target.value)}
                        sx={{ flex: 1 }}
                      />
                      {paymentLines.length > 1 && (
                        <IconButton size="small" color="error" onClick={() => removePaymentLine(i)}>
                          <RemoveCircleOutlineIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Stack>
                  ))}
                  <Box>
                    <SecondaryButton size="small" onClick={addPaymentLine}>
                      + Add Payment Method
                    </SecondaryButton>
                  </Box>
                </>
              )}

              <Divider />

              {/* Final summary */}
              <Box
                sx={{
                  bgcolor: 'grey.50',
                  border: '1px solid',
                  borderColor: 'grey.300',
                  borderRadius: 1,
                  p: 2,
                }}
              >
                <Stack spacing={0.75}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" fontWeight={600}>Total Due</Typography>
                    <Typography variant="body2" fontWeight={600}>{fmt(totalDue)}</Typography>
                  </Stack>
                  {advAmt > 0 && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="info.main">Advance Applied (−)</Typography>
                      <Typography variant="body2" color="info.main">− {fmt(advAmt)}</Typography>
                    </Stack>
                  )}
                  {remaining > 0.005 && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2">Remaining to Pay</Typography>
                      <Typography variant="body2">{fmt(remaining)}</Typography>
                    </Stack>
                  )}
                  {totalCollected > 0 && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2">Cash / Bank Collected</Typography>
                      <Typography variant="body2">{fmt(totalCollected)}</Typography>
                    </Stack>
                  )}
                  {advanceCredited > 0.005 && (
                    <>
                      <Divider sx={{ my: 0.5 }} />
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body1" color="info.dark" fontWeight={700}>
                          Overpayment → Credited to Advance
                        </Typography>
                        <Typography variant="h6" color="info.dark" fontWeight={700}>
                          {fmt(advanceCredited)}
                        </Typography>
                      </Stack>
                    </>
                  )}
                  <Divider sx={{ my: 0.5 }} />
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography
                      variant="body2"
                      color={patientBalanceAfter >= 0 ? 'success.main' : 'error.main'}
                      fontWeight={600}
                    >
                      Patient Advance Balance After
                    </Typography>
                    <Typography
                      variant="body1"
                      color={patientBalanceAfter >= 0 ? 'success.main' : 'error.main'}
                      fontWeight={700}
                    >
                      {patientBalanceAfter < 0 ? '− ' : ''}
                      {fmt(Math.abs(patientBalanceAfter))}
                    </Typography>
                  </Stack>
                </Stack>
              </Box>
            </Stack>
          )}
        </Stack>
      </AppModal>

      <PrintPreviewModal
        open={printPreview.open}
        title={printPreview.title}
        html={printPreview.html}
        onClose={() => setPrintPreview((c) => ({ ...c, open: false }))}
      />

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        message={snackbar}
      />
    </Box>
  );
}
