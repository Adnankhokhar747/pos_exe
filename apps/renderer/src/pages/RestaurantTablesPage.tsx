import { useState } from 'react';
import {
  Alert, Box, Card, CardActionArea, CardContent, Chip, DialogActions,
  Grid, MenuItem, Snackbar, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import TableRestaurantIcon from '@mui/icons-material/TableRestaurant';
import RefreshIcon from '@mui/icons-material/Refresh';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { RestaurantTable } from '../api/types';
import { AppModal } from '../components/AppModal';
import { PrimaryButton, SecondaryButton } from '../components/buttons';
import { useAuth } from '../state/auth-context';

type TableStatus = RestaurantTable['status'];

const STATUS_COLOR: Record<TableStatus, string> = {
  available: '#2e7d32',
  occupied:  '#e65100',
  reserved:  '#1565c0',
  cleaning:  '#616161',
};

const STATUS_LABEL: Record<TableStatus, string> = {
  available: 'Available',
  occupied:  'Occupied',
  reserved:  'Reserved',
  cleaning:  'Cleaning',
};

function elapsed(openedAt: string): string {
  const mins = Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function RestaurantTablesPage(): JSX.Element {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = user?.permissions?.includes('restaurant.table.manage') ||
                    user?.permissions?.includes('ALL');

  const [snack, setSnack]           = useState<{ msg: string; sev?: 'success' | 'error' | 'info' } | null>(null);
  const [addOpen, setAddOpen]       = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);

  // Add Table form state
  const [tableNumber, setTableNumber] = useState('');
  const [tableLabel, setTableLabel]   = useState('');
  const [capacity, setCapacity]       = useState('4');
  const [section, setSection]         = useState('');

  // Open Session form state
  const [covers, setCovers]         = useState('2');
  const [waiterName, setWaiterName] = useState('');

  const { data: tables = [], isFetching, refetch } = useQuery<RestaurantTable[]>({
    queryKey: ['restaurant-tables'],
    queryFn:  () => apiFetch<RestaurantTable[]>('/api/v1/restaurant/tables'),
    refetchInterval: 30_000,
  });

  const addTableMut = useMutation({
    mutationFn: () => apiFetch('/api/v1/restaurant/tables', {
      method: 'POST',
      body: JSON.stringify({ tableNumber, label: tableLabel || null, capacity: parseInt(capacity), section: section || null }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant-tables'] });
      setAddOpen(false);
      setTableNumber(''); setTableLabel(''); setCapacity('4'); setSection('');
      setSnack({ msg: 'Table added.', sev: 'success' });
    },
    onError: (e) => setSnack({ msg: e instanceof ApiError ? e.detail : 'Failed.', sev: 'error' }),
  });

  const openSessionMut = useMutation({
    mutationFn: (tableId: string) => apiFetch(`/api/v1/restaurant/tables/${tableId}/sessions`, {
      method: 'POST',
      body: JSON.stringify({ covers: parseInt(covers), waiterName: waiterName || null }),
    }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['restaurant-tables'] });
      setSessionOpen(false);
      setCovers('2'); setWaiterName('');
      navigate(`/restaurant/order/${data.id}`);
    },
    onError: (e) => setSnack({ msg: e instanceof ApiError ? e.detail : 'Failed.', sev: 'error' }),
  });

  const setStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/api/v1/restaurant/tables/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant-tables'] });
      setSnack({ msg: 'Status updated.', sev: 'success' });
    },
    onError: (e) => setSnack({ msg: e instanceof ApiError ? e.detail : 'Failed.', sev: 'error' }),
  });

  // Group tables by section
  const sections = [...new Set(tables.map((t) => t.section ?? 'Main'))].sort();

  function handleTableClick(table: RestaurantTable) {
    if (table.status === 'occupied' && table.activeSession) {
      navigate(`/restaurant/order/${table.activeSession.id}`);
    } else if (table.status === 'available') {
      setSelectedTable(table);
      setSessionOpen(true);
    } else {
      // reserved or cleaning — offer to mark available
      if (canManage) {
        setStatusMut.mutate({ id: table.id, status: 'available' });
      }
    }
  }

  return (
    <Box p={3}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h6" fontWeight={700}>Table Management</Typography>
          <Typography variant="body2" color="text.secondary">Click an available table to seat guests, or an occupied table to manage their order.</Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Tooltip title="Refresh">
            <span>
              <SecondaryButton size="small" onClick={() => refetch()} disabled={isFetching}>
                <RefreshIcon fontSize="small" />
              </SecondaryButton>
            </span>
          </Tooltip>
          {canManage && (
            <PrimaryButton startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
              Add Table
            </PrimaryButton>
          )}
        </Stack>
      </Stack>

      {/* Status legend */}
      <Stack direction="row" spacing={1.5} mb={3} flexWrap="wrap" useFlexGap>
        {(Object.keys(STATUS_COLOR) as TableStatus[]).map((s) => (
          <Chip
            key={s}
            label={STATUS_LABEL[s]}
            size="small"
            sx={{ bgcolor: STATUS_COLOR[s], color: '#fff', fontWeight: 600 }}
          />
        ))}
      </Stack>

      {/* Tables grouped by section */}
      {sections.map((sec) => {
        const sectionTables = tables.filter((t) => (t.section ?? 'Main') === sec);
        return (
          <Box key={sec} mb={4}>
            <Typography variant="subtitle2" color="text.secondary" fontWeight={700} mb={1.5} textTransform="uppercase" letterSpacing={1}>
              {sec}
            </Typography>
            <Grid container spacing={2}>
              {sectionTables.map((table) => {
                const session = table.activeSession;
                const bgColor = STATUS_COLOR[table.status];
                const itemCount = session?.order?.items?.length ?? 0;
                return (
                  <Grid item key={table.id} xs={6} sm={4} md={3} lg={2}>
                    <Card
                      variant="outlined"
                      sx={{
                        borderColor: bgColor,
                        borderWidth: 2,
                        borderRadius: 2,
                        transition: 'box-shadow .15s',
                        '&:hover': { boxShadow: `0 0 0 3px ${bgColor}44` },
                      }}
                    >
                      <CardActionArea onClick={() => handleTableClick(table)} sx={{ p: 0 }}>
                        <CardContent sx={{ pb: '8px !important' }}>
                          {/* Table number + status badge */}
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={0.5}>
                            <Typography variant="h5" fontWeight={800} color={bgColor} lineHeight={1}>
                              {table.tableNumber}
                            </Typography>
                            <Box
                              sx={{
                                bgcolor: bgColor,
                                color: '#fff',
                                borderRadius: '4px',
                                px: 0.75,
                                py: 0.25,
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                              }}
                            >
                              {STATUS_LABEL[table.status]}
                            </Box>
                          </Stack>

                          {table.label && (
                            <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                              {table.label}
                            </Typography>
                          )}

                          <Stack direction="row" spacing={1} alignItems="center">
                            <TableRestaurantIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                            <Typography variant="caption" color="text.secondary">{table.capacity} seats</Typography>
                          </Stack>

                          {session && (
                            <Box mt={1} pt={1} borderTop="1px solid" borderColor="divider">
                              <Typography variant="caption" display="block" color="text.secondary">
                                {session.covers} cover{session.covers !== 1 ? 's' : ''} • {elapsed(session.openedAt!)}
                              </Typography>
                              {session.waiterName && (
                                <Typography variant="caption" color="text.secondary">
                                  {session.waiterName}
                                </Typography>
                              )}
                              {itemCount > 0 && (
                                <Typography variant="caption" display="block" color={bgColor} fontWeight={600}>
                                  {itemCount} item{itemCount !== 1 ? 's' : ''} ordered
                                </Typography>
                              )}
                            </Box>
                          )}
                        </CardContent>
                      </CardActionArea>
                      {canManage && table.status !== 'available' && table.status !== 'occupied' && (
                        <Stack px={1} pb={1}>
                          <SecondaryButton
                            size="small"
                            startIcon={<LockOpenIcon sx={{ fontSize: 12 }} />}
                            onClick={(e) => { e.stopPropagation(); setStatusMut.mutate({ id: table.id, status: 'available' }); }}
                            sx={{ fontSize: '0.7rem', py: 0.25 }}
                          >
                            Mark Available
                          </SecondaryButton>
                        </Stack>
                      )}
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        );
      })}

      {tables.length === 0 && !isFetching && (
        <Box textAlign="center" py={8}>
          <TableRestaurantIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography color="text.secondary">No tables configured yet.</Typography>
          {canManage && <PrimaryButton sx={{ mt: 2 }} startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>Add First Table</PrimaryButton>}
        </Box>
      )}

      {/* Add Table Modal */}
      <AppModal open={addOpen} onClose={() => setAddOpen(false)} title="Add Table">
        <Stack spacing={2} pt={0.5}>
          <Stack direction="row" spacing={2}>
            <TextField label="Table Number" value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} size="small" required sx={{ flex: 1 }} autoFocus />
            <TextField label="Capacity" value={capacity} onChange={(e) => setCapacity(e.target.value)} type="number" inputProps={{ min: 1, max: 50 }} size="small" sx={{ width: 100 }} />
          </Stack>
          <TextField label="Friendly Name (optional)" value={tableLabel} onChange={(e) => setTableLabel(e.target.value)} size="small" placeholder='e.g. "Window Seat"' />
          <TextField label="Section (optional)" value={section} onChange={(e) => setSection(e.target.value)} size="small" placeholder='e.g. Indoor, Terrace, VIP' />
        </Stack>
        <DialogActions sx={{ mt: 1 }}>
          <SecondaryButton onClick={() => setAddOpen(false)}>Cancel</SecondaryButton>
          <PrimaryButton onClick={() => addTableMut.mutate()} disabled={!tableNumber || addTableMut.isPending}>
            {addTableMut.isPending ? 'Adding…' : 'Add Table'}
          </PrimaryButton>
        </DialogActions>
      </AppModal>

      {/* Open Session Modal */}
      <AppModal
        open={sessionOpen}
        onClose={() => setSessionOpen(false)}
        title={`Seat Guests — Table ${selectedTable?.tableNumber}`}
      >
        <Stack spacing={2} pt={0.5}>
          <Typography variant="body2" color="text.secondary">
            {selectedTable?.label ? `${selectedTable.label} · ` : ''}{selectedTable?.capacity} seats · {selectedTable?.section ?? 'Main'}
          </Typography>
          <TextField
            label="Number of Covers"
            value={covers}
            onChange={(e) => setCovers(e.target.value)}
            type="number"
            inputProps={{ min: 1, max: 50 }}
            size="small"
            fullWidth
            autoFocus
          />
          <TextField
            label="Waiter / Server name (optional)"
            value={waiterName}
            onChange={(e) => setWaiterName(e.target.value)}
            size="small"
            fullWidth
          />
        </Stack>
        <DialogActions sx={{ mt: 1 }}>
          <SecondaryButton onClick={() => setSessionOpen(false)}>Cancel</SecondaryButton>
          <PrimaryButton
            onClick={() => selectedTable && openSessionMut.mutate(selectedTable.id)}
            disabled={!covers || openSessionMut.isPending}
          >
            {openSessionMut.isPending ? 'Seating…' : 'Seat & Open Tab'}
          </PrimaryButton>
        </DialogActions>
      </AppModal>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack?.sev ?? 'info'} onClose={() => setSnack(null)} variant="filled">{snack?.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
