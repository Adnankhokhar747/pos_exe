import { useState } from 'react';
import { Box, Card, Snackbar, Stack, Tab, Table, TableBody, TableCell, TableRow, Tabs, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { DailyClosing, Expense, ExpenseCategory, IncomeEntry, ProfitSummary } from '../api/types';
import { DataTable } from '../components/DataTable';
import { PrimaryButton, SecondaryButton } from '../components/buttons';
import { useAuth } from '../state/auth-context';

function defaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AccountingPage(): JSX.Element {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const ACTIVE_BRANCH_ID = user!.branchId;
  const [tab, setTab] = useState(0);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  // --- Expense categories ---
  const [categoryName, setCategoryName] = useState('');
  const categoriesQuery = useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => apiFetch<ExpenseCategory[]>('/api/v1/expense-categories'),
  });
  const createCategoryMutation = useMutation({
    mutationFn: () => apiFetch('/api/v1/expense-categories', { method: 'POST', body: JSON.stringify({ name: categoryName }) }),
    onSuccess: () => {
      setCategoryName('');
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not create category.'),
  });

  // --- Expenses ---
  const [expenseCategoryId, setExpenseCategoryId] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNote, setExpenseNote] = useState('');
  const expensesQuery = useQuery({
    queryKey: ['expenses'],
    queryFn: () => apiFetch<Expense[]>(`/api/v1/expenses?branchId=${ACTIVE_BRANCH_ID}`),
  });
  const createExpenseMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/expenses', {
        method: 'POST',
        body: JSON.stringify({ branchId: ACTIVE_BRANCH_ID, categoryId: expenseCategoryId, amount: expenseAmount, note: expenseNote || undefined }),
      }),
    onSuccess: () => {
      setSnackbar('Expense recorded.');
      setExpenseAmount('');
      setExpenseNote('');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not record expense.'),
  });

  // --- Income ---
  const [incomeCategory, setIncomeCategory] = useState('');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeNote, setIncomeNote] = useState('');
  const incomeQuery = useQuery({
    queryKey: ['income-entries'],
    queryFn: () => apiFetch<IncomeEntry[]>(`/api/v1/income-entries?branchId=${ACTIVE_BRANCH_ID}`),
  });
  const createIncomeMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/income-entries', {
        method: 'POST',
        body: JSON.stringify({ branchId: ACTIVE_BRANCH_ID, category: incomeCategory, amount: incomeAmount, note: incomeNote || undefined }),
      }),
    onSuccess: () => {
      setSnackbar('Income recorded.');
      setIncomeCategory('');
      setIncomeAmount('');
      setIncomeNote('');
      queryClient.invalidateQueries({ queryKey: ['income-entries'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not record income.'),
  });

  // --- Daily closings ---
  const [businessDate, setBusinessDate] = useState(today());
  const [countedCash, setCountedCash] = useState('');
  const closingsQuery = useQuery({
    queryKey: ['daily-closings'],
    queryFn: () => apiFetch<DailyClosing[]>(`/api/v1/daily-closings?branchId=${ACTIVE_BRANCH_ID}`),
  });
  const createClosingMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/daily-closings', {
        method: 'POST',
        body: JSON.stringify({ branchId: ACTIVE_BRANCH_ID, businessDate, countedCash }),
      }),
    onSuccess: () => {
      setSnackbar('Daily closing recorded.');
      setCountedCash('');
      queryClient.invalidateQueries({ queryKey: ['daily-closings'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not record closing.'),
  });

  // --- Profit summary ---
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(defaultTo());
  const profitQuery = useQuery({
    queryKey: ['profit-summary', from, to],
    queryFn: () => apiFetch<ProfitSummary>(`/api/v1/reports/profit-summary?branchId=${ACTIVE_BRANCH_ID}&from=${from}&to=${to}`),
    enabled: tab === 3,
  });

  return (
    <Box p={2} height="100%" overflow="auto">
      <Typography variant="h6" gutterBottom>
        Accounting
      </Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Expenses" />
        <Tab label="Income" />
        <Tab label="Daily Closing" />
        <Tab label="Profit & Loss" />
      </Tabs>

      {tab === 0 && (
        <Box>
          <Stack direction="row" spacing={1} mb={2} maxWidth={500}>
            <TextField label="New category name" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} />
            <SecondaryButton disabled={!categoryName || createCategoryMutation.isPending} onClick={() => createCategoryMutation.mutate()}>
              Add Category
            </SecondaryButton>
          </Stack>
          <Stack direction="row" spacing={1} mb={1}>
            {(categoriesQuery.data ?? []).map((c) => (
              <SecondaryButton
                key={c.id}
                variant={expenseCategoryId === c.id ? 'contained' : 'outlined'}
                onClick={() => setExpenseCategoryId(c.id)}
              >
                {c.name}
              </SecondaryButton>
            ))}
          </Stack>
          <Stack direction="row" spacing={1} mb={3} maxWidth={600}>
            <TextField label="Amount" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} />
            <TextField label="Note" value={expenseNote} onChange={(e) => setExpenseNote(e.target.value)} />
            <PrimaryButton
              disabled={!expenseCategoryId || !expenseAmount || createExpenseMutation.isPending}
              onClick={() => createExpenseMutation.mutate()}
            >
              Record Expense
            </PrimaryButton>
          </Stack>
          <DataTable
            searchPlaceholder="Search expenses…"
            emptyMessage="No expenses recorded yet."
            getRowId={(e: Expense) => e.id}
            rows={expensesQuery.data ?? []}
            getSearchText={(e) => e.note ?? ''}
            columns={[
              {
                key: 'occurredAt',
                label: 'Date',
                sortable: true,
                sortValue: (e) => new Date(e.occurredAt).getTime(),
                render: (e) => new Date(e.occurredAt).toLocaleString(),
              },
              { key: 'note', label: 'Note', render: (e) => e.note ?? '—' },
              {
                key: 'amount',
                label: 'Amount',
                align: 'right',
                sortable: true,
                sortValue: (e) => Number(e.amount),
                render: (e) => `$${Number(e.amount).toFixed(2)}`,
              },
            ]}
          />
        </Box>
      )}

      {tab === 1 && (
        <Box>
          <Stack direction="row" spacing={1} mb={3} maxWidth={600}>
            <TextField label="Category" value={incomeCategory} onChange={(e) => setIncomeCategory(e.target.value)} />
            <TextField label="Amount" value={incomeAmount} onChange={(e) => setIncomeAmount(e.target.value)} />
            <TextField label="Note" value={incomeNote} onChange={(e) => setIncomeNote(e.target.value)} />
            <PrimaryButton
              disabled={!incomeCategory || !incomeAmount || createIncomeMutation.isPending}
              onClick={() => createIncomeMutation.mutate()}
            >
              Record Income
            </PrimaryButton>
          </Stack>
          <DataTable
            searchPlaceholder="Search income…"
            emptyMessage="No income recorded yet."
            getRowId={(i: IncomeEntry) => i.id}
            rows={incomeQuery.data ?? []}
            getSearchText={(i) => i.category}
            columns={[
              {
                key: 'occurredAt',
                label: 'Date',
                sortable: true,
                sortValue: (i) => new Date(i.occurredAt).getTime(),
                render: (i) => new Date(i.occurredAt).toLocaleString(),
              },
              { key: 'category', label: 'Category', sortable: true, render: (i) => i.category },
              {
                key: 'amount',
                label: 'Amount',
                align: 'right',
                sortable: true,
                sortValue: (i) => Number(i.amount),
                render: (i) => `$${Number(i.amount).toFixed(2)}`,
              },
            ]}
          />
        </Box>
      )}

      {tab === 2 && (
        <Box>
          <Stack direction="row" spacing={1} mb={3} maxWidth={600}>
            <TextField
              label="Business Date"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={businessDate}
              onChange={(e) => setBusinessDate(e.target.value)}
            />
            <TextField label="Counted Cash" value={countedCash} onChange={(e) => setCountedCash(e.target.value)} />
            <PrimaryButton disabled={!countedCash || createClosingMutation.isPending} onClick={() => createClosingMutation.mutate()}>
              Record Closing
            </PrimaryButton>
          </Stack>
          <DataTable
            hideSearch
            emptyMessage="No daily closings recorded yet."
            getRowId={(c: DailyClosing) => c.id}
            rows={closingsQuery.data ?? []}
            columns={[
              {
                key: 'businessDate',
                label: 'Date',
                sortable: true,
                sortValue: (c) => new Date(c.businessDate).getTime(),
                render: (c) => c.businessDate.slice(0, 10),
              },
              {
                key: 'expectedCash',
                label: 'Expected Cash',
                align: 'right',
                sortable: true,
                sortValue: (c) => Number(c.expectedCash),
                render: (c) => `$${Number(c.expectedCash).toFixed(2)}`,
              },
              {
                key: 'countedCash',
                label: 'Counted Cash',
                align: 'right',
                sortable: true,
                sortValue: (c) => Number(c.countedCash),
                render: (c) => `$${Number(c.countedCash).toFixed(2)}`,
              },
              {
                key: 'variance',
                label: 'Variance',
                align: 'right',
                sortable: true,
                sortValue: (c) => Number(c.variance),
                render: (c) => (
                  <Box component="span" sx={{ color: Number(c.variance) !== 0 ? 'error.main' : 'success.main', fontWeight: 600 }}>
                    ${Number(c.variance).toFixed(2)}
                  </Box>
                ),
              },
            ]}
          />
        </Box>
      )}

      {tab === 3 && (
        <Box>
          <Stack direction="row" spacing={2} mb={2} maxWidth={500}>
            <TextField
              label="From"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <TextField
              label="To"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </Stack>
          {profitQuery.data && (
            <Card variant="outlined" sx={{ maxWidth: 420 }}>
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell>Revenue</TableCell>
                  <TableCell align="right">${Number(profitQuery.data.revenue).toFixed(2)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>COGS</TableCell>
                  <TableCell align="right">${Number(profitQuery.data.cogs).toFixed(2)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>Gross Profit</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>${Number(profitQuery.data.grossProfit).toFixed(2)}</strong>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Other Income</TableCell>
                  <TableCell align="right">${Number(profitQuery.data.otherIncome).toFixed(2)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Expenses</TableCell>
                  <TableCell align="right">${Number(profitQuery.data.expenses).toFixed(2)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>Net Profit</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>${Number(profitQuery.data.netProfit).toFixed(2)}</strong>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            </Card>
          )}
        </Box>
      )}

      <Snackbar open={Boolean(snackbar)} autoHideDuration={3000} onClose={() => setSnackbar(null)} message={snackbar} />
    </Box>
  );
}
