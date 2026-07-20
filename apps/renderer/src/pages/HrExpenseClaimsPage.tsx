import React, { useState } from 'react';
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControl, IconButton, InputLabel, MenuItem, Select, Stack,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography, Paper,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { HrExpenseClaim, HrExpenseClaimStatus, HrEmployee } from '../api/types';
import { useCurrency } from '../hooks/useCurrency';

const STATUS_COLOR: Record<HrExpenseClaimStatus, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  draft:     'default',
  submitted: 'info',
  approved:  'success',
  rejected:  'error',
  paid:      'success',
};

const EXPENSE_CATEGORIES = ['Travel', 'Meals', 'Accommodation', 'Communication', 'Medical', 'Stationery', 'Other'];

interface ClaimItemForm {
  expenseDate: string;
  category: string;
  description: string;
  amount: string;
  receiptRef: string;
}

function NewClaimDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const cur = useCurrency();
  const now = new Date();

  const { data: employees = [] } = useQuery<HrEmployee[]>({
    queryKey: ['hr-employees'],
    queryFn: () => apiFetch<HrEmployee[]>('/api/v1/hr/employees'),
    enabled: open,
  });

  const [empId, setEmpId]   = useState('');
  const [month, setMonth]   = useState(now.getMonth() + 1);
  const [year, setYear]     = useState(now.getFullYear());
  const [desc, setDesc]     = useState('');
  const [items, setItems]   = useState<ClaimItemForm[]>([
    { expenseDate: '', category: 'Travel', description: '', amount: '', receiptRef: '' },
  ]);

  const total = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

  const addItem = () => setItems(p => [...p, { expenseDate: '', category: 'Travel', description: '', amount: '', receiptRef: '' }]);
  const removeItem = (idx: number) => setItems(p => p.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof ClaimItemForm, val: string) =>
    setItems(p => p.map((it, i) => i === idx ? { ...it, [field]: val } : it));

  const mut = useMutation({
    mutationFn: () => apiFetch('/api/v1/hr/expense-claims', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: empId,
        periodMonth: month,
        periodYear: year,
        description: desc,
        items: items.map(it => ({ ...it, amount: parseFloat(it.amount) })),
      }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr-expense-claims'] }); onClose(); },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>New Expense Claim</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Stack direction="row" gap={2}>
            <FormControl fullWidth>
              <InputLabel>Employee</InputLabel>
              <Select value={empId} label="Employee" onChange={e => setEmpId(e.target.value)}>
                {employees.map(e => (
                  <MenuItem key={e.id} value={e.id}>{e.name} ({e.employeeCode})</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl sx={{ width: 140 }}>
              <InputLabel>Month</InputLabel>
              <Select value={month} label="Month" onChange={e => setMonth(+e.target.value)}>
                {Array.from({ length: 12 }, (_, i) => (
                  <MenuItem key={i + 1} value={i + 1}>
                    {new Date(2000, i).toLocaleString('default', { month: 'short' })}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label="Year" type="number" sx={{ width: 100 }} value={year}
              onChange={e => setYear(+e.target.value)} />
          </Stack>
          <TextField label="Claim Description" value={desc} onChange={e => setDesc(e.target.value)} />

          <Typography variant="subtitle2">Expense Items</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Receipt Ref</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((it, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <TextField type="date" size="small" InputLabelProps={{ shrink: true }}
                      value={it.expenseDate} onChange={e => updateItem(idx, 'expenseDate', e.target.value)} />
                  </TableCell>
                  <TableCell>
                    <Select size="small" value={it.category} onChange={e => updateItem(idx, 'category', e.target.value)}>
                      {EXPENSE_CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </Select>
                  </TableCell>
                  <TableCell>
                    <TextField size="small" value={it.description}
                      onChange={e => updateItem(idx, 'description', e.target.value)} />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" type="number" value={it.amount}
                      onChange={e => updateItem(idx, 'amount', e.target.value)} sx={{ width: 100 }} />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" value={it.receiptRef}
                      onChange={e => updateItem(idx, 'receiptRef', e.target.value)} />
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" disabled={items.length === 1} onClick={() => removeItem(idx)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Button size="small" startIcon={<AddIcon />} onClick={addItem}>Add Line</Button>
            <Typography variant="subtitle2">Total: {cur.fmt(total)}</Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="outlined" disabled={!empId || mut.isPending} onClick={() => mut.mutate()}>
          Save as Draft
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ClaimDetailDialog({ claim, onClose }: { claim: HrExpenseClaim; onClose: () => void }) {
  const qc = useQueryClient();
  const cur = useCurrency();

  const approve = useMutation({
    mutationFn: () => apiFetch(`/api/v1/hr/expense-claims/${claim.id}/approve`, { method: 'PATCH' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr-expense-claims'] }); onClose(); },
  });
  const reject = useMutation({
    mutationFn: () => apiFetch(`/api/v1/hr/expense-claims/${claim.id}/reject`, { method: 'PATCH', body: JSON.stringify({ reason: 'Rejected by manager' }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr-expense-claims'] }); onClose(); },
  });
  const submit = useMutation({
    mutationFn: () => apiFetch(`/api/v1/hr/expense-claims/${claim.id}/submit`, { method: 'PATCH' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr-expense-claims'] }); onClose(); },
  });

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>Expense Claim — {claim.employee?.name ?? claim.employeeId}</Box>
          <Chip label={claim.status} size="small" color={STATUS_COLOR[claim.status]} />
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Typography variant="caption" color="text.secondary">
          Period: {new Date(claim.periodYear, claim.periodMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
          {claim.description && ` · ${claim.description}`}
        </Typography>
        <Table size="small" sx={{ mt: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Receipt</TableCell>
              <TableCell align="right">Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(claim.items ?? []).map(it => (
              <TableRow key={it.id}>
                <TableCell>{it.expenseDate}</TableCell>
                <TableCell>{it.category}</TableCell>
                <TableCell>{it.description ?? '—'}</TableCell>
                <TableCell>{it.receiptRef ?? '—'}</TableCell>
                <TableCell align="right">{cur.fmt(it.amount)}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={4} align="right"><strong>Total</strong></TableCell>
              <TableCell align="right"><strong>{cur.fmt(claim.totalAmount)}</strong></TableCell>
            </TableRow>
          </TableBody>
        </Table>
        {claim.rejectionReason && (
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>Rejected: {claim.rejectionReason}</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {claim.status === 'draft' && (
          <Button variant="outlined" disabled={submit.isPending} onClick={() => submit.mutate()}>
            Submit for Approval
          </Button>
        )}
        {claim.status === 'submitted' && (
          <>
            <Button startIcon={<CancelIcon />} color="error" disabled={reject.isPending}
              onClick={() => reject.mutate()}>Reject</Button>
            <Button startIcon={<CheckCircleIcon />} variant="contained" color="success"
              disabled={approve.isPending} onClick={() => approve.mutate()}>Approve</Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default function HrExpenseClaimsPage() {
  const cur = useCurrency();
  const [newOpen, setNewOpen] = useState(false);
  const [selected, setSelected] = useState<HrExpenseClaim | null>(null);
  const [filterStatus, setFilterStatus] = useState<HrExpenseClaimStatus | ''>('');

  const { data: claims = [] } = useQuery<HrExpenseClaim[]>({
    queryKey: ['hr-expense-claims', filterStatus],
    queryFn: () => {
      const params = filterStatus ? `?status=${filterStatus}` : '';
      return apiFetch<HrExpenseClaim[]>(`/api/v1/hr/expense-claims${params}`);
    },
  });

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">Expense Claims</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setNewOpen(true)}>
          New Claim
        </Button>
      </Stack>

      <Stack direction="row" gap={1} mb={2} flexWrap="wrap">
        {(['', 'draft', 'submitted', 'approved', 'rejected', 'paid'] as const).map(s => (
          <Chip key={s || 'all'} label={s || 'All'} onClick={() => setFilterStatus(s as any)}
            variant={filterStatus === s ? 'filled' : 'outlined'}
            color={s ? STATUS_COLOR[s as HrExpenseClaimStatus] : 'default'} />
        ))}
      </Stack>

      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Employee</TableCell>
              <TableCell>Period</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {claims.map(c => (
              <TableRow key={c.id} hover onClick={() => setSelected(c)} sx={{ cursor: 'pointer' }}>
                <TableCell>{c.employee?.name ?? c.employeeId}</TableCell>
                <TableCell>
                  {new Date(c.periodYear, c.periodMonth - 1).toLocaleString('default', { month: 'short', year: 'numeric' })}
                </TableCell>
                <TableCell>{c.description ?? '—'}</TableCell>
                <TableCell align="right">{cur.fmt(c.totalAmount)}</TableCell>
                <TableCell>
                  <Chip label={c.status} size="small" color={STATUS_COLOR[c.status]} />
                </TableCell>
              </TableRow>
            ))}
            {claims.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No expense claims found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {newOpen && <NewClaimDialog open onClose={() => setNewOpen(false)} />}
      {selected && <ClaimDetailDialog claim={selected} onClose={() => setSelected(null)} />}
    </Box>
  );
}
