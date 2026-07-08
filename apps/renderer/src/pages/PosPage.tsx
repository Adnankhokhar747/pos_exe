import { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Divider,
  Grid,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { CartLine, Currency, Customer, Invoice, InvoiceLine, Patient, ProductWithStock, ReceiptSettings, TenantSettings } from '../api/types';
import { SearchInput } from '../components/SearchInput';
import { AppModal } from '../components/AppModal';
import { DataTable } from '../components/DataTable';
import { PrintPreviewModal } from '../components/PrintPreviewModal';
import { PrimaryButton, SecondaryButton, DangerButton, SuccessButton } from '../components/buttons';
import { formatEnumLabel } from '../utils/format';
import { renderReceiptHtml } from '../printing/receipt-template';
import { useAuth } from '../state/auth-context';

// Mirrors CustomersService.LOYALTY_REDEMPTION_VALUE on the backend — 100 points = 1
// currency unit of discount — so the cashier sees an accurate total before submitting.
const LOYALTY_REDEMPTION_VALUE = 0.01;

function money(value: number): string {
  return value.toFixed(2);
}

type StockTier = 'out' | 'low' | 'in';

function stockTier(qty: number): StockTier {
  if (qty <= 0) return 'out';
  if (qty <= 5) return 'low';
  return 'in';
}

const STOCK_TIER_COLOR: Record<StockTier, 'error' | 'warning' | 'success'> = {
  out: 'error',
  low: 'warning',
  in: 'success',
};

const STOCK_TIER_LABEL: Record<StockTier, string> = {
  out: 'Out of Stock',
  low: 'Low Stock',
  in: 'In Stock',
};

function invoiceStatusColor(status: string): 'default' | 'success' | 'error' | 'warning' {
  if (status === 'voided') return 'error';
  if (status === 'held') return 'warning';
  if (status === 'completed') return 'success';
  return 'default';
}

export function PosPage(): JSX.Element {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const ACTIVE_BRANCH_ID = user!.branchId;
  const ACTIVE_BRANCH_NAME = user!.branchName;
  const ACTIVE_WAREHOUSE_ID = user!.warehouseId;
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [invoiceDiscount, setInvoiceDiscount] = useState('0');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<
    'cash' | 'debit_card' | 'credit_card' | 'bank_transfer' | 'mobile_wallet' | 'credit_sale' | 'store_credit' | 'gift_card'
  >('cash');
  const [receivedAmount, setReceivedAmount] = useState('');
  const [giftCardCode, setGiftCardCode] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState('');
  const [currencyCode, setCurrencyCode] = useState('');
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddPhone, setQuickAddPhone] = useState('');

  const [linkedPatient, setLinkedPatient] = useState<Patient | null>(null);
  const [patientAdvanceAmount, setPatientAdvanceAmount] = useState('');

  const [heldOpen, setHeldOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<Invoice | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [returnTarget, setReturnTarget] = useState<Invoice | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, string>>({});
  const [printPreview, setPrintPreview] = useState<{ open: boolean; html: string; title: string }>({
    open: false,
    html: '',
    title: '',
  });

  const productsQuery = useQuery({
    queryKey: ['pos-grid', search],
    queryFn: () =>
      apiFetch<ProductWithStock[]>(
        `/api/v1/products/pos-grid?warehouseId=${ACTIVE_WAREHOUSE_ID}&search=${encodeURIComponent(search)}`,
      ),
  });

  const customersQuery = useQuery({
    queryKey: ['customers-lookup'],
    queryFn: () => apiFetch<Customer[]>('/api/v1/customers'),
  });

  const patientsQuery = useQuery({
    queryKey: ['patients-pos-lookup'],
    queryFn: () => apiFetch<Patient[]>('/api/v1/hospital/patients'),
    retry: false,
  });

  const cashCustomer = useMemo(
    () => customersQuery.data?.find((c) => c.isWalkIn) ?? null,
    [customersQuery.data],
  );

  // Cashiers should never be forced to pick/create a customer before checking out —
  // every tenant is seeded with one isWalkIn "Cash Customer" for exactly this purpose.
  useEffect(() => {
    if (!customer && cashCustomer) {
      setCustomer(cashCustomer);
    }
  }, [customer, cashCustomer]);

  const heldQuery = useQuery({
    queryKey: ['held-invoices'],
    queryFn: () => apiFetch<Invoice[]>(`/api/v1/invoices/held?branchId=${ACTIVE_BRANCH_ID}`),
    enabled: heldOpen,
  });

  const recentQuery = useQuery({
    queryKey: ['recent-invoices'],
    queryFn: () => apiFetch<Invoice[]>(`/api/v1/invoices?branchId=${ACTIVE_BRANCH_ID}`),
    enabled: recentOpen,
  });

  const returnTargetLinesQuery = useQuery({
    queryKey: ['invoice-detail', returnTarget?.id],
    queryFn: () =>
      apiFetch<Invoice & { lines: InvoiceLine[] }>(`/api/v1/invoices/${returnTarget?.id}`),
    enabled: Boolean(returnTarget),
  });

  const currenciesQuery = useQuery({
    queryKey: ['currencies'],
    queryFn: () => apiFetch<Currency[]>('/api/v1/currencies'),
  });

  const tenantSettingsQuery = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: () => apiFetch<TenantSettings>('/api/v1/settings/tenant'),
  });

  useEffect(() => {
    if (tenantSettingsQuery.data && !currencyCode) {
      setCurrencyCode(tenantSettingsQuery.data.baseCurrency);
    }
  }, [tenantSettingsQuery.data, currencyCode]);

  const createCustomerMutation = useMutation({
    mutationFn: () =>
      apiFetch<Customer>('/api/v1/customers', {
        method: 'POST',
        body: JSON.stringify({ name: quickAddName, phone: quickAddPhone || undefined }),
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['customers-lookup'] });
      setCustomer(created);
      setQuickAddOpen(false);
      setQuickAddName('');
      setQuickAddPhone('');
      setSnackbar('Customer added.');
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not add customer.'),
  });

  const baseTotals = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;
    let lineDiscountTotal = 0;

    for (const line of cart) {
      const gross = line.quantity * Number(line.unitPrice);
      const discount = Number(line.discountValue || '0');
      const net = gross - discount;
      const tax = (net * Number(line.taxRatePct)) / 100;
      subtotal += gross;
      lineDiscountTotal += discount;
      taxTotal += tax;
    }

    const discountTotal = lineDiscountTotal + Number(invoiceDiscount || '0');
    const grandTotal = subtotal - discountTotal + taxTotal;
    return { subtotal, discountTotal, taxTotal, grandTotal };
  }, [cart, invoiceDiscount]);

  const couponDiscount = appliedCoupon?.discount ?? 0;
  const loyaltyDiscount = Number(loyaltyPointsToRedeem || '0') * LOYALTY_REDEMPTION_VALUE;
  const totals = useMemo(() => {
    const grandTotal = Math.max(0, baseTotals.grandTotal - couponDiscount - loyaltyDiscount);
    return { ...baseTotals, grandTotal };
  }, [baseTotals, couponDiscount, loyaltyDiscount]);

  // Rounded to the cent: totals.grandTotal is the result of several chained float
  // operations (tax/discount/coupon/loyalty), so an exact-payment comparison against
  // an unrounded difference can land on a sub-cent epsilon like -1e-13 instead of 0,
  // which would incorrectly flag the payment as short and block checkout.
  const change = receivedAmount ? Math.round((Number(receivedAmount) - totals.grandTotal) * 100) / 100 : 0;

  function resetCart(): void {
    setCart([]);
    setInvoiceDiscount('0');
    setCustomer(cashCustomer);
    setReceivedAmount('');
    setPaymentMethod('cash');
    setCouponCode('');
    setAppliedCoupon(null);
    setLoyaltyPointsToRedeem('');
    setGiftCardCode('');
    setCurrencyCode(tenantSettingsQuery.data?.baseCurrency ?? '');
    setLinkedPatient(null);
    setPatientAdvanceAmount('');
  }

  function buildPosPayments(grandTotal: number) {
    const advAmt = Math.min(Number(patientAdvanceAmount) || 0, grandTotal);
    const remaining = grandTotal - advAmt;
    const payments = [];
    if (advAmt > 0 && linkedPatient) {
      payments.push({ method: 'patient_advance', amount: money(advAmt) });
    }
    if (remaining > 0.005) {
      payments.push({
        method: paymentMethod,
        amount: money(remaining),
        receivedAmount: remaining > 0 && paymentMethod === 'cash' ? (receivedAmount || money(remaining)) : money(remaining),
        reference: paymentMethod === 'gift_card' ? giftCardCode : undefined,
      });
    }
    if (payments.length === 0) {
      payments.push({ method: paymentMethod, amount: money(grandTotal), receivedAmount: receivedAmount || money(grandTotal) });
    }
    return payments;
  }

  const applyCouponMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ valid: boolean; discount: string }>(
        `/api/v1/coupons/validate?code=${encodeURIComponent(couponCode)}&subtotal=${baseTotals.subtotal - baseTotals.discountTotal}`,
      ),
    onSuccess: (result) => {
      setAppliedCoupon({ code: couponCode, discount: Number(result.discount) });
      setSnackbar('Coupon applied.');
    },
    onError: (error) => {
      setAppliedCoupon(null);
      setSnackbar(error instanceof ApiError ? error.detail : 'Invalid coupon.');
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: () =>
      apiFetch<Invoice>('/api/v1/invoices', {
        method: 'POST',
        body: JSON.stringify({
          branchId: ACTIVE_BRANCH_ID,
          warehouseId: ACTIVE_WAREHOUSE_ID,
          customerId: customer?.id,
          patientId: linkedPatient?.id,
          lines: cart.map((line) => ({
            productId: line.productId,
            quantity: String(line.quantity),
            unitPrice: line.unitPrice,
            discountValue: line.discountValue,
            serialNumbers: line.trackSerials ? line.serialNumbers ?? [] : undefined,
          })),
          invoiceDiscountValue: invoiceDiscount,
          payments: buildPosPayments(totals.grandTotal),
          couponCode: appliedCoupon?.code,
          loyaltyPointsToRedeem: loyaltyPointsToRedeem || undefined,
          currencyCode: currencyCode || undefined,
        }),
      }),
    onSuccess: async (invoice) => {
      setSnackbar('Sale completed.');
      resetCart();
      setPaymentOpen(false);
      queryClient.invalidateQueries({ queryKey: ['pos-grid'] });
      queryClient.invalidateQueries({ queryKey: ['customers-lookup'] });
      // A failure to build/open the print preview must never be surfaced as a sale failure —
      // the sale has already succeeded at this point.
      try {
        await openReceiptPreview(invoice.id);
      } catch {
        // ignored — printing is best-effort after a successful sale
      }
    },
    onError: (error) => {
      setSnackbar(error instanceof ApiError ? error.detail : 'Sale failed.');
    },
  });

  const holdMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/invoices/hold', {
        method: 'POST',
        body: JSON.stringify({
          branchId: ACTIVE_BRANCH_ID,
          customerId: customer?.id,
          heldLabel: `Hold ${new Date().toLocaleTimeString()}`,
          lines: cart.map((line) => ({
            productId: line.productId,
            quantity: String(line.quantity),
            unitPrice: line.unitPrice,
            discountValue: line.discountValue,
          })),
        }),
      }),
    onSuccess: () => {
      setSnackbar('Sale held.');
      resetCart();
      queryClient.invalidateQueries({ queryKey: ['held-invoices'] });
    },
    onError: (error) => {
      setSnackbar(error instanceof ApiError ? error.detail : 'Could not hold sale.');
    },
  });

  const resumeMutation = useMutation({
    mutationFn: (invoice: Invoice & { lines: InvoiceLine[] }) =>
      apiFetch(`/api/v1/invoices/${invoice.id}/resume`, { method: 'POST' }).then(() => invoice),
    onSuccess: (invoice) => {
      setCart(
        invoice.lines.map((line) => ({
          productId: line.productId,
          name: line.product?.name ?? 'Product',
          unitPrice: line.unitPrice,
          taxRatePct: '0',
          quantity: Number(line.quantity),
          discountValue: '0',
        })),
      );
      setHeldOpen(false);
      setSnackbar('Held sale resumed.');
      queryClient.invalidateQueries({ queryKey: ['held-invoices'] });
    },
    onError: (error) => {
      setSnackbar(error instanceof ApiError ? error.detail : 'Could not resume sale.');
    },
  });

  const voidMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/invoices/${voidTarget?.id}/void`, {
        method: 'POST',
        body: JSON.stringify({ reason: voidReason }),
      }),
    onSuccess: () => {
      setSnackbar('Invoice voided.');
      setVoidTarget(null);
      setVoidReason('');
      queryClient.invalidateQueries({ queryKey: ['recent-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['pos-grid'] });
    },
    onError: (error) => {
      setSnackbar(error instanceof ApiError ? error.detail : 'Could not void invoice.');
    },
  });

  const returnMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/invoices/${returnTarget?.id}/returns`, {
        method: 'POST',
        body: JSON.stringify({
          lines: Object.entries(returnQuantities)
            .filter(([, qty]) => Number(qty) > 0)
            .map(([invoiceLineId, quantity]) => ({ invoiceLineId, quantity })),
        }),
      }),
    onSuccess: () => {
      setSnackbar('Return processed.');
      setReturnTarget(null);
      setReturnQuantities({});
      queryClient.invalidateQueries({ queryKey: ['recent-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['pos-grid'] });
    },
    onError: (error) => {
      setSnackbar(error instanceof ApiError ? error.detail : 'Could not process return.');
    },
  });

  function addToCart(product: ProductWithStock): void {
    setCart((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (existing) {
        return current.map((line) =>
          line.productId === product.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [
        ...current,
        {
          productId: product.id,
          name: product.name,
          unitPrice: product.salePrice,
          taxRatePct: product.taxRatePct,
          quantity: 1,
          discountValue: '0',
          trackSerials: product.trackSerials,
          serialNumbers: product.trackSerials ? [] : undefined,
        },
      ];
    });
  }

  function updateQuantity(productId: string, delta: number): void {
    setCart((current) =>
      current
        .map((line) => (line.productId === productId ? { ...line, quantity: line.quantity + delta } : line))
        .filter((line) => line.quantity > 0),
    );
  }

  function updateLineDiscount(productId: string, value: string): void {
    setCart((current) =>
      current.map((line) => (line.productId === productId ? { ...line, discountValue: value } : line)),
    );
  }

  function removeLine(productId: string): void {
    setCart((current) => current.filter((line) => line.productId !== productId));
  }

  async function openReceiptPreview(invoiceId: string): Promise<void> {
    const [detail, receiptSettings] = await Promise.all([
      apiFetch<Invoice>(`/api/v1/invoices/${invoiceId}`),
      apiFetch<ReceiptSettings>('/api/v1/settings/receipt-settings'),
    ]);
    const html = renderReceiptHtml({
      invoice: detail,
      branchName: ACTIVE_BRANCH_NAME,
      headerText: receiptSettings.headerText,
      footerText: receiptSettings.footerText,
      paperWidthMm: receiptSettings.paperWidthMm,
    });
    setPrintPreview({ open: true, html, title: `Receipt — ${detail.invoiceNo}` });
  }

  async function handlePrintInvoice(invoice: Invoice): Promise<void> {
    try {
      await openReceiptPreview(invoice.id);
    } catch {
      setSnackbar('Could not load invoice for printing.');
    }
  }

  return (
    <Box display="flex" flexDirection="column" height="100%">
      <Box display="flex" flex={1} overflow="hidden" gap={2} p={2}>
        <Card variant="outlined" sx={{ flex: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box p={2} pb={1}>
            <Stack direction="row" spacing={1.5}>
              <SearchInput
                fullWidth
                placeholder="Search or scan barcode…"
                value={search}
                onChange={setSearch}
                autoFocus
              />
              <SecondaryButton onClick={() => setHeldOpen(true)}>Held Sales</SecondaryButton>
              <SecondaryButton onClick={() => setRecentOpen(true)}>Recent Sales</SecondaryButton>
            </Stack>
          </Box>
          <Box flex={1} overflow="auto" px={2} pb={2}>
            <Grid container spacing={1.5}>
              {productsQuery.data?.map((product) => {
                const qty = Number(product.quantityOnHand);
                const tier = stockTier(qty);
                return (
                  <Grid item xs={4} sm={3} key={product.id}>
                    <Card
                      variant="outlined"
                      sx={{
                        transition: 'box-shadow 0.15s, transform 0.1s',
                        '&:hover': { boxShadow: 3, transform: 'translateY(-1px)' },
                      }}
                    >
                      <CardActionArea onClick={() => addToCart(product)}>
                        <CardContent sx={{ p: 1.5 }}>
                          <Typography variant="subtitle2" noWrap title={product.name}>
                            {product.name}
                          </Typography>
                          <Typography variant="h6" sx={{ mb: 0.5 }}>
                            ${Number(product.salePrice).toFixed(2)}
                          </Typography>
                          <Chip
                            size="small"
                            label={tier === 'out' ? STOCK_TIER_LABEL.out : `${STOCK_TIER_LABEL[tier]}: ${qty}`}
                            color={STOCK_TIER_COLOR[tier]}
                          />
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                );
              })}
              {(productsQuery.data ?? []).length === 0 && (
                <Box p={3}>
                  <Typography color="text.secondary">No products match this search.</Typography>
                </Box>
              )}
            </Grid>
          </Box>
        </Card>

        <Card variant="outlined" sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Typography variant="h6" gutterBottom>
            Cart
          </Typography>
          {/* When hospital module is enabled, show patient selector only.
              Walk-in customer is still auto-applied behind the scenes. */}
          {patientsQuery.isSuccess ? (
            <Autocomplete
              size="small"
              fullWidth
              options={patientsQuery.data ?? []}
              getOptionLabel={(p) =>
                `${p.name}${Number(p.currentBalance) > 0 ? ` (Advance: ${Number(p.currentBalance).toLocaleString()})` : ''}`
              }
              value={linkedPatient}
              onChange={(_, value) => { setLinkedPatient(value); setPatientAdvanceAmount(''); }}
              renderInput={(params) => <TextField {...params} label="Patient (deduct from advance)" />}
              sx={{ mb: 1 }}
            />
          ) : (
            <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1 }}>
              <Autocomplete
                size="small"
                fullWidth
                options={customersQuery.data ?? []}
                getOptionLabel={(option) => option.name}
                value={customer}
                onChange={(_, value) => setCustomer(value)}
                renderInput={(params) => <TextField {...params} label="Customer (optional)" />}
              />
              <IconButton size="small" sx={{ mt: 0.5 }} title="Quick add customer" onClick={() => setQuickAddOpen(true)}>
                <PersonAddAlt1Icon fontSize="small" />
              </IconButton>
            </Stack>
          )}
          <Box flex={1} overflow="auto">
            {cart.length === 0 && (
              <Typography color="text.secondary" variant="body2">
                Cart is empty — select a product to begin.
              </Typography>
            )}
            <Stack spacing={0.5}>
              {cart.map((line, idx) => (
                <Box
                  key={line.productId}
                  display="flex"
                  alignItems="center"
                  gap={1}
                  sx={{
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    bgcolor: idx % 2 === 1 ? 'action.hover' : 'transparent',
                    '&:hover': { bgcolor: 'action.selected' },
                  }}
                >
                  <Box flex={1}>
                    <Typography variant="body2">{line.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      ${Number(line.unitPrice).toFixed(2)} each
                    </Typography>
                  </Box>
                  <IconButton size="small" onClick={() => updateQuantity(line.productId, -1)}>
                    <RemoveIcon fontSize="small" />
                  </IconButton>
                  <Typography>{line.quantity}</Typography>
                  <IconButton size="small" onClick={() => updateQuantity(line.productId, 1)}>
                    <AddIcon fontSize="small" />
                  </IconButton>
                  <TextField
                    size="small"
                    label="Disc."
                    value={line.discountValue}
                    onChange={(e) => updateLineDiscount(line.productId, e.target.value)}
                    sx={{ width: 70 }}
                  />
                  <IconButton size="small" onClick={() => removeLine(line.productId)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              {cart
                .filter((line) => line.trackSerials)
                .map((line) => (
                  <TextField
                    key={`serials-${line.productId}`}
                    size="small"
                    label={`Serial numbers for ${line.name} (${line.quantity} needed, comma-separated)`}
                    fullWidth
                    error={(line.serialNumbers?.length ?? 0) !== line.quantity}
                    helperText={`${line.serialNumbers?.length ?? 0} / ${line.quantity} entered`}
                    value={(line.serialNumbers ?? []).join(', ')}
                    onChange={(e) => {
                      const serials = e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean);
                      setCart((current) =>
                        current.map((l) => (l.productId === line.productId ? { ...l, serialNumbers: serials } : l)),
                      );
                    }}
                  />
                ))}
            </Stack>
          </Box>

          <Divider sx={{ my: 1 }} />
          <TextField
            size="small"
            label="Invoice discount"
            value={invoiceDiscount}
            onChange={(e) => setInvoiceDiscount(e.target.value)}
            sx={{ mb: 1 }}
          />
          <Stack direction="row" spacing={1} mb={1}>
            <TextField
              size="small"
              fullWidth
              label="Coupon code"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            />
            <SecondaryButton
              disabled={!couponCode || applyCouponMutation.isPending}
              onClick={() => applyCouponMutation.mutate()}
            >
              Apply
            </SecondaryButton>
          </Stack>
          {appliedCoupon && (
            <Stack direction="row" justifyContent="space-between" mb={1}>
              <Typography variant="body2" color="success.main">
                Coupon {appliedCoupon.code} applied
              </Typography>
              <SecondaryButton
                variant="text"
                size="small"
                onClick={() => {
                  setAppliedCoupon(null);
                  setCouponCode('');
                }}
              >
                Remove
              </SecondaryButton>
            </Stack>
          )}
          {customer && (
            <TextField
              size="small"
              fullWidth
              label={`Redeem loyalty points (${customer.loyaltyPoints} available)`}
              value={loyaltyPointsToRedeem}
              onChange={(e) => {
                const value = e.target.value;
                const max = Number(customer.loyaltyPoints);
                if (value === '' || (Number(value) >= 0 && Number(value) <= max)) {
                  setLoyaltyPointsToRedeem(value);
                }
              }}
              sx={{ mb: 1 }}
            />
          )}
          <TextField
            select
            size="small"
            fullWidth
            label="Currency"
            value={currencyCode}
            onChange={(e) => setCurrencyCode(e.target.value)}
            sx={{ mb: 1 }}
          >
            {(currenciesQuery.data ?? []).map((currency) => (
              <MenuItem key={currency.code} value={currency.code}>
                {currency.code}
              </MenuItem>
            ))}
          </TextField>
          <Stack spacing={0.5} mb={1}>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="body2">Subtotal</Typography>
              <Typography variant="body2">${money(totals.subtotal)}</Typography>
            </Box>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="body2">Discount</Typography>
              <Typography variant="body2">-${money(totals.discountTotal)}</Typography>
            </Box>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="body2">Tax</Typography>
              <Typography variant="body2">${money(totals.taxTotal)}</Typography>
            </Box>
            {couponDiscount > 0 && (
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2">Coupon discount</Typography>
                <Typography variant="body2">-${money(couponDiscount)}</Typography>
              </Box>
            )}
            {loyaltyDiscount > 0 && (
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2">Loyalty discount</Typography>
                <Typography variant="body2">-${money(loyaltyDiscount)}</Typography>
              </Box>
            )}
            <Box display="flex" justifyContent="space-between">
              <Typography variant="h6">Grand Total</Typography>
              <Typography variant="h6">${money(totals.grandTotal)}</Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <SecondaryButton disabled={cart.length === 0 || holdMutation.isPending} onClick={() => holdMutation.mutate()}>
              Hold
            </SecondaryButton>
            <PrimaryButton fullWidth size="large" disabled={cart.length === 0} onClick={() => setPaymentOpen(true)}>
              Payment (F5)
            </PrimaryButton>
          </Stack>
        </Card>
      </Box>

      <AppModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        title="Quick Add Customer"
        maxWidth="xs"
        actions={
          <>
            <SecondaryButton onClick={() => setQuickAddOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton
              disabled={!quickAddName || createCustomerMutation.isPending}
              onClick={() => createCustomerMutation.mutate()}
            >
              Add Customer
            </PrimaryButton>
          </>
        }
      >
        <TextField
          fullWidth
          autoFocus
          label="Name"
          value={quickAddName}
          onChange={(e) => setQuickAddName(e.target.value)}
          sx={{ mt: 1 }}
        />
        <TextField
          fullWidth
          label="Phone"
          value={quickAddPhone}
          onChange={(e) => setQuickAddPhone(e.target.value)}
          sx={{ mt: 2 }}
        />
      </AppModal>

      <AppModal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        title="Payment"
        maxWidth="xs"
        actions={
          <>
            <SecondaryButton onClick={() => setPaymentOpen(false)}>Cancel</SecondaryButton>
            <SuccessButton
              disabled={
                (paymentMethod === 'cash' && change < 0) ||
                (paymentMethod === 'gift_card' && !giftCardCode) ||
                cart.some((line) => line.trackSerials && (line.serialNumbers?.length ?? 0) !== line.quantity) ||
                createInvoiceMutation.isPending
              }
              onClick={() => createInvoiceMutation.mutate()}
            >
              Complete Sale
            </SuccessButton>
          </>
        }
      >
        <Typography gutterBottom>Grand Total: ${money(totals.grandTotal)}</Typography>
          {linkedPatient && Number(linkedPatient.currentBalance) > 0 && (
            <Box sx={{ bgcolor: 'success.50', border: '1px solid', borderColor: 'success.200', borderRadius: 1, p: 1.5, mb: 1.5, mt: 1 }}>
              <Typography variant="body2" color="success.main" gutterBottom>
                <strong>Patient Advance Balance: {Number(linkedPatient.currentBalance).toLocaleString()}</strong>
              </Typography>
              <TextField
                fullWidth
                size="small"
                label="Apply from patient advance"
                type="number"
                value={patientAdvanceAmount}
                onChange={(e) => {
                  const max = Math.min(Number(linkedPatient.currentBalance), totals.grandTotal);
                  const v = Math.min(Number(e.target.value) || 0, max);
                  setPatientAdvanceAmount(String(v));
                }}
                inputProps={{ min: 0, max: Math.min(Number(linkedPatient.currentBalance), totals.grandTotal) }}
                helperText={`Remaining after advance: $${money(Math.max(0, totals.grandTotal - (Number(patientAdvanceAmount) || 0)))}`}
              />
            </Box>
          )}
          <TextField
            select
            fullWidth
            label="Payment Method"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
            sx={{ mt: 1 }}
          >
            <MenuItem value="cash">Cash</MenuItem>
            <MenuItem value="debit_card">Debit Card</MenuItem>
            <MenuItem value="credit_card">Credit Card</MenuItem>
            <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
            <MenuItem value="mobile_wallet">Mobile Wallet</MenuItem>
            <MenuItem value="credit_sale" disabled={!customer}>
              Credit Sale (on account)
            </MenuItem>
            <MenuItem value="store_credit" disabled={!customer}>
              Store Credit
            </MenuItem>
            <MenuItem value="gift_card">Gift Card</MenuItem>
          </TextField>
          {paymentMethod === 'cash' && (
            <TextField
              fullWidth
              autoFocus
              label="Received Amount"
              value={receivedAmount}
              onChange={(e) => setReceivedAmount(e.target.value)}
              sx={{ mt: 2 }}
            />
          )}
          {paymentMethod === 'cash' && (
            <Typography sx={{ mt: 1 }} color={change < 0 ? 'error' : 'text.primary'}>
              Change: ${money(Number.isFinite(change) ? change : 0)}
            </Typography>
          )}
          {paymentMethod === 'gift_card' && (
            <TextField
              fullWidth
              autoFocus
              label="Gift Card Code"
              value={giftCardCode}
              onChange={(e) => setGiftCardCode(e.target.value.toUpperCase())}
              sx={{ mt: 2 }}
            />
          )}
      </AppModal>

      <AppModal
        open={heldOpen}
        onClose={() => setHeldOpen(false)}
        title="Held Sales"
        maxWidth="sm"
        actions={<SecondaryButton onClick={() => setHeldOpen(false)}>Close</SecondaryButton>}
      >
          <List dense>
            {(heldQuery.data ?? []).map((invoice, idx) => (
              <ListItemButton
                key={invoice.id}
                onClick={async () => {
                  const detail = await apiFetch<Invoice & { lines: InvoiceLine[] }>(
                    `/api/v1/invoices/${invoice.id}`,
                  );
                  resumeMutation.mutate(detail);
                }}
                sx={{ borderRadius: 1, mb: 0.5, bgcolor: idx % 2 === 1 ? 'action.hover' : 'transparent' }}
              >
                <ListItemText
                  primary={invoice.heldLabel ?? invoice.invoiceNo}
                  secondary={`Total: $${Number(invoice.grandTotal).toFixed(2)} · ${new Date(invoice.createdAt).toLocaleString()}`}
                />
              </ListItemButton>
            ))}
            {(heldQuery.data ?? []).length === 0 && (
              <Typography color="text.secondary" p={2}>
                No held sales.
              </Typography>
            )}
          </List>
      </AppModal>

      <AppModal
        open={recentOpen}
        onClose={() => setRecentOpen(false)}
        title="Recent Sales"
        maxWidth="md"
        actions={<SecondaryButton onClick={() => setRecentOpen(false)}>Close</SecondaryButton>}
      >
          <DataTable
            searchPlaceholder="Search by invoice no…"
            emptyMessage="No sales yet."
            defaultRowsPerPage={10}
            getRowId={(invoice: Invoice) => invoice.id}
            rows={recentQuery.data ?? []}
            getSearchText={(invoice) => invoice.invoiceNo}
            defaultSortKey="createdAt"
            defaultSortDir="desc"
            columns={[
              { key: 'invoiceNo', label: 'Invoice No', sortable: true, render: (i) => i.invoiceNo },
              { key: 'invoiceType', label: 'Type', sortable: true, render: (i) => formatEnumLabel(i.invoiceType) },
              {
                key: 'status',
                label: 'Status',
                sortable: true,
                render: (i) => <Chip size="small" label={formatEnumLabel(i.status)} color={invoiceStatusColor(i.status)} />,
              },
              {
                key: 'grandTotal',
                label: 'Total',
                align: 'right',
                sortable: true,
                sortValue: (i) => Number(i.grandTotal),
                render: (i) => `$${Number(i.grandTotal).toFixed(2)}`,
              },
              {
                key: 'createdAt',
                label: 'Date',
                sortable: true,
                sortValue: (i) => new Date(i.createdAt).getTime(),
                render: (i) => new Date(i.createdAt).toLocaleString(),
              },
              {
                key: 'actions',
                label: '',
                render: (invoice) => (
                  <Stack direction="row" spacing={1}>
                    <SecondaryButton size="small" onClick={() => handlePrintInvoice(invoice)}>
                      Print
                    </SecondaryButton>
                    {invoice.invoiceType === 'sale' && invoice.status !== 'voided' && (
                      <>
                        <SecondaryButton color="warning" variant="contained" size="small" onClick={() => setReturnTarget(invoice)}>
                          Return
                        </SecondaryButton>
                        <DangerButton size="small" onClick={() => setVoidTarget(invoice)}>
                          Void
                        </DangerButton>
                      </>
                    )}
                  </Stack>
                ),
              },
            ]}
          />
      </AppModal>

      <AppModal
        open={Boolean(voidTarget)}
        onClose={() => setVoidTarget(null)}
        title={`Void Invoice ${voidTarget?.invoiceNo ?? ''}`}
        maxWidth="xs"
        actions={
          <>
            <SecondaryButton onClick={() => setVoidTarget(null)}>Cancel</SecondaryButton>
            <DangerButton disabled={voidReason.trim().length < 3 || voidMutation.isPending} onClick={() => voidMutation.mutate()}>
              Void Sale
            </DangerButton>
          </>
        }
      >
          <TextField
            fullWidth
            autoFocus
            label="Reason"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            sx={{ mt: 1 }}
          />
      </AppModal>

      <AppModal
        open={Boolean(returnTarget)}
        onClose={() => setReturnTarget(null)}
        title={`Return — ${returnTarget?.invoiceNo ?? ''}`}
        maxWidth="sm"
        actions={
          <>
            <SecondaryButton onClick={() => setReturnTarget(null)}>Cancel</SecondaryButton>
            <SecondaryButton
              color="warning"
              variant="contained"
              disabled={returnMutation.isPending}
              onClick={() => returnMutation.mutate()}
            >
              Process Return
            </SecondaryButton>
          </>
        }
      >
          <Stack spacing={1} mt={1}>
            {(returnTargetLinesQuery.data?.lines ?? []).map((line) => (
              <Box key={line.id} display="flex" alignItems="center" gap={2}>
                <Typography flex={1}>{line.product?.name ?? line.productId}</Typography>
                <Typography color="text.secondary">Sold: {line.quantity}</Typography>
                <TextField
                  size="small"
                  label="Return qty"
                  sx={{ width: 100 }}
                  value={returnQuantities[line.id] ?? ''}
                  onChange={(e) =>
                    setReturnQuantities((current) => ({ ...current, [line.id]: e.target.value }))
                  }
                />
              </Box>
            ))}
          </Stack>
      </AppModal>

      <PrintPreviewModal
        open={printPreview.open}
        title={printPreview.title}
        html={printPreview.html}
        onClose={() => setPrintPreview((current) => ({ ...current, open: false }))}
      />

      <Snackbar open={Boolean(snackbar)} autoHideDuration={3000} onClose={() => setSnackbar(null)} message={snackbar} />
    </Box>
  );
}
