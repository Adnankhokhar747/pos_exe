import {
  Alert, Box, Card, CardContent, Chip, Divider,
  Snackbar, Stack, Switch, TextField, Tooltip, Typography,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { RestaurantMenuSetting } from '../api/types';
import { PrimaryButton, SecondaryButton } from '../components/buttons';

export function RestaurantCategoriesPage(): JSX.Element {
  const qc = useQueryClient();
  const [snack, setSnack] = useState<{ msg: string; sev?: 'success' | 'error' } | null>(null);
  const [rows, setRows] = useState<RestaurantMenuSetting[]>([]);
  const [dirty, setDirty] = useState(false);

  const { data: settings = [], isFetching, refetch } = useQuery<RestaurantMenuSetting[]>({
    queryKey: ['restaurant-menu-settings'],
    queryFn:  () => apiFetch<RestaurantMenuSetting[]>('/api/v1/restaurant/menu-settings'),
  });

  useEffect(() => {
    if (settings.length) {
      setRows([...settings].sort((a, b) => a.sortOrder - b.sortOrder));
      setDirty(false);
    }
  }, [settings]);

  const saveMut = useMutation({
    mutationFn: () => apiFetch('/api/v1/restaurant/menu-settings', {
      method: 'PATCH',
      body: JSON.stringify({ settings: rows }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant-menu-settings'] });
      setDirty(false);
      setSnack({ msg: 'Menu settings saved.', sev: 'success' });
    },
    onError: (e) => setSnack({ msg: e instanceof ApiError ? e.detail : 'Failed.', sev: 'error' }),
  });

  function toggleVisible(categoryId: string) {
    setRows((prev) =>
      prev.map((r) => r.categoryId === categoryId ? { ...r, isVisible: !r.isVisible } : r)
    );
    setDirty(true);
  }

  function updateOrder(categoryId: string, value: string) {
    const n = parseInt(value);
    if (isNaN(n)) return;
    setRows((prev) =>
      prev.map((r) => r.categoryId === categoryId ? { ...r, sortOrder: n } : r)
          .sort((a, b) => a.sortOrder - b.sortOrder)
    );
    setDirty(true);
  }

  const visibleCount = rows.filter((r) => r.isVisible).length;

  return (
    <Box p={3} maxWidth={760} mx="auto">
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Typography variant="h6" fontWeight={700}>Restaurant Menu Categories</Typography>
          <Typography variant="body2" color="text.secondary">
            Control which product categories appear on the restaurant ordering screen and in what order.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Tooltip title="Discard changes">
            <span>
              <SecondaryButton size="small" startIcon={<RefreshIcon />} onClick={() => { refetch(); setDirty(false); }} disabled={isFetching}>
                Reset
              </SecondaryButton>
            </span>
          </Tooltip>
          <PrimaryButton
            startIcon={<SaveIcon />}
            onClick={() => saveMut.mutate()}
            disabled={!dirty || saveMut.isPending}
          >
            {saveMut.isPending ? 'Saving…' : 'Save Changes'}
          </PrimaryButton>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={2} mb={3}>
        <Chip label={`${visibleCount} visible`} color="success" size="small" />
        <Chip label={`${rows.length - visibleCount} hidden`} size="small" variant="outlined" />
        {dirty && <Chip label="Unsaved changes" color="warning" size="small" />}
      </Stack>

      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          {rows.map((row, idx) => (
            <Box key={row.categoryId}>
              {idx > 0 && <Divider />}
              <Stack
                direction="row"
                alignItems="center"
                spacing={2}
                px={2}
                py={1.5}
                sx={{
                  bgcolor: row.isVisible ? 'transparent' : 'action.disabledBackground',
                  opacity: row.isVisible ? 1 : 0.6,
                  transition: 'all .15s',
                }}
              >
                <DragIndicatorIcon sx={{ color: 'text.disabled', cursor: 'grab' }} />

                <Box flex={1}>
                  <Typography fontWeight={600}>{row.categoryName}</Typography>
                  {!row.isVisible && (
                    <Typography variant="caption" color="text.disabled">Hidden from restaurant menu</Typography>
                  )}
                </Box>

                <Tooltip title="Sort order (lower = appears first)">
                  <TextField
                    value={row.sortOrder}
                    onChange={(e) => updateOrder(row.categoryId, e.target.value)}
                    type="number"
                    inputProps={{ min: 0, style: { textAlign: 'center' } }}
                    size="small"
                    sx={{ width: 72 }}
                    label="Order"
                  />
                </Tooltip>

                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Typography variant="caption" color={row.isVisible ? 'success.main' : 'text.disabled'} fontWeight={600}>
                    {row.isVisible ? 'Visible' : 'Hidden'}
                  </Typography>
                  <Switch
                    checked={row.isVisible}
                    onChange={() => toggleVisible(row.categoryId)}
                    color="success"
                    size="small"
                  />
                </Stack>
              </Stack>
            </Box>
          ))}

          {rows.length === 0 && (
            <Box py={6} textAlign="center">
              <Typography color="text.secondary">No product categories found. Create categories in Catalog first.</Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      <Typography variant="caption" color="text.secondary" mt={2} display="block">
        Changes here only affect the restaurant ordering screen. Product categories in the main POS and catalog are not affected.
      </Typography>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack?.sev ?? 'info'} onClose={() => setSnack(null)} variant="filled">{snack?.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
