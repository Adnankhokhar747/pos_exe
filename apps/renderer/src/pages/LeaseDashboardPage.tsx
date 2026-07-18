import { Box, Card, CardContent, Chip, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import type { LeaseSummary, LeaseUpcomingInstallment } from '../api/types';

function StatCard({ label, value, color, sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <Card sx={{ flex: 1, minWidth: 150 }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography variant="h4" fontWeight={700} color={color ?? 'text.primary'} mt={0.5}>
          {value}
        </Typography>
        {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
      </CardContent>
    </Card>
  );
}

function fmt(v: number | null | undefined): string {
  const n = v ?? 0;
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

const OVERDUE_COLOR: Record<string, 'error' | 'warning'> = { overdue: 'error', pending: 'warning' };

export function LeaseDashboardPage(): JSX.Element {
  const { data, isLoading } = useQuery<LeaseSummary>({
    queryKey: ['lease-summary'],
    queryFn: () => apiFetch('/api/v1/lease/reports/summary'),
    refetchInterval: 60_000,
  });

  const { data: upcoming = [] } = useQuery<LeaseUpcomingInstallment[]>({
    queryKey: ['lease-upcoming'],
    queryFn: () => apiFetch('/api/v1/lease/reports/upcoming?days=30'),
  });

  if (isLoading) return <Box p={3}><Typography color="text.secondary">Loading…</Typography></Box>;

  return (
    <Box p={2.5}>
      <Typography variant="h5" fontWeight={700} mb={2.5}>Financing Dashboard</Typography>

      {/* Stats row */}
      <Box display="flex" gap={2} flexWrap="wrap" mb={3}>
        <StatCard label="Active Agreements"   value={data?.activeAgreements ?? 0}    color="success.main" />
        <StatCard label="Overdue Installments" value={data?.overdueInstallments ?? 0} color={data?.overdueInstallments ? 'error.main' : undefined} />
        <StatCard label="This Month Collected" value={fmt(data?.monthlyCollected)}    sub="payments received" />
        <StatCard label="Total Outstanding"   value={fmt(data?.totalPending)}         color={data?.totalPending ? 'warning.main' : undefined} />
        <StatCard label="Total Collected"     value={fmt(data?.totalCollected)}        color="success.main" />
      </Box>

      {/* Upcoming installments */}
      <Typography variant="h6" fontWeight={600} mb={1}>Upcoming & Overdue (Next 30 Days)</Typography>
      {upcoming.length === 0 ? (
        <Typography color="text.secondary">No upcoming installments.</Typography>
      ) : (
        <Box display="flex" flexDirection="column" gap={1}>
          {upcoming.map((inst) => (
            <Card key={inst.id} variant="outlined">
              <CardContent sx={{ py: '8px !important', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Box flex={1} minWidth={140}>
                  <Typography fontWeight={600} fontSize="0.82rem">{inst.agreementTitle}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {inst.customerName} · Installment #{inst.installmentNumber}
                  </Typography>
                </Box>
                <Box textAlign="right">
                  <Typography fontWeight={700} fontSize="0.85rem">
                    {inst.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">Due {inst.dueDate}</Typography>
                </Box>
                <Chip
                  size="small"
                  label={inst.status === 'overdue'
                    ? `${Math.abs(inst.daysUntilDue)}d overdue`
                    : inst.daysUntilDue === 0 ? 'Due today' : `${inst.daysUntilDue}d left`
                  }
                  color={OVERDUE_COLOR[inst.status] ?? 'default'}
                />
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
}
