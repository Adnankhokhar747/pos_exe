import { useState } from 'react';
import {
  Alert, Box, Card, CardContent, Chip, Divider,
  Grid, Snackbar, Stack, Typography,
} from '@mui/material';
import AccessAlarmIcon from '@mui/icons-material/AccessAlarm';
import KitchenIcon from '@mui/icons-material/Kitchen';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { RestaurantKdsTicket } from '../api/types';
import { PrimaryButton, SecondaryButton } from '../components/buttons';

type TicketStatus = RestaurantKdsTicket['status'];

const STATUS_LABEL: Record<TicketStatus, string> = {
  pending:   'New Order',
  preparing: 'In Progress',
  ready:     'Ready',
  done:      'Done',
};

const NEXT_STATUS: Partial<Record<TicketStatus, TicketStatus>> = {
  pending:   'preparing',
  preparing: 'ready',
  ready:     'done',
};

const NEXT_LABEL: Partial<Record<TicketStatus, string>> = {
  pending:   'Start Preparing',
  preparing: 'Mark Ready',
  ready:     'Mark Served',
};

const COL_STATUS: TicketStatus[] = ['pending', 'preparing', 'ready'];

function ageColor(sentAt: string): string {
  const mins = Math.floor((Date.now() - new Date(sentAt).getTime()) / 60000);
  if (mins < 8)  return 'success.main';
  if (mins < 15) return 'warning.main';
  return 'error.main';
}

function elapsedLabel(sentAt: string): string {
  const secs = Math.floor((Date.now() - new Date(sentAt).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function RestaurantKdsPage(): JSX.Element {
  const qc = useQueryClient();
  const [snack, setSnack] = useState<{ msg: string; sev?: 'success' | 'error' } | null>(null);

  const { data: tickets = [], isFetching, refetch } = useQuery<RestaurantKdsTicket[]>({
    queryKey: ['restaurant-kds'],
    queryFn:  () => apiFetch<RestaurantKdsTicket[]>('/api/v1/restaurant/kds'),
    refetchInterval: 15_000,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TicketStatus }) =>
      apiFetch(`/api/v1/restaurant/kds/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant-kds'] });
    },
    onError: (e) => setSnack({ msg: e instanceof ApiError ? e.detail : 'Failed.', sev: 'error' }),
  });

  const byStatus = (col: TicketStatus) => tickets.filter((t) => t.status === col);

  return (
    <Box p={2} sx={{ bgcolor: '#111', minHeight: '100vh' }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <KitchenIcon sx={{ color: '#fff', fontSize: 28 }} />
          <Typography variant="h6" fontWeight={800} color="#fff">Kitchen Display</Typography>
          {isFetching && <Typography variant="caption" color="grey.500">Refreshing…</Typography>}
        </Stack>
        <SecondaryButton
          size="small"
          startIcon={<RefreshIcon />}
          onClick={() => refetch()}
          sx={{ color: '#fff', borderColor: '#fff44' }}
        >
          Refresh
        </SecondaryButton>
      </Stack>

      {/* 3-column KDS board */}
      <Grid container spacing={2}>
        {COL_STATUS.map((col) => {
          const colTickets = byStatus(col);
          const colColors: Record<TicketStatus, string> = {
            pending:   '#e65100',
            preparing: '#1565c0',
            ready:     '#2e7d32',
            done:      '#424242',
          };
          return (
            <Grid item key={col} xs={12} md={4}>
              {/* Column header */}
              <Box
                sx={{
                  bgcolor: colColors[col],
                  borderRadius: '8px 8px 0 0',
                  px: 2,
                  py: 1,
                  mb: 0.5,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Typography fontWeight={800} color="#fff" fontSize="1rem" textTransform="uppercase" letterSpacing={1}>
                  {STATUS_LABEL[col]}
                </Typography>
                <Chip
                  label={colTickets.length}
                  size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: '#fff', fontWeight: 700, minWidth: 28 }}
                />
              </Box>

              {/* Tickets */}
              <Stack spacing={1.5}>
                {colTickets.length === 0 && (
                  <Box
                    sx={{
                      border: '2px dashed #333',
                      borderRadius: 2,
                      py: 5,
                      textAlign: 'center',
                    }}
                  >
                    <CheckCircleIcon sx={{ color: '#333', fontSize: 32 }} />
                    <Typography color="grey.700" variant="body2" mt={0.5}>Clear</Typography>
                  </Box>
                )}
                {colTickets.map((ticket) => {
                  const nextStatus = NEXT_STATUS[ticket.status];
                  return (
                    <Card
                      key={ticket.id}
                      sx={{
                        bgcolor: '#1a1a1a',
                        border: '1px solid #333',
                        borderRadius: 2,
                        borderTop: `3px solid ${colColors[col]}`,
                      }}
                    >
                      <CardContent sx={{ pb: '12px !important' }}>
                        {/* Ticket header */}
                        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography fontWeight={800} fontSize="1.1rem" color="#fff">
                              Table {ticket.tableNumber}
                            </Typography>
                            {ticket.tableLabel && (
                              <Typography variant="caption" color="grey.500">{ticket.tableLabel}</Typography>
                            )}
                          </Stack>
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <AccessAlarmIcon sx={{ fontSize: 14, color: ageColor(ticket.sentAt) }} />
                            <Typography variant="caption" color={ageColor(ticket.sentAt)} fontWeight={700}>
                              {elapsedLabel(ticket.sentAt)}
                            </Typography>
                          </Stack>
                        </Stack>

                        {ticket.covers && (
                          <Typography variant="caption" color="grey.600" display="block" mb={1}>
                            {ticket.covers} cover{ticket.covers !== 1 ? 's' : ''}
                          </Typography>
                        )}

                        <Divider sx={{ borderColor: '#333', mb: 1 }} />

                        {/* Items */}
                        <Stack spacing={0.5} mb={1.5}>
                          {(ticket.items ?? []).map((item) => (
                            <Stack key={item.id} direction="row" justifyContent="space-between" alignItems="flex-start">
                              <Box>
                                <Typography color="#fff" variant="body2" fontWeight={600}>
                                  {item.quantity > 1 ? `${item.quantity}× ` : ''}{item.productName}
                                </Typography>
                                {item.notes && (
                                  <Typography variant="caption" color="warning.main">
                                    ⚠ {item.notes}
                                  </Typography>
                                )}
                              </Box>
                              <Chip
                                label={item.kdsStatus}
                                size="small"
                                sx={{
                                  fontSize: '0.65rem',
                                  height: 18,
                                  bgcolor: item.kdsStatus === 'ready' ? '#2e7d32' : '#333',
                                  color: '#fff',
                                }}
                              />
                            </Stack>
                          ))}
                        </Stack>

                        {nextStatus && (
                          <PrimaryButton
                            fullWidth
                            size="small"
                            onClick={() => updateMut.mutate({ id: ticket.id, status: nextStatus })}
                            disabled={updateMut.isPending}
                            sx={{
                              bgcolor: colColors[nextStatus],
                              '&:hover': { bgcolor: colColors[nextStatus], opacity: 0.9 },
                            }}
                          >
                            {NEXT_LABEL[ticket.status]}
                          </PrimaryButton>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            </Grid>
          );
        })}
      </Grid>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}>
        <Alert severity={snack?.sev ?? 'info'} onClose={() => setSnack(null)} variant="filled">{snack?.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
