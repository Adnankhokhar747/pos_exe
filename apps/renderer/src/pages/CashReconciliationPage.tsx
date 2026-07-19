import { useState } from 'react';
import {
  Alert, Box, Card, CardContent, Chip, Divider, DialogActions,
  Paper, Snackbar, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Tooltip,
  Typography,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { CashDrawerSession, DailyClosing } from '../api/types';
import { AppModal } from '../components/AppModal';
import { PrimaryButton, SecondaryButton } from '../components/buttons';
import { useAuth } from '../state/auth-context';
import { useCurrency } from '../hooks/useCurrency';

interface DaySummary {
  date: string;
  totalRevenue: number;
  invoiceCount: number;
  cashPayments: number;
  totalExpenses: number;
  totalIncome: number;
  expectedCash: number;
}

function today(): string { return new Date().toISOString().slice(0, 10); }
function fmtTime(dt: string | null): string {
  if (!dt) return '—';
  try { return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return dt; }
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 120 }}>
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
        <Typography variant="h6" fontWeight={700} color={color ?? 'text.primary'} lineHeight={1.2}>{value}</Typography>
        {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
      </CardContent>
    </Card>
  );
}

function DrawerRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600}>{value}</Typography>
    </Stack>
  );
}

function CompareRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2">{value}</Typography>
    </Stack>
  );
}

export function CashReconciliationPage(): JSX.Element {
  const qc = useQueryClient();
  const { user } = useAuth();
  const branchId = user?.branchId ?? '';
  const cur = useCurrency();

  const [date, setDate]               = useState(today());
  const [countedCash, setCountedCash] = useState('');
  const [openFloat, setOpenFloat]     = useState('0');
  const [openDrawerOpen, setOpenDrawerOpen]   = useState(false);
  const [closeDrawerOpen, setCloseDrawerOpen] = useState(false);
  const [drawerCount, setDrawerCount] = useState('');
  const [snack, setSnack] = useState<{ msg: string; sev?: 'success' | 'info' | 'error' } | null>(null);

  // ── Queries ───────────────────────────────────────────────────
  const { data: summary, isFetching: summaryLoading, refetch: refetchSummary } = useQuery<DaySummary>({
    queryKey: ['daily-closing-summary', date, branchId],
    queryFn: () => {
      const p = new URLSearchParams({ date });
      if (branchId) p.set('branchId', branchId);
      return apiFetch<DaySummary>(`/api/v1/reports/daily-closing-summary?${p}`);
    },
    enabled: !!date,
  });

  const { data: openDrawer, refetch: refetchDrawer } = useQuery<CashDrawerSession | null>({
    queryKey: ['cash-drawer-open', branchId],
    queryFn: (): Promise<CashDrawerSession | null> => {
      const p = branchId ? `?branchId=${branchId}` : '';
      return apiFetch<CashDrawerSession | null>(`/api/v1/cash-drawer/open${p}`).catch(() => null);
    },
    refetchInterval: 30_000,
  });

  const { data: closings = [] } = useQuery<DailyClosing[]>({
    queryKey: ['daily-closings', branchId],
    queryFn: () => {
      const p = branchId ? `?branchId=${branchId}` : '';
      return apiFetch<DailyClosing[]>(`/api/v1/daily-closings${p}`);
    },
  });

  // ── Mutations ─────────────────────────────────────────────────
  const openDrawerMut = useMutation({
    mutationFn: () => apiFetch('/api/v1/cash-drawer/open', {
      method: 'POST',
      body: JSON.stringify({ branchId, openingFloat: parseFloat(openFloat) || 0 }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-drawer-open'] });
      setOpenDrawerOpen(false);
      setOpenFloat('0');
      setSnack({ msg: 'Cash drawer opened.', sev: 'success' });
    },
    onError: (e) => setSnack({ msg: e instanceof ApiError ? e.detail : 'Failed to open drawer.', sev: 'error' }),
  });

  const closeDrawerMut = useMutation({
    mutationFn: () => apiFetch(`/api/v1/cash-drawer/${openDrawer!.id}/close`, {
      method: 'POST',
      body: JSON.stringify({ closingCount: parseFloat(drawerCount) || 0 }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-drawer-open'] });
      setCloseDrawerOpen(false);
      setDrawerCount('');
      setSnack({ msg: 'Drawer closed and session recorded.', sev: 'success' });
    },
    onError: (e) => setSnack({ msg: e instanceof ApiError ? e.detail : 'Failed to close drawer.', sev: 'error' }),
  });

  const recordClosingMut = useMutation({
    mutationFn: () => apiFetch('/api/v1/daily-closings', {
      method: 'POST',
      body: JSON.stringify({ branchId, businessDate: date, countedCash: parseFloat(countedCash) || 0 }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-closings'] });
      setCountedCash('');
      setSnack({ msg: 'Daily closing recorded successfully.', sev: 'success' });
    },
    onError: (e) => setSnack({ msg: e instanceof ApiError ? e.detail : 'Failed to record closing.', sev: 'error' }),
  });

  // ── Derived values ────────────────────────────────────────────
  const expectedCash   = summary?.expectedCash ?? 0;
  const counted        = parseFloat(countedCash) || 0;
  const variance       = counted - expectedCash;
  const hasCountedCash = countedCash !== '';
  const alreadyClosed  = closings.some((c) => c.businessDate === date && !c.voidedAt);

  const drawerExpected   = parseFloat(String(openDrawer?.expectedClose ?? 0));
  const drawerCountedVal = parseFloat(drawerCount) || 0;
  const drawerVariance   = drawerCountedVal - drawerExpected;

  // Variance label helpers
  function varianceLabel(v: number): string {
    if (Math.abs(v) < 0.01) return ' (Exact)';
    return v > 0 ? ' (Overage)' : ' (Shortage)';
  }
  function varianceColor(v: number): string {
    if (Math.abs(v) < 0.01) return 'success.main';
    return v > 0 ? 'info.main' : 'error.main';
  }

  return (
    <Box p={3} maxWidth={960} mx="auto">
      {/* ─── Header ─── */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h6" fontWeight={700}>End-of-Day Cash Reconciliation</Typography>
          <Typography variant="body2" color="text.secondary">Close the day, verify cash, and lock the record.</Typography>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <TextField
            label="Business Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
            sx={{ width: 160 }}
          />
          <Tooltip title="Refresh summary">
            <span>
              <SecondaryButton size="small" onClick={() => { refetchSummary(); refetchDrawer(); }} disabled={summaryLoading}>
                <RefreshIcon fontSize="small" />
              </SecondaryButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      {/* ─── Day Summary Cards ─── */}
      <Typography variant="subtitle2" fontWeight={700} color="text.secondary" mb={1}>
        DAY SUMMARY — {date}
      </Typography>
      <Stack direction="row" spacing={1.5} mb={3} flexWrap="wrap" useFlexGap>
        <StatCard
          label="Total Revenue"
          value={cur.fmt(summary?.totalRevenue)}
          sub={`${summary?.invoiceCount ?? 0} invoices`}
        />
        <StatCard label="Cash Sales"     value={cur.fmt(summary?.cashPayments)}  color="success.main" />
        <StatCard label="Cash Expenses"  value={cur.fmt(summary?.totalExpenses)} color="error.main" />
        <StatCard label="Cash Income"    value={cur.fmt(summary?.totalIncome)}   color="info.main" />
        <StatCard
          label="Expected Cash in Drawer"
          value={cur.fmt(summary?.expectedCash)}
          color={expectedCash >= 0 ? 'success.main' : 'error.main'}
          sub="Sales + Income − Expenses"
        />
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} mb={3}>
        {/* ─── Cash Drawer Card ─── */}
        <Card variant="outlined" sx={{ flex: 1 }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
              <Typography fontWeight={700}>Cash Drawer</Typography>
              {openDrawer
                ? <Chip icon={<LockOpenIcon />} label="Open" color="success" size="small" />
                : <Chip icon={<LockIcon />} label="Closed" color="default" size="small" />}
            </Stack>

            {openDrawer ? (
              <>
                <Stack spacing={0.5} mb={2}>
                  <DrawerRow label="Opened at"     value={fmtTime(openDrawer.openedAt)} />
                  <DrawerRow label="Opening float" value={cur.fmt(openDrawer.openingFloat)} />
                  {openDrawer.expectedClose && (
                    <DrawerRow label="Expected close" value={cur.fmt(openDrawer.expectedClose)} />
                  )}
                </Stack>
                <PrimaryButton fullWidth onClick={() => { setDrawerCount(''); setCloseDrawerOpen(true); }}>
                  Count &amp; Close Drawer
                </PrimaryButton>
              </>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  No open drawer session. Open one before starting sales.
                </Typography>
                <PrimaryButton fullWidth onClick={() => { setOpenFloat('0'); setOpenDrawerOpen(true); }}>
                  Open Cash Drawer
                </PrimaryButton>
              </>
            )}
          </CardContent>
        </Card>

        {/* ─── Daily Closing Card ─── */}
        <Card variant="outlined" sx={{ flex: 1 }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
              <Typography fontWeight={700}>Record Daily Closing</Typography>
              {alreadyClosed && <Chip icon={<CheckCircleIcon />} label="Already closed" color="success" size="small" />}
            </Stack>

            {alreadyClosed ? (
              <Typography variant="body2" color="text.secondary">
                A closing has already been recorded for {date}. Check the history below.
              </Typography>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  Count all cash physically in the drawer and enter the total below.
                </Typography>

                <TextField
                  label={`Counted Cash (${cur.code || 'amount'})`}
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  type="number"
                  inputProps={{ min: 0, step: 0.01 }}
                  size="small"
                  fullWidth
                  sx={{ mb: 2 }}
                />

                {hasCountedCash && (
                  <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 1.5 }}>
                    <Stack spacing={0.5}>
                      <CompareRow label="Expected Cash" value={cur.fmt(expectedCash)} />
                      <CompareRow label="Counted Cash"  value={cur.fmt(counted)} />
                      <Divider sx={{ my: 0.5 }} />
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" fontWeight={700}>Variance</Typography>
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          {Math.abs(variance) < 0.01
                            ? <CheckCircleIcon fontSize="small" color="success" />
                            : <WarningAmberIcon fontSize="small" color={variance > 0 ? 'info' : 'error'} />}
                          <Typography variant="body2" fontWeight={700} color={varianceColor(variance)}>
                            {variance >= 0 ? '+' : ''}{cur.fmt(variance)}{varianceLabel(variance)}
                          </Typography>
                        </Stack>
                      </Stack>
                    </Stack>
                  </Paper>
                )}

                <PrimaryButton
                  fullWidth
                  onClick={() => recordClosingMut.mutate()}
                  disabled={!hasCountedCash || recordClosingMut.isPending}
                >
                  {recordClosingMut.isPending ? 'Recording…' : 'Lock Daily Closing'}
                </PrimaryButton>
              </>
            )}
          </CardContent>
        </Card>
      </Stack>

      {/* ─── Closing History ─── */}
      <Typography variant="subtitle2" fontWeight={700} color="text.secondary" mb={1}>
        CLOSING HISTORY
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell align="right">Expected Cash</TableCell>
              <TableCell align="right">Counted Cash</TableCell>
              <TableCell align="right">Variance</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {closings.map((c) => {
              const v     = parseFloat(c.variance);
              const exact = Math.abs(v) < 0.005;
              return (
                <TableRow key={c.id} selected={c.businessDate === date}>
                  <TableCell><Typography variant="body2" fontWeight={600}>{c.businessDate}</Typography></TableCell>
                  <TableCell align="right">{cur.fmt(c.expectedCash)}</TableCell>
                  <TableCell align="right">{cur.fmt(c.countedCash)}</TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600} color={varianceColor(v)}>
                      {v >= 0 ? '+' : ''}{cur.fmt(v)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {c.voidedAt
                      ? <Chip label="Voided"   size="small" color="error"   variant="outlined" />
                      : exact
                        ? <Chip label="Balanced" size="small" color="success" variant="outlined" />
                        : v > 0
                          ? <Chip label="Overage"  size="small" color="info"    variant="outlined" />
                          : <Chip label="Shortage" size="small" color="warning" variant="outlined" />}
                  </TableCell>
                </TableRow>
              );
            })}
            {closings.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography variant="body2" color="text.secondary" py={2}>No closings recorded yet.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ─── Open Drawer Modal ─── */}
      <AppModal open={openDrawerOpen} onClose={() => setOpenDrawerOpen(false)} title="Open Cash Drawer">
        <Stack spacing={2} pt={0.5}>
          <Typography variant="body2" color="text.secondary">
            Enter the opening float — the cash physically placed in the drawer before sales begin.
          </Typography>
          <TextField
            label={`Opening Float (${cur.code || 'amount'})`}
            value={openFloat}
            onChange={(e) => setOpenFloat(e.target.value)}
            type="number"
            inputProps={{ min: 0, step: 0.01 }}
            size="small"
            fullWidth
            autoFocus
          />
        </Stack>
        <DialogActions sx={{ mt: 1 }}>
          <SecondaryButton onClick={() => setOpenDrawerOpen(false)}>Cancel</SecondaryButton>
          <PrimaryButton onClick={() => openDrawerMut.mutate()} disabled={openDrawerMut.isPending}>
            {openDrawerMut.isPending ? 'Opening…' : 'Open Drawer'}
          </PrimaryButton>
        </DialogActions>
      </AppModal>

      {/* ─── Close Drawer Modal ─── */}
      <AppModal open={closeDrawerOpen} onClose={() => setCloseDrawerOpen(false)} title="Close Cash Drawer">
        <Stack spacing={2} pt={0.5}>
          {openDrawer && (
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
              <Stack spacing={0.5}>
                <DrawerRow label="Opened at"     value={fmtTime(openDrawer.openedAt)} />
                <DrawerRow label="Opening float" value={cur.fmt(openDrawer.openingFloat)} />
              </Stack>
            </Paper>
          )}
          <TextField
            label={`Actual Cash Counted (${cur.code || 'amount'})`}
            value={drawerCount}
            onChange={(e) => setDrawerCount(e.target.value)}
            type="number"
            inputProps={{ min: 0, step: 0.01 }}
            size="small"
            fullWidth
            autoFocus
          />
          {drawerCount !== '' && openDrawer && (
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
              <Stack spacing={0.5}>
                <CompareRow label="Expected (float + cash sales)" value={cur.fmt(openDrawer.expectedClose ?? 0)} />
                <CompareRow label="Counted"                       value={cur.fmt(drawerCountedVal)} />
                <Divider sx={{ my: 0.25 }} />
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" fontWeight={700}>Variance</Typography>
                  <Typography variant="body2" fontWeight={700} color={varianceColor(drawerVariance)}>
                    {drawerVariance >= 0 ? '+' : ''}{cur.fmt(drawerVariance)}
                  </Typography>
                </Stack>
              </Stack>
            </Paper>
          )}
        </Stack>
        <DialogActions sx={{ mt: 1 }}>
          <SecondaryButton onClick={() => setCloseDrawerOpen(false)}>Cancel</SecondaryButton>
          <PrimaryButton onClick={() => closeDrawerMut.mutate()} disabled={!drawerCount || closeDrawerMut.isPending}>
            {closeDrawerMut.isPending ? 'Closing…' : 'Close Drawer'}
          </PrimaryButton>
        </DialogActions>
      </AppModal>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack?.sev ?? 'info'} onClose={() => setSnack(null)} variant="filled">{snack?.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
