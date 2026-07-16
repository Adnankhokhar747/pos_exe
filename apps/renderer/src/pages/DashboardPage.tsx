import { Box, Card, CardContent, Chip, CircularProgress, Divider, Stack, Typography } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PeopleIcon from '@mui/icons-material/People';
import InventoryIcon from '@mui/icons-material/Inventory';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import BarChartIcon from '@mui/icons-material/BarChart';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { useAuth } from '../state/auth-context';
import { useModules } from '../state/modules-context';
import type { SalesSummary, ProfitSummary } from '../api/types';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmt(val: string | undefined | null): string {
  if (val === undefined || val === null) return '—';
  const n = parseFloat(val);
  return Math.abs(n).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toArr(val: unknown): unknown[] {
  if (Array.isArray(val)) return val;
  if (val && typeof val === 'object' && Array.isArray((val as Record<string, unknown>).data))
    return (val as Record<string, unknown>).data as unknown[];
  return [];
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

  // Total products — uses existing /products endpoint, count the result
  const productsQ = useQuery({
    queryKey: ['dash-products'],
    queryFn: () => apiFetch<unknown>(`/api/v1/products`),
    retry: false,
    select: (data) => toArr(data).length,
  });

  // Low stock — uses existing /reports/low-stock endpoint
  const lowStockQ = useQuery({
    queryKey: ['dash-low-stock', branchId],
    queryFn: () => apiFetch<unknown>(`/api/v1/reports/low-stock?branchId=${branchId}`),
    retry: false,
    select: (data) => toArr(data).length,
  });

  // Total doctors (hospital only) — uses existing /hospital/doctors endpoint
  const doctorsQ = useQuery({
    queryKey: ['dash-doctors'],
    queryFn: () => apiFetch<unknown>(`/api/v1/hospital/doctors`),
    enabled: hospitalEnabled,
    retry: false,
    select: (data) => toArr(data).length,
  });

  // Total patients (hospital only) — uses existing /hospital/patients endpoint
  const patientsCountQ = useQuery({
    queryKey: ['dash-patients-count'],
    queryFn: () => apiFetch<unknown>(`/api/v1/hospital/patients`),
    enabled: hospitalEnabled,
    retry: false,
    select: (data) => toArr(data).length,
  });

  const netProfit = profitQ.data ? parseFloat(profitQ.data.netProfit) : null;
  const isProfit = netProfit !== null ? netProfit >= 0 : null;

  const dateLabel = new Date().toLocaleDateString('en', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const lowStock = lowStockQ.data ?? 0;

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
          icon={isProfit === false ? <TrendingDownIcon fontSize="small" /> : <TrendingUpIcon fontSize="small" />}
          accent={isProfit === null ? '#757575' : isProfit ? '#2e7d32' : '#d32f2f'}
          chip={
            netProfit !== null
              ? { label: isProfit ? 'Profit' : 'Loss', color: isProfit ? 'success' : 'error' }
              : undefined
          }
          loading={profitQ.isLoading}
        />

        <StatCard
          title="Total Products"
          value={productsQ.isError ? '—' : productsQ.isLoading ? '…' : String(productsQ.data ?? 0)}
          sub="Active products"
          icon={<InventoryIcon fontSize="small" />}
          accent="#7b1fa2"
          loading={productsQ.isLoading}
        />

        <StatCard
          title="Low Stock"
          value={lowStockQ.isError ? '—' : lowStockQ.isLoading ? '…' : String(lowStock)}
          sub={lowStock > 0 ? 'Need restocking' : 'All levels OK'}
          icon={<WarningAmberIcon fontSize="small" />}
          accent={lowStock > 0 ? '#e65100' : '#388e3c'}
          chip={lowStock > 0 ? { label: 'Alert', color: 'warning' } : undefined}
          loading={lowStockQ.isLoading}
        />

        {hospitalEnabled && (
          <StatCard
            title="Total Patients"
            value={patientsCountQ.isError ? '—' : patientsCountQ.isLoading ? '…' : String(patientsCountQ.data ?? 0)}
            sub="Registered patients"
            icon={<PeopleIcon fontSize="small" />}
            accent="#00897b"
            loading={patientsCountQ.isLoading}
          />
        )}

        {hospitalEnabled && (
          <StatCard
            title="Total Doctors"
            value={doctorsQ.isError ? '—' : doctorsQ.isLoading ? '…' : String(doctorsQ.data ?? 0)}
            sub="Active doctors"
            icon={<MedicalServicesIcon fontSize="small" />}
            accent="#0277bd"
            loading={doctorsQ.isLoading}
          />
        )}
      </Stack>

      {/* ── Bottom Row ── */}
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        {/* Sales Breakdown */}
        <Card sx={{ flex: 1, minWidth: 260 }}>
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
                  { label: 'Gross Sales', value: salesQ.data.grossSales, negative: false },
                  { label: 'Discounts', value: salesQ.data.discounts, negative: true },
                  { label: 'Tax Collected', value: salesQ.data.taxCollected, negative: false },
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

        {/* Low Stock Alert detail — only when items need restocking */}
        {!lowStockQ.isLoading && !lowStockQ.isError && lowStock > 0 && (
          <Card sx={{ flex: 1, minWidth: 260 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                <WarningAmberIcon fontSize="small" sx={{ color: 'warning.main' }} />
                <Typography variant="subtitle1">Low Stock Alert</Typography>
                <Chip size="small" label={`${lowStock} item${lowStock !== 1 ? 's' : ''}`} color="warning" sx={{ fontWeight: 600 }} />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {lowStock} product{lowStock !== 1 ? 's are' : ' is'} at or below reorder level.
                Go to <strong>Inventory → Stock Levels</strong> to review.
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* Hospital summary — only if hospital module enabled and patients exist */}
        {hospitalEnabled && (patientsCountQ.data ?? 0) > 0 && (
          <Card sx={{ flex: 1, minWidth: 220 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                <LocalHospitalIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                <Typography variant="subtitle1">Hospital Summary</Typography>
              </Stack>
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Total Patients</Typography>
                  <Typography variant="body2" fontWeight={700}>{patientsCountQ.data ?? 0}</Typography>
                </Stack>
                <Divider />
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Active Doctors</Typography>
                  <Typography variant="body2" fontWeight={700}>{doctorsQ.data ?? 0}</Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        )}
      </Stack>
    </Box>
  );
}
