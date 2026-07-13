import { useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  MenuItem,
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
import type {
  GoodsReceipt,
  ProductWithStock,
  PurchaseOrder,
  Supplier,
  SupplierInvoice,
  SupplierPayment,
} from '../api/types';
import { DataTable } from '../components/DataTable';
import { PrimaryButton } from '../components/buttons';
import { formatEnumLabel } from '../utils/format';
import { useAuth } from '../state/auth-context';

interface LineDraft {
  productId: string;
  productName: string;
  quantity: string;
  unitCost: string;
  batchNo?: string;
  expiryDate?: string;
  serialNumbersText?: string;
}

export function PurchasingPage(): JSX.Element {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const ACTIVE_WAREHOUSE_ID = user!.warehouseId;
  const [tab, setTab] = useState(0);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const POLL = 15_000; // 15-second background refresh for all purchasing data

  const suppliersQuery = useQuery({
    queryKey: ['suppliers-lookup'],
    queryFn: () => apiFetch<Supplier[]>('/api/v1/suppliers'),
    refetchInterval: POLL,
  });
  const productsQuery = useQuery({
    queryKey: ['pos-grid', ''],
    queryFn: () => apiFetch<ProductWithStock[]>(`/api/v1/products/pos-grid?warehouseId=${ACTIVE_WAREHOUSE_ID}`),
    refetchInterval: POLL,
  });

  // --- Purchase Orders ---
  const [poSupplier, setPoSupplier] = useState<Supplier | null>(null);
  const [poLines, setPoLines] = useState<LineDraft[]>([]);
  const [payingPo, setPayingPo] = useState<PurchaseOrder | null>(null);
  const [poPayForm, setPoPayForm] = useState({ amount: '', method: 'cash' });
  const payPoMutation = useMutation({
    mutationFn: ({ id, amount, method }: { id: string; amount: string; method: string }) =>
      apiFetch(`/api/v1/purchase-orders/${id}/pay`, {
        method: 'POST',
        body: JSON.stringify({ amount: parseFloat(amount), method }),
      }),
    onSuccess: () => {
      setSnackbar('Advance payment recorded.');
      setPayingPo(null);
      setPoPayForm({ amount: '', method: 'cash' });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not record payment.'),
  });
  const purchaseOrdersQuery = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: () => apiFetch<PurchaseOrder[]>('/api/v1/purchase-orders'),
    refetchInterval: POLL,
  });
  const createPoMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/purchase-orders', {
        method: 'POST',
        body: JSON.stringify({
          supplierId: poSupplier?.id,
          warehouseId: ACTIVE_WAREHOUSE_ID,
          lines: poLines.map((l) => ({ productId: l.productId, quantityOrdered: l.quantity, unitCost: l.unitCost })),
        }),
      }),
    onSuccess: () => {
      setSnackbar('Purchase order created.');
      setPoLines([]);
      setPoSupplier(null);
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not create PO.'),
  });
  const sendPoMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/purchase-orders/${id}/send`, { method: 'POST' }),
    onSuccess: () => {
      setSnackbar('Purchase order sent.');
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not send PO.'),
  });

  // --- Goods Receipts ---
  const [grPoId, setGrPoId] = useState('');
  const [grLines, setGrLines] = useState<LineDraft[]>([]);
  const goodsReceiptsQuery = useQuery({
    queryKey: ['goods-receipts'],
    queryFn: () => apiFetch<GoodsReceipt[]>(`/api/v1/goods-receipts?warehouseId=${ACTIVE_WAREHOUSE_ID}`),
    refetchInterval: POLL,
  });
  const createGrMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/goods-receipts', {
        method: 'POST',
        body: JSON.stringify({
          purchaseOrderId: grPoId || undefined,
          warehouseId: ACTIVE_WAREHOUSE_ID,
          lines: grLines.map((l) => ({
            productId: l.productId,
            quantityReceived: l.quantity,
            unitCost: l.unitCost,
            batchNo: l.batchNo || undefined,
            expiryDate: l.expiryDate ? new Date(l.expiryDate).toISOString() : undefined,
            serialNumbers: l.serialNumbersText
              ? l.serialNumbersText.split(',').map((s) => s.trim()).filter(Boolean)
              : undefined,
          })),
        }),
      }),
    onSuccess: () => {
      setSnackbar('Goods receipt posted — stock updated.');
      setGrLines([]);
      setGrPoId('');
      queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not post goods receipt.'),
  });

  // --- Supplier Invoices ---
  const [siSupplier, setSiSupplier] = useState<Supplier | null>(null);
  const [siForm, setSiForm] = useState({ invoiceNo: '', amount: '', dueDate: '' });
  const supplierInvoicesQuery = useQuery({
    queryKey: ['supplier-invoices'],
    queryFn: () => apiFetch<SupplierInvoice[]>('/api/v1/supplier-invoices'),
    refetchInterval: POLL,
  });
  const createSiMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/supplier-invoices', {
        method: 'POST',
        body: JSON.stringify({
          supplierId: siSupplier?.id,
          invoiceNo: siForm.invoiceNo,
          amount: siForm.amount,
          dueDate: siForm.dueDate || undefined,
        }),
      }),
    onSuccess: () => {
      setSnackbar('Supplier invoice recorded.');
      setSiForm({ invoiceNo: '', amount: '', dueDate: '' });
      setSiSupplier(null);
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not record invoice.'),
  });

  // --- Invoice Payment Dialog ---
  const [payingInvoice, setPayingInvoice] = useState<SupplierInvoice | null>(null);
  const [payForm, setPayForm] = useState({ amount: '', method: 'cash' });
  const payInvoiceMutation = useMutation({
    mutationFn: ({ id, amount, method }: { id: string; amount: string; method: string }) =>
      apiFetch(`/api/v1/supplier-invoices/${id}/pay`, {
        method: 'POST',
        body: JSON.stringify({ amount: parseFloat(amount), method }),
      }),
    onSuccess: () => {
      setSnackbar('Payment recorded successfully.');
      setPayingInvoice(null);
      setPayForm({ amount: '', method: 'cash' });
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not record payment.'),
  });

  // --- Supplier Payments ---
  const [spSupplier, setSpSupplier] = useState<Supplier | null>(null);
  const [spAmount, setSpAmount] = useState('');
  const supplierPaymentsQuery = useQuery({
    queryKey: ['supplier-payments'],
    queryFn: () => apiFetch<SupplierPayment[]>('/api/v1/supplier-payments'),
    refetchInterval: POLL,
  });
  const createSpMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/supplier-payments', {
        method: 'POST',
        body: JSON.stringify({ supplierId: spSupplier?.id, amount: spAmount }),
      }),
    onSuccess: () => {
      setSnackbar('Payment recorded.');
      setSpAmount('');
      setSpSupplier(null);
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not record payment.'),
  });

  function addLine(setLines: (fn: (current: LineDraft[]) => LineDraft[]) => void): void {
    setLines((current) => [...current, { productId: '', productName: '', quantity: '1', unitCost: '0' }]);
  }

  function linesFromPo(po: PurchaseOrder): LineDraft[] {
    const products = productsQuery.data ?? [];
    return po.lines
      .map((line) => {
        const remaining = Number(line.quantityOrdered) - Number(line.quantityReceived);
        const product = products.find((p) => p.id === line.productId);
        return {
          productId: line.productId,
          productName: product?.name ?? '',
          quantity: remaining > 0 ? String(remaining) : '0',
          unitCost: line.unitCost,
        };
      })
      .filter((line) => Number(line.quantity) > 0);
  }

  function handleSelectGrPo(poId: string): void {
    setGrPoId(poId);
    if (!poId) return;
    const po = (purchaseOrdersQuery.data ?? []).find((p) => p.id === poId);
    if (po) setGrLines(linesFromPo(po));
  }

  function lineEditor(
    lines: LineDraft[],
    setLines: (fn: (current: LineDraft[]) => LineDraft[]) => void,
    showBatchSerial = false,
  ): JSX.Element {
    return (
      <Stack spacing={1}>
        {lines.map((line, idx) => {
          const product = (productsQuery.data ?? []).find((p) => p.id === line.productId);
          return (
            <Stack spacing={1} key={idx}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Autocomplete
                  size="small"
                  sx={{ width: 260 }}
                  options={productsQuery.data ?? []}
                  getOptionLabel={(o) => o.name}
                  value={product ?? null}
                  isOptionEqualToValue={(o, v) => o.id === v.id}
                  onChange={(_, value) =>
                    setLines((current) =>
                      current.map((l, i) => (i === idx ? { ...l, productId: value?.id ?? '', productName: value?.name ?? '' } : l)),
                    )
                  }
                  renderInput={(params) => <TextField {...params} label="Product" />}
                />
                <TextField
                  size="small"
                  label="Qty"
                  sx={{ width: 90 }}
                  value={line.quantity}
                  onChange={(e) =>
                    setLines((current) => current.map((l, i) => (i === idx ? { ...l, quantity: e.target.value } : l)))
                  }
                />
                <TextField
                  size="small"
                  label="Unit Cost"
                  sx={{ width: 100 }}
                  value={line.unitCost}
                  onChange={(e) =>
                    setLines((current) => current.map((l, i) => (i === idx ? { ...l, unitCost: e.target.value } : l)))
                  }
                />
                <IconButton size="small" onClick={() => setLines((current) => current.filter((_, i) => i !== idx))}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Stack>
              {showBatchSerial && product?.trackBatches && (
                <Stack direction="row" spacing={1} pl={4}>
                  <TextField
                    size="small"
                    label="Batch No."
                    sx={{ width: 160 }}
                    value={line.batchNo ?? ''}
                    onChange={(e) =>
                      setLines((current) => current.map((l, i) => (i === idx ? { ...l, batchNo: e.target.value } : l)))
                    }
                  />
                  <TextField
                    size="small"
                    label="Expiry Date"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={line.expiryDate ?? ''}
                    onChange={(e) =>
                      setLines((current) => current.map((l, i) => (i === idx ? { ...l, expiryDate: e.target.value } : l)))
                    }
                  />
                </Stack>
              )}
              {showBatchSerial && product?.trackSerials && (
                <TextField
                  size="small"
                  label={`Serial numbers (comma-separated, ${line.quantity} needed)`}
                  fullWidth
                  sx={{ pl: 4, maxWidth: 500 }}
                  value={line.serialNumbersText ?? ''}
                  onChange={(e) =>
                    setLines((current) =>
                      current.map((l, i) => (i === idx ? { ...l, serialNumbersText: e.target.value } : l)),
                    )
                  }
                />
              )}
            </Stack>
          );
        })}
        <Button size="small" startIcon={<AddIcon />} onClick={() => addLine(setLines)} sx={{ alignSelf: 'flex-start' }}>
          Add line
        </Button>
      </Stack>
    );
  }

  return (
    <Box p={2} height="100%" overflow="auto">
      <Typography variant="h6" gutterBottom>
        Purchasing
      </Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Purchase Orders" />
        <Tab label="Goods Receipts" />
        <Tab label="Supplier Invoices" />
        <Tab label="Supplier Payments" />
      </Tabs>

      {tab === 0 && (
        <Box>
          <Stack spacing={2} mb={3} maxWidth={600}>
            <Autocomplete
              options={suppliersQuery.data ?? []}
              getOptionLabel={(o) => o.name}
              value={poSupplier}
              onChange={(_, v) => setPoSupplier(v)}
              renderInput={(params) => <TextField {...params} label="Supplier" />}
            />
            {lineEditor(poLines, setPoLines)}
            <PrimaryButton
              disabled={!poSupplier || poLines.length === 0 || createPoMutation.isPending}
              onClick={() => createPoMutation.mutate()}
              sx={{ alignSelf: 'flex-start' }}
            >
              Create Purchase Order
            </PrimaryButton>
            <Typography variant="caption" color="text.secondary">
              Creating a purchase order does not change your stock yet — it only records what you intend to
              order. Stock is added once you receive the goods in the <strong>Goods Receipts</strong> tab.
            </Typography>
          </Stack>
          <DataTable
            searchPlaceholder="Search purchase orders…"
            emptyMessage="No purchase orders yet."
            getRowId={(po: PurchaseOrder) => po.id}
            rows={purchaseOrdersQuery.data ?? []}
            getSearchText={(po) => `${po.orderNo} ${po.status} ${po.supplier?.name ?? ''}`}
            columns={[
              { key: 'orderNo', label: 'Order No', sortable: true, render: (po) => po.orderNo },
              { key: 'supplier', label: 'Supplier', sortable: true, render: (po) => po.supplier?.name ?? '—' },
              {
                key: 'orderTotal',
                label: 'PO Total',
                align: 'right',
                sortable: true,
                sortValue: (po) => po.lines.reduce((s, l) => s + Number(l.unitCost) * Number(l.quantityOrdered), 0),
                render: (po) => `$${po.lines.reduce((s, l) => s + Number(l.unitCost) * Number(l.quantityOrdered), 0).toFixed(2)}`,
              },
              {
                key: 'amountPaid',
                label: 'Paid',
                align: 'right',
                render: (po) => {
                  // After receipt → use invoice amount_paid; before receipt → use advance payments
                  const invoices = (po.goodsReceipts ?? []).flatMap((gr) => gr.supplierInvoices ?? []);
                  const paid = invoices.length > 0
                    ? invoices.reduce((s, inv) => s + Number(inv.amountPaid), 0)
                    : Number(po.paymentsSumAmount ?? 0);
                  return paid > 0
                    ? <Typography variant="body2" color="success.main" fontWeight={600}>${paid.toFixed(2)}</Typography>
                    : <Typography variant="body2" color="text.disabled">$0.00</Typography>;
                },
              },
              {
                key: 'payStatus',
                label: 'Pay Status',
                render: (po) => {
                  const total = po.lines.reduce((s, l) => s + Number(l.unitCost) * Number(l.quantityOrdered), 0);
                  if (total === 0) return null;
                  const invoices = (po.goodsReceipts ?? []).flatMap((gr) => gr.supplierInvoices ?? []);
                  if (invoices.length > 0) {
                    // Status comes from invoice
                    const inv = invoices[0]!;
                    const colorMap: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
                      paid: 'success', partially_paid: 'warning', unpaid: 'error',
                    };
                    return <Chip size="small" label={`${formatEnumLabel(inv.status)} (${inv.invoiceNo})`} color={colorMap[inv.status] ?? 'default'} />;
                  }
                  // Pre-receipt: advance status
                  const advance = Number(po.paymentsSumAmount ?? 0);
                  if (advance >= total) return <Chip size="small" label="Advance: Fully Paid" color="success" />;
                  if (advance > 0) return <Chip size="small" label={`Advance: $${advance.toFixed(2)}`} color="warning" />;
                  return <Chip size="small" label="Unpaid" color="error" />;
                },
              },
              {
                key: 'grRef',
                label: 'GR / Invoice',
                render: (po) => {
                  const grs = po.goodsReceipts ?? [];
                  if (grs.length === 0) return <Typography variant="body2" color="text.disabled">—</Typography>;
                  return (
                    <Stack spacing={0.25}>
                      {grs.map((gr) => (
                        <Typography key={gr.id} variant="caption" color="text.secondary">
                          {gr.receiptNo}{(gr.supplierInvoices ?? []).map((si) => ` → ${si.invoiceNo}`).join('')}
                        </Typography>
                      ))}
                    </Stack>
                  );
                },
              },
              {
                key: 'received',
                label: 'Received',
                render: (po) => {
                  const ordered   = po.lines.reduce((s, l) => s + Number(l.quantityOrdered), 0);
                  const received  = po.lines.reduce((s, l) => s + Number(l.quantityReceived), 0);
                  return `${received} / ${ordered} units`;
                },
              },
              { key: 'status', label: 'PO Status', sortable: true, render: (po) => formatEnumLabel(po.status) },
              {
                key: 'createdAt', label: 'Created', sortable: true,
                sortValue: (po) => new Date(po.createdAt).getTime(),
                render: (po) => new Date(po.createdAt).toLocaleString(),
              },
              {
                key: 'actions',
                label: '',
                render: (po) => {
                  const total     = po.lines.reduce((s, l) => s + Number(l.unitCost) * Number(l.quantityOrdered), 0);
                  const invoices  = (po.goodsReceipts ?? []).flatMap((gr) => gr.supplierInvoices ?? []);
                  const invPaid   = invoices.reduce((s, inv) => s + Number(inv.amountPaid), 0);
                  const advance   = Number(po.paymentsSumAmount ?? 0);
                  const isInvoiced = invoices.length > 0;
                  const isFullyPaid = isInvoiced ? invPaid >= total : advance >= total;

                  return (
                    <Stack direction="row" spacing={0.5}>
                      {po.status === 'draft' && (
                        <Button size="small" onClick={() => sendPoMutation.mutate(po.id)}>Send</Button>
                      )}
                      {po.status !== 'voided' && !isFullyPaid && !isInvoiced && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            const remaining = Math.max(0, total - advance);
                            setPayingPo(po);
                            setPoPayForm({ amount: remaining.toFixed(2), method: 'cash' });
                          }}
                        >
                          Pay Advance
                        </Button>
                      )}
                      {isInvoiced && !isFullyPaid && (
                        <Button size="small" variant="outlined" color="warning" onClick={() => setTab(2)}>
                          Pay Invoice
                        </Button>
                      )}
                    </Stack>
                  );
                },
              },
            ]}
          />

          {/* PO Advance Payment Dialog */}
          <Dialog open={Boolean(payingPo)} onClose={() => setPayingPo(null)} maxWidth="xs" fullWidth>
            <DialogTitle>Advance Payment — {payingPo?.orderNo}</DialogTitle>
            <DialogContent>
              {payingPo && (() => {
                const total     = payingPo.lines.reduce((s, l) => s + Number(l.unitCost) * Number(l.quantityOrdered), 0);
                const advance   = Number(payingPo.paymentsSumAmount ?? 0);
                const remaining = Math.max(0, total - advance);
                return (
                  <Stack spacing={2} mt={1}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Supplier</Typography>
                      <Typography variant="body1" fontWeight={600}>{payingPo.supplier?.name ?? '—'}</Typography>
                    </Box>
                    <Divider />
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">PO Total</Typography>
                      <Typography variant="body2">${total.toFixed(2)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Advances Already Paid</Typography>
                      <Typography variant="body2" color="success.main">${advance.toFixed(2)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Remaining</Typography>
                      <Typography variant="body2" fontWeight={700} color={remaining > 0 ? 'error.main' : 'text.secondary'}>
                        ${remaining.toFixed(2)}
                      </Typography>
                    </Stack>
                    <Divider />
                    <TextField
                      label="Payment Amount"
                      type="number"
                      value={poPayForm.amount}
                      onChange={(e) => setPoPayForm({ ...poPayForm, amount: e.target.value })}
                      InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                      inputProps={{ min: 0.01, step: '0.01' }}
                      helperText="Advance payment — automatically applied to the invoice when goods are received"
                      fullWidth
                    />
                    <TextField
                      select
                      label="Payment Method"
                      value={poPayForm.method}
                      onChange={(e) => setPoPayForm({ ...poPayForm, method: e.target.value })}
                      fullWidth
                    >
                      <MenuItem value="cash">Cash</MenuItem>
                      <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                      <MenuItem value="cheque">Cheque</MenuItem>
                      <MenuItem value="card">Card</MenuItem>
                    </TextField>
                  </Stack>
                );
              })()}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPayingPo(null)}>Cancel</Button>
              <Button
                variant="contained"
                disabled={!poPayForm.amount || parseFloat(poPayForm.amount) <= 0 || payPoMutation.isPending}
                onClick={() =>
                  payingPo && payPoMutation.mutate({ id: payingPo.id, amount: poPayForm.amount, method: poPayForm.method })
                }
              >
                {payPoMutation.isPending ? 'Recording…' : 'Record Payment'}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}

      {tab === 1 && (
        <Box>
          <Stack spacing={2} mb={3} maxWidth={600}>
            <TextField
              select
              label="Linked Purchase Order (optional)"
              value={grPoId}
              onChange={(e) => handleSelectGrPo(e.target.value)}
              helperText="Selecting a PO fills in its remaining (not-yet-received) lines automatically."
            >
              <MenuItem value="">None — receive items without a PO</MenuItem>
              {(purchaseOrdersQuery.data ?? [])
                .filter((po) => po.status !== 'received')
                .map((po) => (
                  <MenuItem key={po.id} value={po.id}>
                    {po.orderNo}
                  </MenuItem>
                ))}
            </TextField>
            {lineEditor(grLines, setGrLines, true)}
            <PrimaryButton
              disabled={grLines.length === 0 || createGrMutation.isPending}
              onClick={() => createGrMutation.mutate()}
              sx={{ alignSelf: 'flex-start' }}
            >
              Post Goods Receipt
            </PrimaryButton>
            <Typography variant="caption" color="text.secondary">
              Posting here is what actually adds the items to stock — you'll see the quantities update
              immediately in Catalog and the POS grid.
            </Typography>
          </Stack>
          <DataTable
            searchPlaceholder="Search goods receipts…"
            emptyMessage="No goods receipts yet."
            getRowId={(gr: GoodsReceipt) => gr.id}
            rows={goodsReceiptsQuery.data ?? []}
            getSearchText={(gr) => `${gr.receiptNo} ${gr.status} ${gr.purchaseOrder?.orderNo ?? ''}`}
            columns={[
              { key: 'receiptNo', label: 'Receipt No', sortable: true, render: (gr) => gr.receiptNo },
              {
                key: 'poRef',
                label: 'PO Ref',
                render: (gr) =>
                  gr.purchaseOrder?.orderNo ? (
                    <Typography variant="body2" fontWeight={600} color="primary.main">
                      {gr.purchaseOrder.orderNo}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.disabled">No PO</Typography>
                  ),
              },
              { key: 'status', label: 'Status', sortable: true, render: (gr) => formatEnumLabel(gr.status) },
              {
                key: 'lines',
                label: 'Items Received',
                render: (gr) => {
                  const products = productsQuery.data ?? [];
                  return gr.lines
                    .map((l) => {
                      const name = products.find((p) => p.id === l.productId)?.name ?? l.productId;
                      return `${name} (${l.quantityReceived})`;
                    })
                    .join(', ');
                },
              },
              {
                key: 'receivedAt',
                label: 'Received',
                sortable: true,
                sortValue: (gr) => new Date(gr.receivedAt).getTime(),
                render: (gr) => new Date(gr.receivedAt).toLocaleString(),
              },
            ]}
          />
        </Box>
      )}

      {tab === 2 && (
        <Box>
          <Stack spacing={2} mb={3} maxWidth={500}>
            <Autocomplete
              options={suppliersQuery.data ?? []}
              getOptionLabel={(o) => o.name}
              value={siSupplier}
              onChange={(_, v) => setSiSupplier(v)}
              renderInput={(params) => <TextField {...params} label="Supplier" />}
            />
            <TextField label="Invoice No" value={siForm.invoiceNo} onChange={(e) => setSiForm({ ...siForm, invoiceNo: e.target.value })} />
            <TextField label="Amount" value={siForm.amount} onChange={(e) => setSiForm({ ...siForm, amount: e.target.value })} />
            <TextField
              label="Due Date"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={siForm.dueDate}
              onChange={(e) => setSiForm({ ...siForm, dueDate: e.target.value })}
            />
            <PrimaryButton
              disabled={!siSupplier || !siForm.invoiceNo || !siForm.amount || createSiMutation.isPending}
              onClick={() => createSiMutation.mutate()}
              sx={{ alignSelf: 'flex-start' }}
            >
              Record Supplier Invoice
            </PrimaryButton>
          </Stack>
          <DataTable
            searchPlaceholder="Search supplier invoices…"
            emptyMessage="No supplier invoices yet."
            getRowId={(inv: SupplierInvoice) => inv.id}
            rows={supplierInvoicesQuery.data ?? []}
            getSearchText={(inv) => `${inv.invoiceNo} ${inv.status} ${inv.supplier?.name ?? ''} ${inv.goodsReceipt?.receiptNo ?? ''} ${inv.goodsReceipt?.purchaseOrder?.orderNo ?? ''}`}
            columns={[
              { key: 'invoiceNo', label: 'Invoice No', sortable: true, render: (inv) => inv.invoiceNo },
              {
                key: 'supplier',
                label: 'Supplier',
                sortable: true,
                render: (inv) => inv.supplier?.name ?? '—',
              },
              {
                key: 'poRef',
                label: 'PO Ref',
                render: (inv) =>
                  inv.goodsReceipt?.purchaseOrder?.orderNo ? (
                    <Typography variant="body2" fontWeight={600} color="primary.main">
                      {inv.goodsReceipt.purchaseOrder.orderNo}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.disabled">Manual</Typography>
                  ),
              },
              {
                key: 'grRef',
                label: 'GR Ref',
                render: (inv) =>
                  inv.goodsReceipt?.receiptNo ? (
                    <Typography variant="body2" color="text.secondary">{inv.goodsReceipt.receiptNo}</Typography>
                  ) : (
                    <Typography variant="body2" color="text.disabled">—</Typography>
                  ),
              },
              {
                key: 'amount',
                label: 'Total',
                align: 'right',
                sortable: true,
                sortValue: (inv) => Number(inv.amount),
                render: (inv) => `$${Number(inv.amount).toFixed(2)}`,
              },
              {
                key: 'amountPaid',
                label: 'Paid',
                align: 'right',
                sortable: true,
                sortValue: (inv) => Number(inv.amountPaid),
                render: (inv) => `$${Number(inv.amountPaid).toFixed(2)}`,
              },
              {
                key: 'outstanding',
                label: 'Outstanding',
                align: 'right',
                sortable: true,
                sortValue: (inv) => Number(inv.amount) - Number(inv.amountPaid),
                render: (inv) => {
                  const outstanding = Number(inv.amount) - Number(inv.amountPaid);
                  return (
                    <Typography
                      variant="body2"
                      color={outstanding > 0 ? 'error.main' : 'text.secondary'}
                      fontWeight={outstanding > 0 ? 600 : 400}
                    >
                      ${outstanding.toFixed(2)}
                    </Typography>
                  );
                },
              },
              {
                key: 'status',
                label: 'Status',
                sortable: true,
                render: (inv) => {
                  const colorMap: Record<string, 'error' | 'warning' | 'success' | 'default'> = {
                    unpaid: 'error',
                    partially_paid: 'warning',
                    paid: 'success',
                  };
                  return (
                    <Chip
                      size="small"
                      label={formatEnumLabel(inv.status)}
                      color={colorMap[inv.status] ?? 'default'}
                    />
                  );
                },
              },
              {
                key: 'actions',
                label: '',
                render: (inv) =>
                  inv.status !== 'paid' && inv.status !== 'voided' ? (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        const outstanding = (Number(inv.amount) - Number(inv.amountPaid)).toFixed(2);
                        setPayingInvoice(inv);
                        setPayForm({ amount: outstanding, method: 'cash' });
                      }}
                    >
                      Pay
                    </Button>
                  ) : null,
              },
            ]}
          />

          {/* Payment Dialog */}
          <Dialog
            open={Boolean(payingInvoice)}
            onClose={() => setPayingInvoice(null)}
            maxWidth="xs"
            fullWidth
          >
            <DialogTitle>Record Payment</DialogTitle>
            <DialogContent>
              {payingInvoice && (
                <Stack spacing={2} mt={1}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Invoice</Typography>
                    <Typography variant="body1" fontWeight={600}>{payingInvoice.invoiceNo}</Typography>
                    {payingInvoice.supplier && (
                      <Typography variant="body2" color="text.secondary">{payingInvoice.supplier.name}</Typography>
                    )}
                  </Box>
                  <Divider />
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Invoice Total</Typography>
                    <Typography variant="body2">${Number(payingInvoice.amount).toFixed(2)}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Already Paid</Typography>
                    <Typography variant="body2">${Number(payingInvoice.amountPaid).toFixed(2)}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Outstanding</Typography>
                    <Typography variant="body2" fontWeight={700} color="error.main">
                      ${(Number(payingInvoice.amount) - Number(payingInvoice.amountPaid)).toFixed(2)}
                    </Typography>
                  </Stack>
                  <Divider />
                  <TextField
                    label="Payment Amount"
                    type="number"
                    value={payForm.amount}
                    onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                    InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                    inputProps={{ min: 0.01, step: '0.01', max: Number(payingInvoice.amount) - Number(payingInvoice.amountPaid) }}
                    helperText="Enter a partial amount to record a partial payment"
                    fullWidth
                  />
                  <TextField
                    select
                    label="Payment Method"
                    value={payForm.method}
                    onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}
                    fullWidth
                  >
                    <MenuItem value="cash">Cash</MenuItem>
                    <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                    <MenuItem value="cheque">Cheque</MenuItem>
                    <MenuItem value="card">Card</MenuItem>
                  </TextField>
                </Stack>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPayingInvoice(null)}>Cancel</Button>
              <Button
                variant="contained"
                disabled={!payForm.amount || parseFloat(payForm.amount) <= 0 || payInvoiceMutation.isPending}
                onClick={() =>
                  payingInvoice &&
                  payInvoiceMutation.mutate({
                    id: payingInvoice.id,
                    amount: payForm.amount,
                    method: payForm.method,
                  })
                }
              >
                {payInvoiceMutation.isPending ? 'Recording…' : 'Record Payment'}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}

      {tab === 3 && (
        <Box>
          <Stack spacing={2} mb={3} maxWidth={500}>
            <Autocomplete
              options={suppliersQuery.data ?? []}
              getOptionLabel={(o) => o.name}
              value={spSupplier}
              onChange={(_, v) => setSpSupplier(v)}
              renderInput={(params) => <TextField {...params} label="Supplier" />}
            />
            <TextField label="Amount" value={spAmount} onChange={(e) => setSpAmount(e.target.value)} />
            <Typography variant="caption" color="text.secondary">
              Allocated automatically (FIFO) against the supplier's oldest unpaid invoices.
            </Typography>
            <PrimaryButton
              disabled={!spSupplier || !spAmount || createSpMutation.isPending}
              onClick={() => createSpMutation.mutate()}
              sx={{ alignSelf: 'flex-start' }}
            >
              Record Payment
            </PrimaryButton>
          </Stack>
          <DataTable
            searchPlaceholder="Search payments…"
            emptyMessage="No supplier payments yet."
            getRowId={(p: SupplierPayment) => p.id}
            rows={supplierPaymentsQuery.data ?? []}
            getSearchText={(p) => `${p.method} ${p.supplier?.name ?? ''} ${p.purchaseOrder?.orderNo ?? ''} ${(p.allocations ?? []).map((a) => a.supplierInvoice?.invoiceNo ?? '').join(' ')}`}
            columns={[
              {
                key: 'paidAt',
                label: 'Date',
                sortable: true,
                sortValue: (p) => new Date(p.paidAt).getTime(),
                render: (p) => new Date(p.paidAt).toLocaleString(),
              },
              {
                key: 'supplier',
                label: 'Supplier',
                sortable: true,
                render: (p) => p.supplier?.name ?? '—',
              },
              {
                key: 'reference',
                label: 'PO / Invoice Reference',
                render: (p) => {
                  // Collect all PO numbers: direct (advance) + through invoice chain
                  const poNos = new Set<string>();
                  const invNos = new Set<string>();

                  if (p.purchaseOrder?.orderNo) poNos.add(p.purchaseOrder.orderNo);

                  for (const alloc of p.allocations ?? []) {
                    if (alloc.supplierInvoice?.invoiceNo) invNos.add(alloc.supplierInvoice.invoiceNo);
                    const chainPo = alloc.supplierInvoice?.goodsReceipt?.purchaseOrder?.orderNo;
                    if (chainPo) poNos.add(chainPo);
                  }

                  if (poNos.size === 0 && invNos.size === 0) {
                    return <Typography variant="body2" color="text.disabled">No Reference</Typography>;
                  }

                  return (
                    <Stack spacing={0.5}>
                      {[...poNos].map((no) => (
                        <Stack key={no} direction="row" spacing={0.5} alignItems="center">
                          <Chip size="small" label={no} color="info" />
                          <Typography variant="caption" color="text.secondary">PO</Typography>
                        </Stack>
                      ))}
                      {[...invNos].map((no) => (
                        <Stack key={no} direction="row" spacing={0.5} alignItems="center">
                          <Chip size="small" label={no} color="primary" />
                          <Typography variant="caption" color="text.secondary">Invoice</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  );
                },
              },
              { key: 'method', label: 'Method', sortable: true, render: (p) => formatEnumLabel(p.method) },
              {
                key: 'amount',
                label: 'Amount',
                align: 'right',
                sortable: true,
                sortValue: (p) => Number(p.amount),
                render: (p) => (
                  <Typography variant="body2" fontWeight={600} color="success.main">
                    ${Number(p.amount).toFixed(2)}
                  </Typography>
                ),
              },
            ]}
          />
        </Box>
      )}

      <Snackbar open={Boolean(snackbar)} autoHideDuration={3000} onClose={() => setSnackbar(null)} message={snackbar} />
    </Box>
  );
}
