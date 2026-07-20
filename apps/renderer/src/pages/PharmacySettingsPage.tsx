import {
  Alert, Box, Stack, Switch, Typography,
} from '@mui/material';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { DataTable, type DataTableColumn } from '../components/DataTable';

interface PharmacyCategory {
  id: string;
  name: string;
  isPharmacy: boolean;
}

export function PharmacySettingsPage() {
  const qc = useQueryClient();

  const { data: categories = [], isError } = useQuery<PharmacyCategory[]>({
    queryKey: ['pharmacy-categories'],
    queryFn: () => apiFetch('/api/v1/hospital/pharmacy/categories'),
    retry: false,
  });

  const toggle = useMutation({
    mutationFn: ({ id, isPharmacy }: { id: string; isPharmacy: boolean }) =>
      apiFetch(`/api/v1/hospital/pharmacy/categories/${id}/pharmacy`, {
        method: 'PATCH',
        body: { isPharmacy },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pharmacy-categories'] }),
  });

  const columns: DataTableColumn<PharmacyCategory>[] = [
    { key: 'name', label: 'Category Name', render: r => r.name },
    {
      key: 'isPharmacy',
      label: 'Show in Pharmacy POS',
      render: r => (
        <Switch
          checked={r.isPharmacy ?? false}
          onChange={e => toggle.mutate({ id: r.id, isPharmacy: e.target.checked })}
        />
      ),
    },
  ];

  return (
    <Box p={3}>
      <Stack direction="row" alignItems="center" spacing={1} mb={1}>
        <LocalPharmacyIcon color="primary" />
        <Typography variant="h5" fontWeight={600}>Pharmacy Settings</Typography>
      </Stack>
      <Alert severity="info" sx={{ mb: 2 }}>
        Toggle which product categories appear in the Pharmacy POS. Only products in &quot;pharmacy&quot;
        categories will be visible when billing patients from the pharmacy counter.
      </Alert>
      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Could not load categories. Make sure the lab/pharmacy database migration has been run in phpMyAdmin.
        </Alert>
      )}
      <DataTable columns={columns} rows={categories} getRowId={r => r.id} />
    </Box>
  );
}
