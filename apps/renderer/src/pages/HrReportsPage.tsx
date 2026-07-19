import { useState } from 'react';
import {
  Alert, Box, Card, CardContent, Chip, MenuItem, Paper, Snackbar,
  Stack, Tab, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import type { HrEmployee } from '../api/types';
import { PrimaryButton } from '../components/buttons';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface AttSummaryRow {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  halfDays: number;
  leaveDays: number;
  overtimeHours: number;
  totalWorkHours: number;
}

interface GridDay { date: string; status: string | null }
interface GridEmployee {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  days: GridDay[];
}
interface MonthlyGrid { days: string[]; employees: GridEmployee[] }

const STATUS_ABBR: Record<string, string> = {
  present: 'P', absent: 'A', late: 'L', half_day: 'H', on_leave: 'V',
};
const STATUS_COLORS: Record<string, string> = {
  present: '#4caf50', absent: '#f44336', late: '#ff9800', half_day: '#2196f3', on_leave: '#9c27b0',
};

function today(): string { return new Date().toISOString().slice(0, 10); }

export function HrReportsPage(): JSX.Element {
  const now = new Date();
  const [tab, setTab] = useState(0);
  const [snack, setSnack] = useState<string | null>(null);

  // Summary filters
  const [sumFilters, setSumFilters] = useState({ from: today(), to: today() });
  const [sumEnabled, setSumEnabled] = useState(false);

  // Monthly grid filters
  const [gridFilters, setGridFilters] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [gridEnabled, setGridEnabled] = useState(false);

  const { data: employees = [] } = useQuery<HrEmployee[]>({
    queryKey: ['hr-employees'],
    queryFn: () => apiFetch('/api/v1/hr/employees'),
  });

  const { data: summaryData = [], isFetching: sumFetching } = useQuery<AttSummaryRow[]>({
    queryKey: ['hr-report-summary', sumFilters],
    queryFn: () => {
      const p = new URLSearchParams({ from: sumFilters.from, to: sumFilters.to });
      return apiFetch(`/api/v1/hr/reports/attendance-summary?${p}`);
    },
    enabled: sumEnabled,
  });

  const { data: gridData, isFetching: gridFetching } = useQuery<MonthlyGrid>({
    queryKey: ['hr-report-grid', gridFilters],
    queryFn: () => {
      const p = new URLSearchParams({ month: String(gridFilters.month), year: String(gridFilters.year) });
      return apiFetch(`/api/v1/hr/reports/monthly-grid?${p}`);
    },
    enabled: gridEnabled,
  });

  return (
    <Box p={3}>
      <Typography variant="h6" fontWeight={700} mb={2}>HR Reports</Typography>

      <Tabs value={tab} onChange={(_, v) => { setTab(v); }} sx={{ mb: 3 }}>
        <Tab label="Attendance Summary" />
        <Tab label="Monthly Grid" />
      </Tabs>

      {tab === 0 && (
        <>
          <Stack direction="row" spacing={2} mb={3} alignItems="center" flexWrap="wrap">
            <TextField label="From" type="date" value={sumFilters.from} onChange={(e) => setSumFilters((p) => ({ ...p, from: e.target.value }))} size="small" InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
            <TextField label="To" type="date" value={sumFilters.to} onChange={(e) => setSumFilters((p) => ({ ...p, to: e.target.value }))} size="small" InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
            <PrimaryButton startIcon={<SearchIcon />} onClick={() => setSumEnabled(true)} disabled={sumFetching}>
              {sumFetching ? 'Loading…' : 'Run Report'}
            </PrimaryButton>
          </Stack>

          {summaryData.length > 0 && (
            <>
              <Stack direction="row" spacing={2} mb={2} flexWrap="wrap">
                {[
                  { label: 'Employees', value: summaryData.length, color: 'default' },
                  { label: 'Avg Present', value: (summaryData.reduce((s, r) => s + r.presentDays, 0) / summaryData.length).toFixed(1), color: 'success' },
                  { label: 'Avg Absent', value: (summaryData.reduce((s, r) => s + r.absentDays, 0) / summaryData.length).toFixed(1), color: 'error' },
                  { label: 'Total OT Hours', value: summaryData.reduce((s, r) => s + r.overtimeHours, 0).toFixed(1), color: 'info' },
                ].map((stat) => (
                  <Card key={stat.label} variant="outlined" sx={{ minWidth: 140 }}>
                    <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                      <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
                      <Typography variant="h6" fontWeight={700}>{stat.value}</Typography>
                    </CardContent>
                  </Card>
                ))}
              </Stack>

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Employee</TableCell>
                      <TableCell>Dept</TableCell>
                      <TableCell align="right">Total Days</TableCell>
                      <TableCell align="right">Present</TableCell>
                      <TableCell align="right">Absent</TableCell>
                      <TableCell align="right">Late</TableCell>
                      <TableCell align="right">Half Day</TableCell>
                      <TableCell align="right">Leave</TableCell>
                      <TableCell align="right">OT Hours</TableCell>
                      <TableCell align="right">Work Hours</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {summaryData.map((row) => (
                      <TableRow key={row.employeeId}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>{row.employeeName}</Typography>
                          <Typography variant="caption" color="text.secondary">{row.employeeCode}</Typography>
                        </TableCell>
                        <TableCell>{row.department ?? '—'}</TableCell>
                        <TableCell align="right">{row.totalDays}</TableCell>
                        <TableCell align="right" sx={{ color: 'success.main', fontWeight: 600 }}>{row.presentDays}</TableCell>
                        <TableCell align="right" sx={{ color: 'error.main' }}>{row.absentDays}</TableCell>
                        <TableCell align="right" sx={{ color: 'warning.main' }}>{row.lateDays}</TableCell>
                        <TableCell align="right">{row.halfDays}</TableCell>
                        <TableCell align="right">{row.leaveDays}</TableCell>
                        <TableCell align="right">{row.overtimeHours}</TableCell>
                        <TableCell align="right">{row.totalWorkHours}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}

          {sumEnabled && summaryData.length === 0 && !sumFetching && (
            <Typography color="text.secondary">No data for selected range.</Typography>
          )}
        </>
      )}

      {tab === 1 && (
        <>
          <Stack direction="row" spacing={2} mb={3} alignItems="center">
            <TextField select label="Month" value={gridFilters.month} onChange={(e) => { setGridEnabled(false); setGridFilters((p) => ({ ...p, month: parseInt(e.target.value) })); }} size="small" sx={{ width: 150 }}>
              {MONTHS.map((m, i) => <MenuItem key={i} value={i + 1}>{m}</MenuItem>)}
            </TextField>
            <TextField label="Year" value={gridFilters.year} onChange={(e) => { setGridEnabled(false); setGridFilters((p) => ({ ...p, year: parseInt(e.target.value) || now.getFullYear() })); }} size="small" type="number" inputProps={{ min: 2020, max: 2100 }} sx={{ width: 120 }} />
            <PrimaryButton startIcon={<SearchIcon />} onClick={() => setGridEnabled(true)} disabled={gridFetching}>
              {gridFetching ? 'Loading…' : 'Load Grid'}
            </PrimaryButton>
          </Stack>

          <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
            {Object.entries(STATUS_ABBR).map(([status, abbr]) => (
              <Chip key={status} label={`${abbr} = ${status.replace('_', ' ')}`} size="small" sx={{ bgcolor: STATUS_COLORS[status], color: '#fff', fontWeight: 700 }} />
            ))}
          </Stack>

          {gridEnabled && gridData && (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 900 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: 160, fontWeight: 700 }}>Employee</TableCell>
                    {gridData.days.map((d) => (
                      <TableCell key={d} align="center" sx={{ px: 0.5, minWidth: 28, fontSize: 11 }}>
                        {new Date(d + 'T00:00:00').getDate()}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {gridData.employees.map((emp) => (
                    <TableRow key={emp.employeeId}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{emp.employeeName}</Typography>
                        <Typography variant="caption" color="text.secondary">{emp.department ?? ''}</Typography>
                      </TableCell>
                      {emp.days.map((day) => (
                        <TableCell key={day.date} align="center" sx={{ px: 0.5, py: 0.5 }}>
                          {day.status ? (
                            <Box sx={{
                              width: 20, height: 20, borderRadius: '50%',
                              bgcolor: STATUS_COLORS[day.status] ?? '#e0e0e0',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              mx: 'auto', cursor: 'default',
                            }} title={day.status}>
                              <Typography sx={{ fontSize: 10, color: '#fff', fontWeight: 700, lineHeight: 1 }}>
                                {STATUS_ABBR[day.status] ?? '?'}
                              </Typography>
                            </Box>
                          ) : (
                            <Typography variant="caption" color="text.disabled">·</Typography>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}

          {gridEnabled && !gridData && !gridFetching && (
            <Typography color="text.secondary">No attendance data for selected month.</Typography>
          )}
        </>
      )}

      <Snackbar open={!!snack} autoHideDuration={3500} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="info" onClose={() => setSnack(null)} variant="filled">{snack}</Alert>
      </Snackbar>
    </Box>
  );
}
