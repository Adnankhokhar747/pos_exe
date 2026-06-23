import { useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  IconButton,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { Batch, ProductWithStock, SerialNumberRecord, StockAdjustment, StockTransfer } from '../api/types';
import { DataTable } from '../components/DataTable';
import { PrimaryButton, SecondaryButton } from '../components/buttons';
import { formatEnumLabel } from '../utils/format';
import { useAuth } from '../state/auth-context';

interface AdjustmentLineDraft {
  productId: string;
  countedQuantity: string;
}

interface TransferLineDraft {
  productId: string;
  quantity: string;
}

export function InventoryPage(): JSX.Element {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const ACTIVE_WAREHOUSE_ID = user!.warehouseId;
  const [tab, setTab] = useState(0);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const productsQuery = useQuery({
    queryKey: ['pos-grid', ''],
    queryFn: () => apiFetch<ProductWithStock[]>(`/api/v1/products/pos-grid?warehouseId=${ACTIVE_WAREHOUSE_ID}`),
  });

  // --- Stock Adjustments ---
  const [reasonCode, setReasonCode] = useState('recount');
  const [note, setNote] = useState('');
  const [adjLines, setAdjLines] = useState<AdjustmentLineDraft[]>([]);
  const adjustmentsQuery = useQuery({
    queryKey: ['stock-adjustments'],
    queryFn: () => apiFetch<StockAdjustment[]>(`/api/v1/stock-adjustments?warehouseId=${ACTIVE_WAREHOUSE_ID}`),
  });
  const createAdjMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/stock-adjustments', {
        method: 'POST',
        body: JSON.stringify({
          warehouseId: ACTIVE_WAREHOUSE_ID,
          reasonCode,
          note: note || undefined,
          lines: adjLines.map((l) => ({ productId: l.productId, countedQuantity: l.countedQuantity })),
        }),
      }),
    onSuccess: () => {
      setSnackbar('Stock adjustment posted.');
      setAdjLines([]);
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['stock-adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['pos-grid'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not post adjustment.'),
  });

  // --- Stock Transfers ---
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [transferLines, setTransferLines] = useState<TransferLineDraft[]>([]);
  const transfersQuery = useQuery({
    queryKey: ['stock-transfers'],
    queryFn: () => apiFetch<StockTransfer[]>('/api/v1/stock-transfers'),
  });
  const createTransferMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/stock-transfers', {
        method: 'POST',
        body: JSON.stringify({
          fromWarehouseId: ACTIVE_WAREHOUSE_ID,
          toWarehouseId,
          lines: transferLines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        }),
      }),
    onSuccess: () => {
      setSnackbar('Transfer created (draft).');
      setTransferLines([]);
      setToWarehouseId('');
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not create transfer.'),
  });
  const dispatchMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/stock-transfers/${id}/dispatch`, { method: 'POST' }),
    onSuccess: () => {
      setSnackbar('Transfer dispatched — stock decremented at source.');
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['pos-grid'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not dispatch transfer.'),
  });
  const receiveMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/stock-transfers/${id}/receive`, { method: 'POST' }),
    onSuccess: () => {
      setSnackbar('Transfer received — stock incremented at destination.');
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['pos-grid'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not receive transfer.'),
  });

  // --- Batches ---
  const [expiringOnly, setExpiringOnly] = useState(false);
  const batchesQuery = useQuery({
    queryKey: ['batches', ACTIVE_WAREHOUSE_ID, expiringOnly],
    queryFn: () =>
      expiringOnly
        ? apiFetch<Batch[]>(`/api/v1/batches/expiring?warehouseId=${ACTIVE_WAREHOUSE_ID}&withinDays=30`)
        : apiFetch<Batch[]>(`/api/v1/batches?warehouseId=${ACTIVE_WAREHOUSE_ID}`),
  });

  // --- Serial Numbers ---
  const [serialStatusFilter, setSerialStatusFilter] = useState<'' | 'in_stock' | 'sold' | 'returned'>('in_stock');
  const serialNumbersQuery = useQuery({
    queryKey: ['serial-numbers', ACTIVE_WAREHOUSE_ID, serialStatusFilter],
    queryFn: () =>
      apiFetch<SerialNumberRecord[]>(
        `/api/v1/serial-numbers?warehouseId=${ACTIVE_WAREHOUSE_ID}${serialStatusFilter ? `&status=${serialStatusFilter}` : ''}`,
      ),
  });

  return (
    <Box p={2} height="100%" overflow="auto">
      <Typography variant="h6" gutterBottom>
        Inventory
      </Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Stock on Hand" />
        <Tab label="Stock Adjustments" />
        <Tab label="Stock Transfers" />
        <Tab label="Batches & Expiry" />
        <Tab label="Serial Numbers" />
      </Tabs>

      {tab === 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Current stock for this warehouse. This updates immediately after a goods receipt is posted in
            Purchasing, a stock adjustment is posted below, or a transfer is dispatched/received.
          </Typography>
          <DataTable
            searchPlaceholder="Search products…"
            emptyMessage="No products found."
            getRowId={(p: ProductWithStock) => p.id}
            rows={productsQuery.data ?? []}
            getSearchText={(p) => `${p.name} ${p.sku} ${p.barcode ?? ''}`}
            columns={[
              { key: 'name', label: 'Product', sortable: true, render: (p) => p.name },
              { key: 'sku', label: 'SKU', sortable: true, render: (p) => p.sku },
              {
                key: 'quantityOnHand',
                label: 'Qty on Hand',
                align: 'right',
                sortable: true,
                sortValue: (p) => Number(p.quantityOnHand),
                render: (p) => p.quantityOnHand,
              },
              {
                key: 'stockValue',
                label: 'Stock Value (at cost)',
                align: 'right',
                sortable: true,
                sortValue: (p) => Number(p.quantityOnHand) * Number(p.costPrice),
                render: (p) => `$${(Number(p.quantityOnHand) * Number(p.costPrice)).toFixed(2)}`,
              },
            ]}
          />
        </Box>
      )}

      {tab === 1 && (
        <Box>
          <Stack spacing={2} mb={3} maxWidth={600}>
            <TextField label="Reason code" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} />
            <TextField label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <Stack spacing={1}>
              {adjLines.map((line, idx) => (
                <Stack direction="row" spacing={1} key={idx} alignItems="center">
                  <Autocomplete
                    size="small"
                    sx={{ width: 260 }}
                    options={productsQuery.data ?? []}
                    getOptionLabel={(o) => `${o.name} (on hand: ${o.quantityOnHand})`}
                    onChange={(_, value) =>
                      setAdjLines((current) =>
                        current.map((l, i) => (i === idx ? { ...l, productId: value?.id ?? '' } : l)),
                      )
                    }
                    renderInput={(params) => <TextField {...params} label="Product" />}
                  />
                  <TextField
                    size="small"
                    label="Counted Qty"
                    sx={{ width: 120 }}
                    value={line.countedQuantity}
                    onChange={(e) =>
                      setAdjLines((current) =>
                        current.map((l, i) => (i === idx ? { ...l, countedQuantity: e.target.value } : l)),
                      )
                    }
                  />
                  <IconButton size="small" onClick={() => setAdjLines((current) => current.filter((_, i) => i !== idx))}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
              <Button
                size="small"
                startIcon={<AddIcon />}
                sx={{ alignSelf: 'flex-start' }}
                onClick={() => setAdjLines((current) => [...current, { productId: '', countedQuantity: '0' }])}
              >
                Add line
              </Button>
            </Stack>
            <PrimaryButton
              disabled={adjLines.length === 0 || createAdjMutation.isPending}
              onClick={() => createAdjMutation.mutate()}
              sx={{ alignSelf: 'flex-start' }}
            >
              Post Adjustment
            </PrimaryButton>
          </Stack>
          <DataTable
            searchPlaceholder="Search adjustments…"
            emptyMessage="No stock adjustments yet."
            getRowId={(adj: StockAdjustment) => adj.id}
            rows={adjustmentsQuery.data ?? []}
            getSearchText={(adj) => `${adj.reasonCode} ${adj.note ?? ''}`}
            columns={[
              { key: 'reasonCode', label: 'Reason', sortable: true, render: (a) => a.reasonCode },
              { key: 'note', label: 'Note', render: (a) => a.note ?? '—' },
              {
                key: 'createdAt',
                label: 'Created',
                sortable: true,
                sortValue: (a) => new Date(a.createdAt).getTime(),
                render: (a) => new Date(a.createdAt).toLocaleString(),
              },
            ]}
          />
        </Box>
      )}

      {tab === 2 && (
        <Box>
          <Stack spacing={2} mb={3} maxWidth={600}>
            <Typography variant="caption" color="text.secondary">
              From warehouse: this device's active warehouse. Enter the destination warehouse ID.
            </Typography>
            <TextField label="To Warehouse ID" value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)} />
            <Stack spacing={1}>
              {transferLines.map((line, idx) => (
                <Stack direction="row" spacing={1} key={idx} alignItems="center">
                  <Autocomplete
                    size="small"
                    sx={{ width: 260 }}
                    options={productsQuery.data ?? []}
                    getOptionLabel={(o) => `${o.name} (on hand: ${o.quantityOnHand})`}
                    onChange={(_, value) =>
                      setTransferLines((current) =>
                        current.map((l, i) => (i === idx ? { ...l, productId: value?.id ?? '' } : l)),
                      )
                    }
                    renderInput={(params) => <TextField {...params} label="Product" />}
                  />
                  <TextField
                    size="small"
                    label="Quantity"
                    sx={{ width: 120 }}
                    value={line.quantity}
                    onChange={(e) =>
                      setTransferLines((current) => current.map((l, i) => (i === idx ? { ...l, quantity: e.target.value } : l)))
                    }
                  />
                  <IconButton size="small" onClick={() => setTransferLines((current) => current.filter((_, i) => i !== idx))}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
              <Button
                size="small"
                startIcon={<AddIcon />}
                sx={{ alignSelf: 'flex-start' }}
                onClick={() => setTransferLines((current) => [...current, { productId: '', quantity: '1' }])}
              >
                Add line
              </Button>
            </Stack>
            <PrimaryButton
              disabled={!toWarehouseId || transferLines.length === 0 || createTransferMutation.isPending}
              onClick={() => createTransferMutation.mutate()}
              sx={{ alignSelf: 'flex-start' }}
            >
              Create Transfer (Draft)
            </PrimaryButton>
          </Stack>
          <DataTable
            searchPlaceholder="Search transfers…"
            emptyMessage="No stock transfers yet."
            getRowId={(t: StockTransfer) => t.id}
            rows={transfersQuery.data ?? []}
            getSearchText={(t) => `${t.fromWarehouseId} ${t.toWarehouseId} ${t.status}`}
            columns={[
              { key: 'fromWarehouseId', label: 'From', render: (t) => `${t.fromWarehouseId.slice(0, 8)}…` },
              { key: 'toWarehouseId', label: 'To', render: (t) => `${t.toWarehouseId.slice(0, 8)}…` },
              { key: 'status', label: 'Status', sortable: true, render: (t) => formatEnumLabel(t.status) },
              {
                key: 'createdAt',
                label: 'Created',
                sortable: true,
                sortValue: (t) => new Date(t.createdAt).getTime(),
                render: (t) => new Date(t.createdAt).toLocaleString(),
              },
              {
                key: 'actions',
                label: '',
                render: (t) => (
                  <>
                    {t.status === 'draft' && (
                      <Button size="small" onClick={() => dispatchMutation.mutate(t.id)}>
                        Dispatch
                      </Button>
                    )}
                    {t.status === 'dispatched' && (
                      <Button size="small" onClick={() => receiveMutation.mutate(t.id)}>
                        Receive
                      </Button>
                    )}
                  </>
                ),
              },
            ]}
          />
        </Box>
      )}

      {tab === 3 && (
        <Box>
          <DataTable
            searchPlaceholder="Search batches…"
            emptyMessage="No batches found."
            getRowId={(batch: Batch) => batch.id}
            rows={batchesQuery.data ?? []}
            getSearchText={(batch) => `${batch.product?.name ?? batch.productId} ${batch.batchNo}`}
            toolbar={
              <SecondaryButton
                variant={expiringOnly ? 'contained' : 'outlined'}
                onClick={() => setExpiringOnly((v) => !v)}
              >
                {expiringOnly ? 'Showing: Expiring within 30 days' : 'Show all batches'}
              </SecondaryButton>
            }
            columns={[
              { key: 'product', label: 'Product', sortable: true, sortValue: (b) => b.product?.name ?? b.productId, render: (b) => b.product?.name ?? b.productId },
              { key: 'batchNo', label: 'Batch No.', sortable: true, render: (b) => b.batchNo },
              {
                key: 'expiryDate',
                label: 'Expiry',
                sortable: true,
                sortValue: (b) => (b.expiryDate ? new Date(b.expiryDate).getTime() : 0),
                render: (b) => (b.expiryDate ? new Date(b.expiryDate).toLocaleDateString() : '—'),
              },
              { key: 'quantityOnHand', label: 'Qty on Hand', align: 'right', sortable: true, render: (b) => b.quantityOnHand },
              {
                key: 'costPrice',
                label: 'Cost',
                align: 'right',
                sortable: true,
                sortValue: (b) => Number(b.costPrice),
                render: (b) => Number(b.costPrice).toFixed(2),
              },
            ]}
          />
        </Box>
      )}

      {tab === 4 && (
        <Box>
          <DataTable
            searchPlaceholder="Search serial numbers…"
            emptyMessage="No serial numbers found."
            getRowId={(serial: SerialNumberRecord) => serial.id}
            rows={serialNumbersQuery.data ?? []}
            getSearchText={(serial) => `${serial.product?.name ?? serial.productId} ${serial.serialNo} ${serial.status}`}
            toolbar={
              <Stack direction="row" spacing={1}>
                {(['', 'in_stock', 'sold', 'returned'] as const).map((status) => (
                  <SecondaryButton
                    key={status || 'all'}
                    variant={serialStatusFilter === status ? 'contained' : 'outlined'}
                    onClick={() => setSerialStatusFilter(status)}
                  >
                    {status === '' ? 'All' : status === 'in_stock' ? 'In Stock' : status === 'sold' ? 'Sold' : 'Returned'}
                  </SecondaryButton>
                ))}
              </Stack>
            }
            columns={[
              { key: 'product', label: 'Product', sortable: true, sortValue: (s) => s.product?.name ?? s.productId, render: (s) => s.product?.name ?? s.productId },
              { key: 'serialNo', label: 'Serial No.', sortable: true, render: (s) => s.serialNo },
              { key: 'status', label: 'Status', sortable: true, render: (s) => formatEnumLabel(s.status) },
            ]}
          />
        </Box>
      )}

      <Snackbar open={Boolean(snackbar)} autoHideDuration={3000} onClose={() => setSnackbar(null)} message={snackbar} />
    </Box>
  );
}
