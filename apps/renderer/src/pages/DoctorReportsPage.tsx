import { useState } from 'react';
import { Box, Card, MenuItem, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import type {
  Doctor,
  DoctorAppointmentSummary,
  DoctorPatientCount,
  DoctorRevenueSummary,
  HospitalRevenueSummary,
} from '../api/types';
import { DataTable } from '../components/DataTable';

function fmt(v: string | number): string {
  const num = typeof v === 'string' ? parseFloat(v) || 0 : v;
  return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function thisMonthIso(): string {
  return new Date().toISOString().slice(0, 7);
}

function defaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export function DoctorReportsPage(): JSX.Element {
  const [tab, setTab] = useState(0);
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState(todayIso());
  const [month, setMonth] = useState(thisMonthIso());
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(todayIso());

  const doctorsQuery = useQuery({
    queryKey: ['doctors-active'],
    queryFn: () => apiFetch<Doctor[]>('/api/v1/hospital/doctors'),
  });

  const dailyQuery = useQuery({
    queryKey: ['hospital-daily-patients', date, doctorId],
    queryFn: () =>
      apiFetch<DoctorPatientCount[]>(`/api/v1/hospital/reports/daily-patients?date=${date}${doctorId ? `&doctorId=${doctorId}` : ''}`),
    enabled: tab === 0,
  });

  const monthlyQuery = useQuery({
    queryKey: ['hospital-monthly-patients', month, doctorId],
    queryFn: () =>
      apiFetch<DoctorPatientCount[]>(
        `/api/v1/hospital/reports/monthly-patients?month=${month}${doctorId ? `&doctorId=${doctorId}` : ''}`,
      ),
    enabled: tab === 1,
  });

  const summaryQuery = useQuery({
    queryKey: ['hospital-summary', from, to, doctorId],
    queryFn: () =>
      apiFetch<DoctorAppointmentSummary[]>(
        `/api/v1/hospital/reports/summary?from=${from}&to=${to}${doctorId ? `&doctorId=${doctorId}` : ''}`,
      ),
    enabled: tab === 2,
  });

  const revenueQuery = useQuery({
    queryKey: ['hospital-revenue', from, to],
    queryFn: () => apiFetch<HospitalRevenueSummary>(`/api/v1/hospital/reports/revenue?from=${from}&to=${to}`),
    enabled: tab === 3,
  });
  const revenue = revenueQuery.data;
  const revenueByDoctor = (revenue?.byDoctor ?? []).filter((r) => !doctorId || r.doctorId === doctorId);

  return (
    <Box p={2} height="100%" overflow="auto">
      <Typography variant="h6" gutterBottom>
        Doctor Reports
      </Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Daily Patients" />
        <Tab label="Monthly Patients" />
        <Tab label="Booking Summary" />
        <Tab label="Revenue" />
      </Tabs>

      <Stack direction="row" spacing={2} mb={2} maxWidth={600}>
        <TextField select label="Doctor" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} sx={{ minWidth: 200 }}>
          <MenuItem value="">All Doctors</MenuItem>
          {(doctorsQuery.data ?? []).map((d) => (
            <MenuItem key={d.id} value={d.id}>
              {d.name}
            </MenuItem>
          ))}
        </TextField>
        {tab === 0 && (
          <TextField label="Date" type="date" InputLabelProps={{ shrink: true }} value={date} onChange={(e) => setDate(e.target.value)} />
        )}
        {tab === 1 && (
          <TextField label="Month" type="month" InputLabelProps={{ shrink: true }} value={month} onChange={(e) => setMonth(e.target.value)} />
        )}
        {(tab === 2 || tab === 3) && (
          <>
            <TextField label="From" type="date" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} />
            <TextField label="To" type="date" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} />
          </>
        )}
      </Stack>

      {tab === 0 && (
        <DataTable
          hideSearch
          emptyMessage="No completed appointments on this date."
          getRowId={(r: DoctorPatientCount) => r.doctorId}
          rows={dailyQuery.data ?? []}
          columns={[
            { key: 'doctorName', label: 'Doctor', sortable: true, render: (r) => r.doctorName },
            { key: 'patientCount', label: 'Patients Seen', align: 'right', sortable: true, render: (r) => r.patientCount },
          ]}
        />
      )}

      {tab === 1 && (
        <DataTable
          hideSearch
          emptyMessage="No completed appointments this month."
          getRowId={(r: DoctorPatientCount) => r.doctorId}
          rows={monthlyQuery.data ?? []}
          columns={[
            { key: 'doctorName', label: 'Doctor', sortable: true, render: (r) => r.doctorName },
            { key: 'patientCount', label: 'Patients Seen', align: 'right', sortable: true, render: (r) => r.patientCount },
          ]}
        />
      )}

      {tab === 2 && (
        <DataTable
          hideSearch
          emptyMessage="No appointments in this date range."
          getRowId={(r: DoctorAppointmentSummary) => r.doctorId}
          rows={summaryQuery.data ?? []}
          columns={[
            { key: 'doctorName', label: 'Doctor', sortable: true, render: (r) => r.doctorName },
            { key: 'walkInCount', label: 'Walk-Ins', align: 'right', sortable: true, render: (r) => r.walkInCount },
            { key: 'advanceBookingCount', label: 'Advance Bookings', align: 'right', sortable: true, render: (r) => r.advanceBookingCount },
            { key: 'completedCount', label: 'Completed', align: 'right', sortable: true, render: (r) => r.completedCount },
            { key: 'cancelledCount', label: 'Cancelled', align: 'right', sortable: true, render: (r) => r.cancelledCount },
            { key: 'noShowCount', label: 'No-Show', align: 'right', sortable: true, render: (r) => r.noShowCount },
          ]}
        />
      )}

      {tab === 3 && (
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Card sx={{ p: 2, minWidth: 180 }}>
              <Typography variant="body2" color="text.secondary">Consultation Revenue</Typography>
              <Typography variant="h6">{fmt(revenue?.totalConsultationRevenue ?? '0')}</Typography>
            </Card>
            <Card sx={{ p: 2, minWidth: 180 }}>
              <Typography variant="body2" color="text.secondary">Medicine Revenue</Typography>
              <Typography variant="h6">{fmt(revenue?.totalMedicineRevenue ?? '0')}</Typography>
            </Card>
            <Card sx={{ p: 2, minWidth: 180 }}>
              <Typography variant="body2" color="text.secondary">Total Hospital Revenue</Typography>
              <Typography variant="h6" fontWeight={700}>{fmt(revenue?.totalRevenue ?? '0')}</Typography>
            </Card>
            <Card sx={{ p: 2, minWidth: 180 }}>
              <Typography variant="body2" color="text.secondary">Advance Collected</Typography>
              <Typography variant="h6">{fmt(revenue?.totalAdvanceCollected ?? '0')}</Typography>
            </Card>
            <Card sx={{ p: 2, minWidth: 180 }}>
              <Typography variant="body2" color="text.secondary">Refunded</Typography>
              <Typography variant="h6">{fmt(revenue?.totalRefunded ?? '0')}</Typography>
            </Card>
          </Stack>
          <DataTable
            hideSearch
            emptyMessage="No finalized appointment bills in this date range."
            getRowId={(r: DoctorRevenueSummary) => r.doctorId}
            rows={revenueByDoctor}
            columns={[
              { key: 'doctorName', label: 'Doctor', sortable: true, render: (r) => r.doctorName },
              { key: 'appointmentCount', label: 'Bills Finalized', align: 'right', sortable: true, render: (r) => r.appointmentCount },
              {
                key: 'consultationRevenue',
                label: 'Consultation Revenue',
                align: 'right',
                sortable: true,
                sortValue: (r) => parseFloat(r.consultationRevenue),
                render: (r) => fmt(r.consultationRevenue),
              },
            ]}
          />
        </Stack>
      )}
    </Box>
  );
}
