import { Box, Card, CardContent, Chip, CircularProgress, Divider, Stack, Typography } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import PaymentIcon from '@mui/icons-material/Payment';
import BarChartIcon from '@mui/icons-material/BarChart';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { useAuth } from '../state/auth-context';
import { useModules } from '../state/modules-context';
import type { SalesSummary, ProfitSummary, DoctorPatientCount, PaymentMethodTotal } from '../api/types';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmt(val: string | undefined | null, opts?: { sign?: boolean }): string {
  if (val === undefined || val === null) return '—';
  const n = parseFloat(val);
  const formatted = Math.abs(n).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (opts?.sign && n < 0) return `- ${formatted}`;
  return formatted;
}

function StatCard({
  title,
  value,
  sub,
  icon,
  accent,
  chip,
  loading,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent: string;
  chip?: { label: string; color: 'success' | 'error' | 'default' | 'warning' };
  loading?: boolean;
}) {
  return (
    <Card sx={{ flex: 1, minWidth: 180 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
          <Typography
            variant="caption"
            sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'text.secondary' }}
          >
            {title}
          </Typography>
          <Box sx={{ color: accent, display: 'flex' }}>{icon}</Box>
        </Stack>

        {loading ? (
          <CircularProgress size={22} sx={{ mt: 0.5 }} />
        ) : (
          <>
            <Typography variant="h5" fontWeight={700} mb={0.5} sx={{ wordBreak: 'break-all' }}>
              {value}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              {sub && (
                <Typography variant="caption" color="text.secondary">
                  {sub}
                </Typography>
              )}
              {chip && <Chip size="small" label={chip.label} color={chip.color} sx={{ fontWeight: 600 }} />}
            </Stack>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardPage(): JSX.Element {
  const { user } = useAuth();
  const { isModuleEnabled } = useModules();
  const branchId = user?.branchId ?? '';
  const today = todayStr();
  const hospitalEnabled = isModuleEnabled('hospital');

  const salesQ = useQuery({
    queryKey: ['dash-sales', today, branchId],
    queryFn: () =>
      apiFetch<SalesSummary>(`/api/v1/reports/sales-summary?branchId=${branchId}&from=${today}&to=${today}`),
    retry: false,
  });

  const profitQ = useQuery({
    queryKey: ['dash-profit', today, branchId],
    queryFn: () =>
      apiFetch<ProfitSummary>(`/api/v1/reports/profit-summary?branchId=${branchId}&from=${today}&to=${today}`),
    retry: false,
  });

  const paymentQ = useQuery({
    queryKey: ['dash-payments', today, branchId],
    queryFn: () =>
      apiFetch<PaymentMethodTotal[]>(
        `/api/v1/reports/payment-methods?branchId=${branchId}&from=${today}&to=${today}`,
      ),
    retry: false,
  });

  const patientsQ = useQuery({
    queryKey: ['dash-patients', today],
    queryFn: () => apiFetch<DoctorPatientCount[]>(`/api/v1/hospital/reports/daily-patients?date=${today}`),
    enabled: hospitalEnabled,
    retry: false,
  });

  const netProfit = profitQ.data ? parseFloat(profitQ.data.netProfit) : null;
  const isProfit = netProfit !== null ? netProfit >= 0 : null;

  // PHP backend may return { data: [...] } instead of a bare array
  function toArray<T>(val: unknown): T[] {
    if (Array.isArray(val)) return val as T[];
    if (val && typeof val === 'object' && Array.isArray((val as Record<string, unknown>).data))
      return (val as Record<string, unknown>).data as T[];
    return [];
  }

  const patientsArr = toArray<DoctorPatientCount>(patientsQ.data);
  const paymentArr = toArray<PaymentMethodTotal>(paymentQ.data);
  const totalPatients = patientsArr.reduce((s, d) => s + d.patientCount, 0);

  const dateLabel = new Date().toLocaleDateString('en', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Box p={2.5} height="100%" overflow="auto">
      {/* Page header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Today's Dashboard
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {dateLabel}
          </Typography>
        </Box>
      </Stack>

      {/* ── Top Stat Cards ── */}
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap mb={3}>
        <StatCard
          title="Net Sales"
          value={salesQ.isError ? '—' : fmt(salesQ.data?.netSales)}
          sub={salesQ.data ? `Gross: ${fmt(salesQ.data.grossSales)}` : undefined}
          icon={<ReceiptLongIcon fontSize="small" />}
          accent="#1565c0"
          loading={salesQ.isLoading}
        />

        <StatCard
          title="Net Profit / Loss"
          value={
            profitQ.isError
              ? '—'
              : netProfit !== null
                ? `${netProfit < 0 ? '- ' : ''}${fmt(String(Math.abs(netProfit)))}`
                : fmt(profitQ.data?.netProfit)
          }
          sub={profitQ.data ? `Expenses: ${fmt(profitQ.data.expenses)}` : undefined}
          icon={
            isProfit === null ? (
              <TrendingUpIcon fontSize="small" />
            ) : isProfit ? (
              <TrendingUpIcon fontSize="small" />
            ) : (
              <TrendingDownIcon fontSize="small" />
            )
          }
          accent={isProfit === null ? '#757575' : isProfit ? '#2e7d32' : '#d32f2f'}
          chip={
            netProfit !== null
              ? { label: isProfit ? 'Profit' : 'Loss', color: isProfit ? 'success' : 'error' }
              : undefined
          }
          loading={profitQ.isLoading}
        />

        {hospitalEnabled && (
          <StatCard
            title="Patients Today"
            value={patientsQ.isError ? '—' : String(totalPatients)}
            sub={
              patientsArr.length > 0
                ? `${patientsArr.length} doctor(s) active`
                : 'No patients yet'
            }
            icon={<LocalHospitalIcon fontSize="small" />}
            accent="#00897b"
            loading={patientsQ.isLoading}
          />
        )}
      </Stack>

      {/* ── Bottom Row ── */}
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        {/* Payment Methods */}
        <Card sx={{ flex: 2, minWidth: 260 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} mb={2}>
              <PaymentIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography variant="subtitle1">Payment Methods</Typography>
            </Stack>

            {paymentQ.isLoading && (
              <Box display="flex" justifyContent="center" py={3}>
                <CircularProgress size={24} />
              </Box>
            )}
            {paymentQ.isError && (
              <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                No payment data available
              </Typography>
            )}
            {!paymentQ.isLoading && !paymentQ.isError && paymentArr.length === 0 && (
              <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                No transactions today
              </Typography>
            )}
            {paymentArr.length > 0 &&
              paymentArr.map((pm, i) => (
                <Box key={pm.method}>
                  {i > 0 && <Divider sx={{ my: 1.5 }} />}
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" fontWeight={600} sx={{ textTransform: 'capitalize' }}>
                        {pm.method}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {pm.count} transaction{pm.count !== 1 ? 's' : ''}
                      </Typography>
                    </Box>
                    <Typography variant="body1" fontWeight={700}>
                      {fmt(pm.total)}
                    </Typography>
                  </Stack>
                </Box>
              ))}
          </CardContent>
        </Card>

        {/* Sales Breakdown */}
        <Card sx={{ flex: 1, minWidth: 220 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} mb={2}>
              <BarChartIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography variant="subtitle1">Sales Breakdown</Typography>
            </Stack>

            {salesQ.isLoading && (
              <Box display="flex" justifyContent="center" py={3}>
                <CircularProgress size={24} />
              </Box>
            )}
            {salesQ.isError && (
              <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                No data available
              </Typography>
            )}
            {salesQ.data && (
              <Stack spacing={1.5}>
                {[
                  { label: 'Gross Sales', value: salesQ.data.grossSales, bold: false, negative: false },
                  { label: 'Discounts', value: salesQ.data.discounts, bold: false, negative: true },
                  { label: 'Tax Collected', value: salesQ.data.taxCollected, bold: false, negative: false },
                ].map(({ label, value, negative }) => (
                  <Stack key={label} direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      {label}
                    </Typography>
                    <Typography variant="body2" color={negative ? 'error.main' : 'text.primary'}>
                      {negative && parseFloat(value) > 0 ? '- ' : ''}
                      {fmt(value)}
                    </Typography>
                  </Stack>
                ))}
                <Divider />
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" fontWeight={700}>
                    Net Sales
                  </Typography>
                  <Typography variant="body2" fontWeight={700} color="primary.main">
                    {fmt(salesQ.data.netSales)}
                  </Typography>
                </Stack>
              </Stack>
            )}
          </CardContent>
        </Card>

        {/* Patients by Doctor — only if hospital enabled and has data */}
        {hospitalEnabled && patientsArr.length > 0 && (
          <Card sx={{ flex: 1, minWidth: 220 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                <LocalHospitalIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                <Typography variant="subtitle1">Patients by Doctor</Typography>
              </Stack>
              <Stack spacing={1.5}>
                {patientsArr.map((d, i) => (
                  <Box key={d.doctorId}>
                    {i > 0 && <Divider sx={{ mb: 1.5 }} />}
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" color="text.secondary" sx={{ flex: 1, mr: 1 }}>
                        {d.doctorName}
                      </Typography>
                      <Chip
                        size="small"
                        label={`${d.patientCount} patient${d.patientCount !== 1 ? 's' : ''}`}
                        color="secondary"
                        sx={{ fontWeight: 600 }}
                      />
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        )}
      </Stack>
    </Box>
  );
}
