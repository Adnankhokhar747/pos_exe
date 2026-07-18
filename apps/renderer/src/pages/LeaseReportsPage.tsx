import { useState } from 'react';
import { Box, Card, CardContent, Paper, Stack, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import type { LeaseSummary } from '../api/types';
import { DataTable } from '../components/DataTable';
import { PrimaryButton } from '../components/buttons';

function fmt(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface InstallmentPaymentRow {
  id: string;
  agreementTitle: string;
  category: string;
  customerName: string | null;
  installmentNumber: number;
  dueDate: string;
  paidDate: string;
  amount: number;
  paidAmount: number;
  paymentMethod: string | null;
  referenceNumber: string | null;
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

  const { data: payments = [], isLoading } = useQuery<InstallmentPaymentRow[]>({
    queryKey: ['lease-payments-report', applied.from, applied.to],
    queryFn: () => apiFetch(`/api/v1/lease/reports/payments?from=${applied.from}&to=${applied.to}`),
  });

  const total = payments.reduce((s, r) => s + (r.paidAmount ?? 0), 0);

  return (
    <Box p={2.5}>
      <Typography variant="h5" fontWeight={700} mb={2.5}>Financing Reports</Typography>

      {/* Summary cards */}
      <Box display="flex" gap={2} flexWrap="wrap" mb={3}>
        {[
          { label: 'Active Agreements',   value: summary?.activeAgreements   ?? '—' },
          { label: 'Completed',           value: summary?.completedAgreements ?? '—' },
          { label: 'Overdue Installments',value: summary?.overdueInstallments ?? '—' },
          { label: 'This Month',          value: fmt(summary?.monthlyCollected) },
          { label: 'Total Outstanding',   value: fmt(summary?.totalPending) },
          { label: 'Total Collected',     value: fmt(summary?.totalCollected) },
        ].map((c) => (
          <Card key={c.label} sx={{ flex: 1, minWidth: 120 }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">{c.label}</Typography>
              <Typography variant="h6" fontWeight={700} mt={0.5}>{c.value}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Payment history */}
      <Paper sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" mb={2} flexWrap="wrap">
          <Typography variant="h6" fontWeight={600} sx={{ flex: 1 }}>Installment Payment History</Typography>
          <TextField label="From" type="date" size="small" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextField label="To"   type="date" size="small" InputLabelProps={{ shrink: true }} value={to}   onChange={(e) => setTo(e.target.value)} />
          <PrimaryButton size="small" onClick={() => setApplied({ from, to })}>Apply</PrimaryButton>
        </Stack>

        {isLoading ? (
          <Typography color="text.secondary">Loading…</Typography>
        ) : (
          <DataTable
            rows={payments}
            getRowId={(r) => r.id}
            getSearchText={(r) => `${r.agreementTitle} ${r.customerName ?? ''}`}
            columns={[
              { key: 'paidDate',    label: 'Paid Date',  render: (r) => r.paidDate },
              { key: 'agreement',   label: 'Agreement',  render: (r) => (
                <Box>
                  <Typography fontSize="0.78rem" fontWeight={600}>{r.agreementTitle}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>{r.category}</Typography>
                </Box>
              )},
              { key: 'customer',    label: 'Customer',   render: (r) => r.customerName ?? '—' },
              { key: 'inst',        label: 'Inst #',     render: (r) => `#${r.installmentNumber}` },
              { key: 'dueDate',     label: 'Due Date',   render: (r) => r.dueDate },
              { key: 'amount',      label: 'Installment',align: 'right', render: (r) => fmt(r.amount) },
              { key: 'paidAmount',  label: 'Paid',       align: 'right', render: (r) => fmt(r.paidAmount) },
              { key: 'method',      label: 'Method',     render: (r) => r.paymentMethod?.replace('_', ' ') ?? '—' },
              { key: 'ref',         label: 'Reference',  render: (r) => r.referenceNumber ?? '—' },
            ]}
          />
        )}

        {payments.length > 0 && (
          <Box display="flex" justifyContent="flex-end" mt={2}>
            <Typography fontWeight={700}>Total Collected: {fmt(total)}</Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
