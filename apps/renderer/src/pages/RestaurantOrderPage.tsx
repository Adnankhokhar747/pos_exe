import { useState, useMemo } from 'react';
import {
  Alert, Box, Card, CardActionArea, CardContent, Chip, DialogActions,
  Divider, Grid, IconButton, Paper, Snackbar, Stack,
  Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Tooltip, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SearchIcon from '@mui/icons-material/Search';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type {
  RestaurantTableSession,
  RestaurantOrderItem,
  RestaurantMenuSetting,
  ProductWithStock,
  Category,
  RestaurantSplitBill,
} from '../api/types';
import { AppModal } from '../components/AppModal';
import { PrimaryButton, SecondaryButton } from '../components/buttons';
import { useCurrency } from '../hooks/useCurrency';

const KDS_STATUS_COLOR: Record<string, string> = {
  pending:   'default',
  preparing: 'info',
  ready:     'success',
  served:    'success',
  cancelled: 'error',
};

export function RestaurantOrderPage(): JSX.Element {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const cur = useCurrency();

  const [snack, setSnack] = useState<{ msg: string; sev?: 'success' | 'error' | 'info' } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [closeOpen, setCloseOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitCount, setSplitCount] = useState('2');
  const [editingItem, setEditingItem] = useState<{ id: string; notes: string } | null>(null);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: session, isLoading: sessionLoading } = useQuery<RestaurantTableSession>({
    queryKey: ['restaurant-session', sessionId],
    queryFn:  () => apiFetch<RestaurantTableSession>(`/api/v1/restaurant/sessions/${sessionId}`),
    refetchInterval: 20_000,
    enabled: !!sessionId,
  });

  const { data: menuSettings = [] } = useQuery<RestaurantMenuSetting[]>({
    queryKey: ['restaurant-menu-settings'],
    queryFn:  () => apiFetch<RestaurantMenuSetting[]>('/api/v1/restaurant/menu-settings'),
    staleTime: 5 * 60 * 1000,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn:  () => apiFetch<Category[]>('/api/v1/categories'),
    staleTime: 5 * 60 * 1000,
  });

  const { data: products = [] } = useQuery<ProductWithStock[]>({
    queryKey: ['products', selectedCategory],
    queryFn:  () => {
      const params = new URLSearchParams({ limit: '200' });
      if (selectedCategory) params.set('categoryId', selectedCategory);
      return apiFetch<ProductWithStock[]>(`/api/v1/products?${params}`);
    },
    staleTime: 2 * 60 * 1000,
  });

  // ── Derived data ──────────────────────────────────────────────────────────
  const visibleCategories = useMemo(() => {
    const settingsMap = new Map(menuSettings.map((s) => [s.categoryId, s]));
    return categories
      .filter((c) => {
        const setting = settingsMap.get(c.id);
        return setting ? setting.isVisible : true;
      })
      .sort((a, b) => {
        const sa = settingsMap.get(a.id)?.sortOrder ?? 0;
        const sb = settingsMap.get(b.id)?.sortOrder ?? 0;
        return sa - sb;
      });
  }, [categories, menuSettings]);

  const filteredProducts = useMemo(() => {
    let list = products.filter((p) => (p as any).isActive !== false);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [products, search]);

  const order = session?.order ?? null;
  const items: RestaurantOrderItem[] = order?.items ?? [];
  const unsentItems = items.filter((i) => !i.kdsTicketId && i.kdsStatus !== 'cancelled');
  const total = items.reduce((s, i) => s + (i.kdsStatus === 'cancelled' ? 0 : i.subtotal), 0);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const addItemMut = useMutation({
    mutationFn: (product: ProductWithStock) =>
      apiFetch(`/api/v1/restaurant/orders/${order!.id}/items`, {
        method: 'POST',
        body: JSON.stringify({
          productId:   product.id,
          productName: product.name,
          quantity:    1,
          unitPrice:   parseFloat(product.salePrice) || 0,
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['restaurant-session', sessionId] }),
    onError: (e) => setSnack({ msg: e instanceof ApiError ? e.detail : 'Failed to add item.', sev: 'error' }),
  });

  const updateItemMut = useMutation({
    mutationFn: ({ id, quantity, notes }: { id: string; quantity?: number; notes?: string }) =>
      apiFetch(`/api/v1/restaurant/order-items/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity, notes }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['restaurant-session', sessionId] }),
    onError: (e) => setSnack({ msg: e instanceof ApiError ? e.detail : 'Failed.', sev: 'error' }),
  });

  const removeItemMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/restaurant/order-items/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['restaurant-session', sessionId] }),
    onError: (e) => setSnack({ msg: e instanceof ApiError ? e.detail : 'Failed.', sev: 'error' }),
  });

  const sendToKitchenMut = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/restaurant/orders/${order!.id}/send`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant-session', sessionId] });
      setSnack({ msg: 'Order sent to kitchen!', sev: 'success' });
    },
    onError: (e) => setSnack({ msg: e instanceof ApiError ? e.detail : 'Failed.', sev: 'error' }),
  });

  const createSplitMut = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/restaurant/split-bills', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          splitCount: parseInt(splitCount),
          totalAmount: total,
        }),
      }),
    onSuccess: (data: any) => {
      setSplitOpen(false);
      setSnack({ msg: `Split bill created — ${splitCount} parties of ${cur.fmt(total / parseInt(splitCount))} each.`, sev: 'success' });
    },
    onError: (e) => setSnack({ msg: e instanceof ApiError ? e.detail : 'Failed.', sev: 'error' }),
  });

  const closeSessionMut = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/restaurant/sessions/${sessionId}/close`, { method: 'PATCH' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant-tables'] });
      navigate('/restaurant/tables');
    },
    onError: (e) => setSnack({ msg: e instanceof ApiError ? e.detail : 'Failed.', sev: 'error' }),
  });

  if (sessionLoading) {
    return (
      <Box p={4} textAlign="center">
        <Typography color="text.secondary">Loading table session…</Typography>
      </Box>
    );
  }

  if (!session) {
    return (
      <Box p={4} textAlign="center">
        <Typography color="error">Session not found.</Typography>
        <SecondaryButton sx={{ mt: 2 }} onClick={() => navigate('/restaurant/tables')}>Back to Tables</SecondaryButton>
      </Box>
    );
  }

  const table = session.table;

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar */}
      <Paper
        elevation={2}
        sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}
      >
        <IconButton onClick={() => navigate('/restaurant/tables')} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Box flex={1}>
          <Typography fontWeight={700}>
            Table {table?.tableNumber ?? ''}
            {table?.label ? ` — ${table.label}` : ''}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {session.covers} cover{session.covers !== 1 ? 's' : ''}
            {session.waiterName ? ` · ${session.waiterName}` : ''}
            {table?.section ? ` · ${table.section}` : ''}
          </Typography>
        </Box>
        {unsentItems.length > 0 && (
          <Chip
            label={`${unsentItems.length} unsent`}
            color="warning"
            size="small"
            variant="outlined"
          />
        )}
        <Tooltip title="Send unsent items to kitchen">
          <span>
            <PrimaryButton
              startIcon={<SendIcon />}
              onClick={() => sendToKitchenMut.mutate()}
              disabled={unsentItems.length === 0 || sendToKitchenMut.isPending}
              size="small"
            >
              Send to Kitchen
            </PrimaryButton>
          </span>
        </Tooltip>
      </Paper>

      {/* Main content: product picker + order */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: product picker */}
        <Box sx={{ width: { xs: '55%', md: '60%' }, display: 'flex', flexDirection: 'column', borderRight: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
          {/* Category chips + search */}
          <Box sx={{ px: 1.5, pt: 1.5, pb: 1, flexShrink: 0, borderBottom: '1px solid', borderColor: 'divider' }}>
            <TextField
              size="small"
              placeholder="Search items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              fullWidth
              InputProps={{ startAdornment: <SearchIcon sx={{ mr: 0.5, color: 'text.disabled', fontSize: 18 }} /> }}
              sx={{ mb: 1 }}
            />
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'nowrap', overflowX: 'auto', pb: 0.5 }}>
              <Chip
                label="All"
                size="small"
                color={!selectedCategory ? 'primary' : 'default'}
                onClick={() => setSelectedCategory(null)}
                clickable
              />
              {visibleCategories.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  size="small"
                  color={selectedCategory === c.id ? 'primary' : 'default'}
                  onClick={() => setSelectedCategory(c.id)}
                  clickable
                  sx={{ whiteSpace: 'nowrap' }}
                />
              ))}
            </Box>
          </Box>

          {/* Product grid */}
          <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
            <Grid container spacing={1}>
              {filteredProducts.map((product) => (
                <Grid item key={product.id} xs={6} sm={4}>
                  <Card
                    variant="outlined"
                    sx={{
                      height: '100%',
                      '&:hover': { borderColor: 'primary.main' },
                      transition: 'border-color .15s',
                    }}
                  >
                    <CardActionArea
                      onClick={() => order && addItemMut.mutate(product)}
                      disabled={!order}
                      sx={{ height: '100%', p: 1.25 }}
                    >
                      <Typography variant="body2" fontWeight={600} lineHeight={1.2}>
                        {product.name}
                      </Typography>
                      <Typography variant="caption" color="primary.main" fontWeight={700} mt={0.5} display="block">
                        {cur.fmt(parseFloat(product.salePrice) || 0)}
                      </Typography>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
              {filteredProducts.length === 0 && (
                <Grid item xs={12}>
                  <Box py={4} textAlign="center">
                    <Typography color="text.secondary" variant="body2">No items found.</Typography>
                  </Box>
                </Grid>
              )}
            </Grid>
          </Box>
        </Box>

        {/* Right: current order */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {items.length === 0 ? (
              <Box py={6} textAlign="center">
                <Typography color="text.secondary" variant="body2">No items yet. Select from the menu.</Typography>
              </Box>
            ) : (
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, py: 1 }}>Item</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, width: 88, py: 1 }}>Qty</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, width: 80, py: 1 }}>Price</TableCell>
                    <TableCell width={36} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item) => {
                    const isSent = !!item.kdsTicketId;
                    return (
                      <TableRow
                        key={item.id}
                        sx={{
                          opacity: item.kdsStatus === 'cancelled' ? 0.4 : 1,
                          bgcolor: !isSent ? 'warning.light' + '22' : 'transparent',
                        }}
                      >
                        <TableCell sx={{ py: 0.5 }}>
                          <Typography variant="body2" fontWeight={600}>{item.productName}</Typography>
                          {item.notes && (
                            <Typography variant="caption" color="text.secondary">{item.notes}</Typography>
                          )}
                          <Stack direction="row" spacing={0.5} mt={0.25}>
                            <Chip
                              label={isSent ? item.kdsStatus : 'unsent'}
                              size="small"
                              color={(isSent ? KDS_STATUS_COLOR[item.kdsStatus] : 'warning') as any}
                              sx={{ height: 16, fontSize: '0.6rem' }}
                            />
                          </Stack>
                        </TableCell>
                        <TableCell align="center" sx={{ py: 0.5 }}>
                          {!isSent ? (
                            <Stack direction="row" alignItems="center" spacing={0.25} justifyContent="center">
                              <IconButton
                                size="small"
                                disabled={item.quantity <= 1}
                                onClick={() => updateItemMut.mutate({ id: item.id, quantity: item.quantity - 1 })}
                                sx={{ p: 0.25 }}
                              >
                                <RemoveIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                              <Typography variant="body2" fontWeight={700} minWidth={20} textAlign="center">
                                {item.quantity}
                              </Typography>
                              <IconButton
                                size="small"
                                onClick={() => updateItemMut.mutate({ id: item.id, quantity: item.quantity + 1 })}
                                sx={{ p: 0.25 }}
                              >
                                <AddIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Stack>
                          ) : (
                            <Typography variant="body2" fontWeight={700} textAlign="center">{item.quantity}</Typography>
                          )}
                        </TableCell>
                        <TableCell align="right" sx={{ py: 0.5 }}>
                          <Typography variant="body2">{cur.fmt(item.subtotal)}</Typography>
                        </TableCell>
                        <TableCell sx={{ py: 0.5 }}>
                          {!isSent && (
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => removeItemMut.mutate(item.id)}
                              sx={{ p: 0.25 }}
                            >
                              <DeleteIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Box>

          {/* Order footer */}
          <Box sx={{ flexShrink: 0, borderTop: '1px solid', borderColor: 'divider', p: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" mb={1.5}>
              <Typography variant="subtitle2" color="text.secondary">Order Total</Typography>
              <Typography variant="subtitle1" fontWeight={800}>{cur.fmt(total)}</Typography>
            </Stack>
            <Divider sx={{ mb: 1.5 }} />
            <Stack spacing={1}>
              <PrimaryButton
                fullWidth
                startIcon={<CallSplitIcon />}
                onClick={() => setSplitOpen(true)}
                disabled={total <= 0}
                size="small"
              >
                Split Bill
              </PrimaryButton>
              <SecondaryButton
                fullWidth
                startIcon={<CloseIcon />}
                onClick={() => setCloseOpen(true)}
                size="small"
                color="error"
              >
                Close Table
              </SecondaryButton>
            </Stack>
          </Box>
        </Box>
      </Box>

      {/* Split Bill Modal */}
      <AppModal open={splitOpen} onClose={() => setSplitOpen(false)} title="Split Bill">
        <Stack spacing={2} pt={0.5}>
          <Typography variant="body2" color="text.secondary">
            Total: <strong>{cur.fmt(total)}</strong>
          </Typography>
          <TextField
            label="Split how many ways?"
            value={splitCount}
            onChange={(e) => setSplitCount(e.target.value)}
            type="number"
            inputProps={{ min: 2, max: 20 }}
            size="small"
            fullWidth
            autoFocus
          />
          {parseInt(splitCount) >= 2 && (
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
              <Typography variant="body2" color="text.secondary">
                Each party pays: <strong>{cur.fmt(total / parseInt(splitCount))}</strong>
              </Typography>
            </Paper>
          )}
        </Stack>
        <DialogActions sx={{ mt: 1 }}>
          <SecondaryButton onClick={() => setSplitOpen(false)}>Cancel</SecondaryButton>
          <PrimaryButton
            onClick={() => createSplitMut.mutate()}
            disabled={parseInt(splitCount) < 2 || createSplitMut.isPending}
          >
            {createSplitMut.isPending ? 'Creating…' : 'Create Split'}
          </PrimaryButton>
        </DialogActions>
      </AppModal>

      {/* Close Table Modal */}
      <AppModal open={closeOpen} onClose={() => setCloseOpen(false)} title="Close Table">
        <Stack spacing={1.5} pt={0.5}>
          <Alert severity="info">
            Make sure all items have been billed and paid before closing the table.
          </Alert>
          <Typography variant="body2">
            Order total: <strong>{cur.fmt(total)}</strong>
          </Typography>
          {unsentItems.length > 0 && (
            <Alert severity="warning">
              {unsentItems.length} item{unsentItems.length !== 1 ? 's have' : ' has'} not been sent to the kitchen yet.
            </Alert>
          )}
        </Stack>
        <DialogActions sx={{ mt: 1 }}>
          <SecondaryButton onClick={() => setCloseOpen(false)}>Cancel</SecondaryButton>
          <PrimaryButton
            color="error"
            startIcon={<CheckCircleIcon />}
            onClick={() => closeSessionMut.mutate()}
            disabled={closeSessionMut.isPending}
          >
            {closeSessionMut.isPending ? 'Closing…' : 'Close Table'}
          </PrimaryButton>
        </DialogActions>
      </AppModal>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
        <Alert severity={snack?.sev ?? 'info'} onClose={() => setSnack(null)} variant="filled">{snack?.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
