import { Box, Card, CardContent, Chip, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import type { LeaseSummary } from '../api/types';

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <Card sx={{ flex: 1, minWidth: 160 }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography variant="h4" fontWeight={700} color={color ?? 'text.primary'} mt={0.5}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

function fmt(v: string | number | null | undefined): string {
  const n = parseFloat(String(v ?? 0));
  return isNaN(n) ? '0' : n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function LeaseDashboardPage(): JSX.Element {
  const { data, isLoading } = useQuery<LeaseSummary>({
    queryKey: ['lease-summary'],
    queryFn: () => apiFetch('/api/v1/lease/reports/summary'),
    refetchInterval: 60_000,
  });

  const { data: expiring = [] } = useQuery<ExpiringLease[]>({
    queryKey: ['lease-expiring'],
    queryFn: () => apiFetch('/api/v1/lease/reports/expiring?days=30'),
  });

  if (isLoading) return <Box p={3}><Typography color="text.secondary">Loading…</Typography></Box>;

  return (
    <Box p={3}>
      <Typography variant="h5" fontWeight={700} mb={3}>Lease Dashboard</Typography>

      {/* Stats row */}
      <Box display="flex" gap={2} flexWrap="wrap" mb={4}>
        <StatCard label="Active Leases"     value={data?.activeLeases ?? 0}   color="success.main" />
        <StatCard label="Expiring (30 days)" value={data?.expiringSoon ?? 0}  color={data?.expiringSoon ? 'warning.main' : undefined} />
        <StatCard label="Overdue Payments"  value={data?.overduePayments ?? 0} color={data?.overduePayments ? 'error.main' : undefined} />
        <StatCard label="This Month"        value={fmt(data?.monthlyRevenue)}  />
        <StatCard label="Total Collected"   value={fmt(data?.totalCollected)}  />
      </Box>

      {/* Expiring soon table */}
      <Typography variant="h6" fontWeight={600} mb={1}>Expiring in the Next 30 Days</Typography>
      {expiring.length === 0 ? (
        <Typography color="text.secondary">No leases expiring soon.</Typography>
      ) : (
        <Box display="flex" flexDirection="column" gap={1}>
          {expiring.map((e) => (
            <Card key={e.id} variant="outlined">
              <CardContent sx={{ py: '10px !important', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Box flex={1} minWidth={140}>
                  <Typography fontWeight={600}>{e.property?.name}</Typography>
                  <Typography variant="body2" color="text.secondary">{e.customer?.name} · {e.customer?.phone}</Typography>
                </Box>
                <Box textAlign="right">
                  <Typography variant="body2" color="text.secondary">Ends {e.endDate}</Typography>
                  <Chip
                    size="small"
                    label={e.daysLeft <= 7 ? `${e.daysLeft}d left` : `${e.daysLeft}d left`}
                    color={e.daysLeft <= 7 ? 'error' : 'warning'}
                  />
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
}

interface ExpiringLease {
  id: string;
  property: { name: string; type: string } | null;
  customer: { name: string; phone: string } | null;
  endDate: string;
  daysLeft: number;
  rentAmount: string;
  rentFrequency: string;
}
