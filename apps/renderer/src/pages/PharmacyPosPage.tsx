import { useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Card, CardActionArea,
  Chip, Divider, FormControl, InputLabel, MenuItem,
  Select, Snackbar, Stack, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { CartLine, Customer, Invoice, Patient, ReceiptSettings, TenantSettings } from '../api/types';
import { SearchInput } from '../components/SearchInput';
import { AppModal } from '../components/AppModal';
import { PrintPreviewModal } from '../components/PrintPreviewModal';
import { PrimaryButton, SecondaryButton } from '../components/buttons';
import { useAuth } from '../state/auth-context';
import { useCurrency } from '../hooks/useCurrency';
import { renderReceiptHtml } from '../printing/receipt-template';

interface PharmacyProduct {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  salePrice: string;
  taxRatePct: string;
  categoryId: string | null;
  category?: { id: string; name: string };
}

type PharmacyPayment = 'cash' | 'patient_advance' | 'debit_card' | 'credit_card';

function money(v: number) { return v.toFixed(2); }

export function PharmacyPosPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const cur = useCurrency();
  const BRANCH_ID = user!.branchId;
  const WAREHOUSE_ID = user!.warehouseId;

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<PharmacyPayment>('cash');
  const [received, setReceived] = useState('');
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [printPreview, setPrintPreview] = useState<{ open: boolean; html: string; title: string }>({
    open: false, html: '', title: '',
  });

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: products = [], isLoading: loadingProducts, isError: productsError } = useQuery<PharmacyProduct[]>({
    queryKey: ['pharmacy-products'],
    queryFn: () => apiFetch('/api/v1/hospital/pharmacy/products'),
    retry: false,
  });

  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ['pharmacy-patients-all'],
    queryFn: () => apiFetch('/api/v1/hospital/patients'),
    staleTime: 30_000,
  });

  const { data: customersData = [] } = useQuery<Customer[]>({
    queryKey: ['customers-lookup'],
    queryFn: () => apiFetch('/api/v1/customers'),
    staleTime: 60_000,
  });

  const { data: tenantSettings } = useQuery<TenantSettings>({
    queryKey: ['tenant-settings'],
    queryFn: () => apiFetch('/api/v1/settings/tenant'),
  });

  const cashCustomer = useMemo(() => customersData.find(c => c.isWalkIn) ?? null, [customersData]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const categories = useMemo(() => {
    const cats = products
      .filter(p => p.category)
      .map(p => p.category!)
      .reduce<{ id: string; name: string }[]>((acc, c) => {
        if (!acc.find(x => x.id === c.id)) acc.push(c);
        return acc;
      }, []);
    return cats;
  }, [products]);

  const visible = useMemo(() => {
    let list = products;
    if (catFilter) list = list.filter(p => p.categoryId === catFilter);
    if (search) list = list.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode ?? '').toLowerCase().includes(search.toLowerCase())
    );
    return list;
  }, [products, catFilter, search]);

  const subtotal = useMemo(() =>
    cart.reduce((s, l) => s + l.quantity * Number(l.unitPrice), 0), [cart]);

  const tax = useMemo(() =>
    cart.reduce((s, l) => {
      const net = l.quantity * Number(l.unitPrice);
      return s + net * (Number(l.taxRatePct) / 100);
    }, 0), [cart]);

  const grandTotal = useMemo(() => subtotal + tax, [subtotal, tax]);
  const change = received ? Math.round((Number(received) - grandTotal) * 100) / 100 : 0;

  const patientBalance = Number(patient?.currentBalance ?? 0);

  // ── Cart helpers ───────────────────────────────────────────────────────────

  function addToCart(product: PharmacyProduct) {
    setCart(prev => {
      const existing = prev.find(l => l.productId === product.id);
      if (existing) {
        return prev.map(l =>
          l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        quantity: 1,
        unitPrice: product.salePrice,
        taxRatePct: product.taxRatePct,
        discountValue: '0',
      }];
    });
  }

  function updateQty(productId: string, delta: number) {
    setCart(prev =>
      prev.map(l => l.productId === productId ? { ...l, quantity: l.quantity + delta } : l)
        .filter(l => l.quantity > 0)
    );
  }

  function removeItem(productId: string) {
    setCart(prev => prev.filter(l => l.productId !== productId));
  }

  function resetCart() {
    setCart([]);
    setPatient(null);
    setReceived('');
    setPayMethod('cash');
  }

  // ── Create invoice ─────────────────────────────────────────────────────────

  const createSale = useMutation({
    mutationFn: () => {
      const payments = payMethod === 'patient_advance'
        ? [{ method: 'patient_advance', amount: money(grandTotal) }]
        : [{ method: payMethod, amount: money(grandTotal) }];

      return apiFetch<Invoice>('/api/v1/invoices', {
        method: 'POST',
        body: JSON.stringify({
          branchId: BRANCH_ID,
          warehouseId: WAREHOUSE_ID,
          customerId: cashCustomer?.id,
          patientId: patient?.id ?? null,
          lines: cart.map(line => ({
            productId: line.productId,
            quantity: String(line.quantity),
            unitPrice: line.unitPrice,
            discountValue: '0',
            taxAmount: String(
              Math.round(line.quantity * Number(line.unitPrice) * (Number(line.taxRatePct) / 100) * 100) / 100
            ),
          })),
          invoiceDiscountValue: '0',
          payments,
          currencyCode: tenantSettings?.baseCurrency,
        }),
      });
    },
    onSuccess: async (invoice: Invoice) => {
      setSnackbar('Sale completed.');
      resetCart();
      setPaymentOpen(false);
      qc.invalidateQueries({ queryKey: ['pharmacy-products'] });
      qc.invalidateQueries({ queryKey: ['pharmacy-patients-all'] });
      // Print is best-effort — a failure here must never be surfaced as a sale failure.
      try {
        await openReceiptPreview(invoice.id);
      } catch {
        // ignored
      }
    },
    onError: (e: ApiError) => setSnackbar(e.detail ?? e.message ?? 'Sale failed.'),
  });

  async function openReceiptPreview(invoiceId: string): Promise<void> {
    const [detail, receiptSettings] = await Promise.all([
      apiFetch<Invoice>(`/api/v1/invoices/${invoiceId}`),
      apiFetch<ReceiptSettings>('/api/v1/settings/receipt-settings'),
    ]);
    const html = renderReceiptHtml({
      invoice: detail,
      branchName: user!.branchName ?? '',
      headerText: receiptSettings.headerText,
      footerText: receiptSettings.footerText,
      paperWidthMm: receiptSettings.paperWidthMm,
    });
    setPrintPreview({ open: true, html, title: `Pharmacy Receipt — ${detail.invoiceNo}` });
  }

  return (
    <Box display="flex" height="100vh" overflow="hidden">
      {/* ── Left: Products ──────────────────────────────────────────────── */}
      <Box flex={1} display="flex" flexDirection="column" overflow="hidden" p={2} pr={1}>
        <Stack direction="row" alignItems="center" spacing={1} mb={1}>
          <LocalPharmacyIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>Pharmacy POS</Typography>
        </Stack>

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search medicines…"
          sx={{ mb: 1 }}
        />

        {/* Category filters */}
        <Stack direction="row" spacing={1} mb={1} flexWrap="wrap">
          <Chip label="All" size="small" variant={catFilter === '' ? 'filled' : 'outlined'} color="primary" onClick={() => setCatFilter('')} />
          {categories.map(c => (
            <Chip key={c.id} label={c.name} size="small" variant={catFilter === c.id ? 'filled' : 'outlined'} onClick={() => setCatFilter(c.id)} />
          ))}
        </Stack>

        {/* Product grid */}
        <Box flex={1} overflow="auto">
          {loadingProducts ? (
            <Typography color="text.secondary" p={2}>Loading…</Typography>
          ) : productsError ? (
            <Alert severity="error" sx={{ m: 1 }}>
              Could not load pharmacy products. Make sure the lab/pharmacy database migration has been run.
            </Alert>
          ) : visible.length === 0 ? (
            <Alert severity="info" sx={{ m: 1 }}>
              No pharmacy products found. Go to <strong>Pharmacy Settings</strong> to mark categories as pharmacy.
            </Alert>
          ) : (
            <Box display="grid" gridTemplateColumns="repeat(auto-fill, minmax(150px, 1fr))" gap={1}>
              {visible.map(product => (
                <Card key={product.id} variant="outlined" sx={{ cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }} onClick={() => addToCart(product)}>
                  <CardActionArea sx={{ p: 1.5, height: '100%' }}>
                    <Typography variant="body2" fontWeight={600} noWrap>{product.name}</Typography>
                    {product.category && (
                      <Typography variant="caption" color="text.secondary" display="block">{product.category.name}</Typography>
                    )}
                    <Typography variant="body1" color="primary" fontWeight={700} mt={0.5}>
                      {cur.fmt(Number(product.salePrice))}
                    </Typography>
                  </CardActionArea>
                </Card>
              ))}
            </Box>
          )}
        </Box>
      </Box>

      {/* ── Right: Cart ─────────────────────────────────────────────────── */}
      <Box width={340} display="flex" flexDirection="column" borderLeft={1} borderColor="divider" p={2} overflow="hidden">

        {/* Patient autocomplete — loads all patients, same as regular POS */}
        <Autocomplete
          size="small"
          fullWidth
          options={patients}
          getOptionLabel={p =>
            `${p.name}${patientBalance > 0 && patient?.id === p.id ? ` (Advance: ${cur.fmt(patientBalance)})` : p.currentBalance && Number(p.currentBalance) > 0 ? ` (Advance: ${cur.fmt(Number(p.currentBalance))})` : ''}`
          }
          value={patient}
          onChange={(_, value) => { setPatient(value); setPayMethod('cash'); }}
          renderInput={params => <TextField {...params} label="Patient (optional)" placeholder="Search by name or phone…" />}
          filterOptions={(opts, state) => {
            const q = state.inputValue.toLowerCase();
            return opts.filter(p =>
              p.name.toLowerCase().includes(q) || (p.phone ?? '').toLowerCase().includes(q)
            );
          }}
          sx={{ mb: 1 }}
        />

        <Divider sx={{ mb: 1 }} />

        {/* Cart items */}
        <Box flex={1} overflow="auto">
          {cart.length === 0 ? (
            <Typography variant="body2" color="text.secondary" p={1}>Cart is empty — tap a product to add</Typography>
          ) : (
            cart.map(line => (
              <Box key={line.productId} mb={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Typography variant="body2" fontWeight={600} sx={{ flex: 1, mr: 1 }}>{line.name}</Typography>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <RemoveIcon fontSize="small" sx={{ cursor: 'pointer', color: 'text.secondary' }} onClick={() => updateQty(line.productId, -1)} />
                    <Typography variant="body2" minWidth={20} textAlign="center">{line.quantity}</Typography>
                    <AddIcon fontSize="small" sx={{ cursor: 'pointer', color: 'text.secondary' }} onClick={() => updateQty(line.productId, 1)} />
                    <DeleteOutlineIcon fontSize="small" sx={{ cursor: 'pointer', color: 'error.main', ml: 0.5 }} onClick={() => removeItem(line.productId)} />
                  </Stack>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">{cur.fmt(Number(line.unitPrice))} × {line.quantity}</Typography>
                  <Typography variant="body2">{cur.fmt(line.quantity * Number(line.unitPrice))}</Typography>
                </Stack>
              </Box>
            ))
          )}
        </Box>

        <Divider sx={{ my: 1 }} />

        {/* Totals */}
        <Stack spacing={0.5} mb={2}>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">Subtotal</Typography>
            <Typography variant="body2">{cur.fmt(subtotal)}</Typography>
          </Stack>
          {tax > 0 && (
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Tax</Typography>
              <Typography variant="body2">{cur.fmt(tax)}</Typography>
            </Stack>
          )}
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="subtitle1" fontWeight={700}>Total</Typography>
            <Typography variant="subtitle1" fontWeight={700} color="primary">{cur.fmt(grandTotal)}</Typography>
          </Stack>
        </Stack>

        <Button variant="contained" color="primary" size="large" fullWidth disabled={cart.length === 0} onClick={() => setPaymentOpen(true)}>
          Checkout
        </Button>
        {cart.length > 0 && (
          <Button size="small" color="error" fullWidth sx={{ mt: 0.5 }} onClick={resetCart}>Clear Cart</Button>
        )}
      </Box>

      {/* ── Payment Dialog ─────────────────────────────────────────────── */}
      <AppModal open={paymentOpen} onClose={() => setPaymentOpen(false)} title="Pharmacy Payment" maxWidth="xs">
        <Stack spacing={2} mt={1}>
          <Typography variant="h6" fontWeight={700}>Total: {cur.fmt(grandTotal)}</Typography>
          {patient && (
            <Alert severity={patientBalance > 0 ? 'success' : 'info'}>
              Patient: <strong>{patient.name}</strong>
              {patientBalance > 0 ? ` · Advance balance: ${cur.fmt(patientBalance)}` : ' · No advance balance'}
            </Alert>
          )}

          <FormControl fullWidth>
            <InputLabel>Payment Method</InputLabel>
            <Select value={payMethod} label="Payment Method" onChange={e => { setPayMethod(e.target.value as PharmacyPayment); setReceived(''); }}>
              <MenuItem value="cash">Cash</MenuItem>
              <MenuItem value="debit_card">Debit Card</MenuItem>
              <MenuItem value="credit_card">Credit Card</MenuItem>
              {patient && patientBalance > 0 && (
                <MenuItem value="patient_advance">
                  Deduct from Patient Advance (Balance: {cur.fmt(patientBalance)})
                </MenuItem>
              )}
            </Select>
          </FormControl>

          {payMethod === 'cash' && (
            <>
              <TextField
                label="Amount Received"
                type="number"
                value={received}
                onChange={e => setReceived(e.target.value)}
                fullWidth
                autoFocus
              />
              {received && Number(received) >= grandTotal && (
                <Alert severity="success">Change: {cur.fmt(change)}</Alert>
              )}
              {received && Number(received) < grandTotal && (
                <Alert severity="error">Short by {cur.fmt(grandTotal - Number(received))}</Alert>
              )}
            </>
          )}

          {payMethod === 'patient_advance' && (
            <Alert severity={patientBalance >= grandTotal ? 'success' : 'error'}>
              {patientBalance >= grandTotal
                ? `${cur.fmt(grandTotal)} will be deducted from advance balance.`
                : `Insufficient balance — available: ${cur.fmt(patientBalance)}`}
            </Alert>
          )}
        </Stack>

        <Stack direction="row" spacing={1} mt={2} justifyContent="flex-end">
          <SecondaryButton onClick={() => setPaymentOpen(false)}>Cancel</SecondaryButton>
          <PrimaryButton
            onClick={() => createSale.mutate()}
            disabled={
              createSale.isPending ||
              (payMethod === 'cash' && (!received || Number(received) < grandTotal)) ||
              (payMethod === 'patient_advance' && (!patient || patientBalance < grandTotal))
            }
          >
            {createSale.isPending ? 'Processing…' : 'Complete Sale'}
          </PrimaryButton>
        </Stack>
      </AppModal>

      <Snackbar open={!!snackbar} autoHideDuration={3000} onClose={() => setSnackbar(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={/fail|error|forbidden|permission|denied/i.test(snackbar ?? '') ? 'error' : 'success'} onClose={() => setSnackbar(null)}>
          {snackbar}
        </Alert>
      </Snackbar>

      <PrintPreviewModal
        open={printPreview.open}
        title={printPreview.title}
        html={printPreview.html}
        onClose={() => setPrintPreview(p => ({ ...p, open: false }))}
      />
    </Box>
  );
}
