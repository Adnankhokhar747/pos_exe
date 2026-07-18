import { useState } from 'react';
import { Box, Card, CardContent, Paper, Stack, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import type { LeaseSummary } from '../api/types';
import { DataTable } from '../components/DataTable';
import { PrimaryButton } from '../components/buttons';

function fmt(v: string | number | null | undefined): string {
  const n = parseFloat(String(v ?? 0));
  return isNaN(n) ? '0.00' : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface PaymentRow {
  id: string;
  amount: string | number;
  paidDate: string;
  periodStart: string;
  periodEnd: string;
  paymentMethod: string | null;
  property: { name: string } | null;
  customer: { name: string } | null;
}

export function LeaseReportsPage(): JSX.Element {
  const today = new Date();
  const [from, setFrom] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`);
  const [to,   setTo]   = useState(today.toISOString().slice(0, 10));
  const [applied, setApplied] = useState({ from, to });

  const { data: summary } = useQuery<LeaseSummary>({
    queryKey: ['lease-summary'],
    queryFn: () => apiFetch('/api/v1/lease/reports/summary'),
  });

  const { data: paymentsReport = [], isLoading } = useQuery<PaymentRow[]>({
    queryKey: ['lease-payments-report', applied.from, applied.to],
    queryFn: () => apiFetch(`/api/v1/lease/reports/payments?from=${applied.from}&to=${applied.to}`),
  });

  const total = paymentsReport.reduce((sum, r) => sum + parseFloat(String(r.amount || 0)), 0);

  return (
    <Box p={3}>
      <Typography variant="h5" fontWeight={700} mb={3}>Lease Reports</Typography>

      <Box display="flex" gap={2} flexWrap="wrap" mb={4}>
        {[
          { label: 'Active Leases',    value: summary?.activeLeases ?? '—' },
          { label: 'Expiring (30d)',   value: summary?.expiringSoon ?? '—' },
          { label: 'Overdue Payments', value: summary?.overduePayments ?? '—' },
          { label: 'This Month',       value: fmt(summary?.monthlyRevenue) },
          { label: 'Total Collected',  value: fmt(summary?.totalCollected) },
        ].map((c) => (
          <Card key={c.label} sx={{ flex: 1, minWidth: 140 }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">{c.label}</Typography>
              <Typography variant="h5" fontWeight={700} mt={0.5}>{c.value}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Paper sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" mb={2} flexWrap="wrap">
          <Typography variant="h6" fontWeight={600} sx={{ flex: 1 }}>Payment History</Typography>
          <TextField label="From" type="date" size="small" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextField label="To"   type="date" size="small" InputLabelProps={{ shrink: true }} value={to}   onChange={(e) => setTo(e.target.value)} />
          <PrimaryButton size="small" onClick={() => setApplied({ from, to })}>Apply</PrimaryButton>
        </Stack>

        <DataTable
          rows={paymentsReport}
          getRowId={(r) => r.id}
          getSearchText={(r) => `${r.property?.name ?? ''} ${r.customer?.name ?? ''}`}
          columns={[
            { key: 'paidDate',      label: 'Date',     render: (r) => r.paidDate },
            { key: 'property',      label: 'Property', render: (r) => r.property?.name ?? '—' },
            { key: 'customer',      label: 'Customer', render: (r) => r.customer?.name ?? '—' },
            { key: 'period',        label: 'Period',   render: (r) => `${r.periodStart} → ${r.periodEnd}` },
            { key: 'amount',        label: 'Amount',   align: 'right', render: (r) => fmt(r.amount) },
            { key: 'paymentMethod', label: 'Method',   render: (r) => r.paymentMethod ?? '—' },
          ]}
        />

        {paymentsReport.length > 0 && (
          <Box display="flex" justifyContent="flex-end" mt={2}>
            <Typography fontWeight={700}>Total: {fmt(total)}</Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
