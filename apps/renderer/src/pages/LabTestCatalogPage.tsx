import { useState } from 'react';
import {
  Alert, Box, Button, Chip, DialogActions, MenuItem,
  Snackbar, Stack, Switch, FormControlLabel, TextField, Typography,
} from '@mui/material';
import ScienceIcon from '@mui/icons-material/Science';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { LabTest } from '../api/types';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { AppModal } from '../components/AppModal';
import { PrimaryButton, SecondaryButton } from '../components/buttons';
import { useCurrency } from '../hooks/useCurrency';

const BLANK: Partial<LabTest> = {
  code: '', name: '', category: '', unit: '', normalRange: '', price: 0, turnaroundHrs: 24, notes: '',
};

export function LabTestCatalogPage() {
  const qc = useQueryClient();
  const cur = useCurrency();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<LabTest>>(BLANK);
  const [toast, setToast] = useState('');
  const [catFilter, setCatFilter] = useState('');

  const { data: tests = [], isLoading } = useQuery<LabTest[]>({
    queryKey: ['lab-tests'],
    queryFn: () => apiFetch('/api/v1/hospital/lab/tests'),
  });

  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ['lab-test-categories'],
    queryFn: () => apiFetch('/api/v1/hospital/lab/tests/categories'),
  });

  const save = useMutation({
    mutationFn: (body: typeof editing) =>
      editing.id
        ? apiFetch(`/api/v1/hospital/lab/tests/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : apiFetch('/api/v1/hospital/lab/tests', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lab-tests'] });
      qc.invalidateQueries({ queryKey: ['lab-test-categories'] });
      setOpen(false);
      setToast(editing.id ? 'Test updated.' : 'Test created.');
    },
    onError: (e: ApiError) => setToast(e.message ?? 'Error saving test.'),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiFetch(`/api/v1/hospital/lab/tests/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lab-tests'] }),
  });

  const visible = catFilter ? tests.filter(t => t.category === catFilter) : tests;

  const columns: DataTableColumn<LabTest>[] = [
    { key: 'code', label: 'Code', render: r => <strong>{r.code}</strong> },
    { key: 'name', label: 'Test Name', render: r => r.name },
    { key: 'category', label: 'Category', render: r => r.category ?? '—' },
    { key: 'unit', label: 'Unit', render: r => r.unit ?? '—' },
    { key: 'normalRange', label: 'Normal Range', render: r => r.normalRange ?? '—' },
    { key: 'price', label: 'Price', render: r => cur.fmt(r.price) },
    { key: 'turnaroundHrs', label: 'TAT (hrs)', render: r => String(r.turnaroundHrs) },
    {
      key: 'isActive', label: 'Active',
      render: r => (
        <Switch
          size="small"
          checked={r.isActive}
          onChange={e => toggleActive.mutate({ id: r.id, isActive: e.target.checked })}
        />
      ),
    },
    {
      key: 'actions', label: '',
      render: r => (
        <Button size="small" onClick={() => { setEditing(r); setOpen(true); }}>Edit</Button>
      ),
    },
  ];

  return (
    <Box p={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <ScienceIcon color="primary" />
          <Typography variant="h5" fontWeight={600}>Lab Test Catalog</Typography>
        </Stack>
        <Button variant="contained" onClick={() => { setEditing(BLANK); setOpen(true); }}>
          + New Test
        </Button>
      </Stack>

      <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
        <Chip
          label="All"
          variant={catFilter === '' ? 'filled' : 'outlined'}
          color="primary"
          onClick={() => setCatFilter('')}
        />
        {categories.map(c => (
          <Chip
            key={c}
            label={c}
            variant={catFilter === c ? 'filled' : 'outlined'}
            onClick={() => setCatFilter(c)}
          />
        ))}
      </Stack>

      <DataTable columns={columns} rows={visible} getRowId={r => r.id} />

      <AppModal
        open={open}
        onClose={() => setOpen(false)}
        title={editing.id ? 'Edit Lab Test' : 'New Lab Test'}
        maxWidth="sm"
      >
        <Stack spacing={2} mt={1}>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Test Code *"
              value={editing.code ?? ''}
              onChange={e => setEditing(p => ({ ...p, code: e.target.value.toUpperCase() }))}
              disabled={!!editing.id}
              sx={{ width: 140 }}
              inputProps={{ style: { textTransform: 'uppercase' } }}
            />
            <TextField
              fullWidth
              label="Test Name *"
              value={editing.name ?? ''}
              onChange={e => setEditing(p => ({ ...p, name: e.target.value }))}
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              fullWidth
              label="Category"
              value={editing.category ?? ''}
              onChange={e => setEditing(p => ({ ...p, category: e.target.value }))}
              placeholder="e.g. Haematology, Biochemistry"
            />
            <TextField
              fullWidth
              label="Unit"
              value={editing.unit ?? ''}
              onChange={e => setEditing(p => ({ ...p, unit: e.target.value }))}
              placeholder="e.g. mg/dL, cells/μL"
            />
          </Stack>
          <TextField
            label="Normal Range"
            value={editing.normalRange ?? ''}
            onChange={e => setEditing(p => ({ ...p, normalRange: e.target.value }))}
            placeholder="e.g. 70–100 mg/dL"
            fullWidth
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="Price *"
              type="number"
              value={editing.price ?? 0}
              onChange={e => setEditing(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))}
              sx={{ width: 150 }}
            />
            <TextField
              label="Turnaround (hrs)"
              type="number"
              value={editing.turnaroundHrs ?? 24}
              onChange={e => setEditing(p => ({ ...p, turnaroundHrs: parseInt(e.target.value) || 24 }))}
              sx={{ width: 160 }}
            />
          </Stack>
          <TextField
            label="Notes"
            value={editing.notes ?? ''}
            onChange={e => setEditing(p => ({ ...p, notes: e.target.value }))}
            multiline
            rows={2}
            fullWidth
          />
        </Stack>
        <DialogActions sx={{ mt: 2, px: 0 }}>
          <SecondaryButton onClick={() => setOpen(false)}>Cancel</SecondaryButton>
          <PrimaryButton onClick={() => save.mutate(editing)} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : (editing.id ? 'Update' : 'Create')}
          </PrimaryButton>
        </DialogActions>
      </AppModal>

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={/error|fail|already|forbidden|permission|denied|invalid|cannot/i.test(toast) ? 'error' : 'success'}
          onClose={() => setToast('')}
        >
          {toast}
        </Alert>
      </Snackbar>
    </Box>
  );
}
