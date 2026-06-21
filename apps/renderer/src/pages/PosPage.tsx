import { useMemo, useState } from 'react';
import {
  AppBar,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Snackbar,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { CartLine, ProductWithStock } from '../api/types';
import { useAuth } from '../state/auth-context';
import { ACTIVE_BRANCH_ID, ACTIVE_WAREHOUSE_ID } from '../config';

function money(value: number): string {
  return value.toFixed(2);
}

export function PosPage(): JSX.Element {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [invoiceDiscount, setInvoiceDiscount] = useState('0');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState('');
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const productsQuery = useQuery({
    queryKey: ['pos-grid', search],
    queryFn: () =>
      apiFetch<ProductWithStock[]>(
        `/api/v1/products/pos-grid?warehouseId=${ACTIVE_WAREHOUSE_ID}&search=${encodeURIComponent(search)}`,
      ),
  });

  const totals = useMemo(() => {
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

  const change = receivedAmount ? Number(receivedAmount) - totals.grandTotal : 0;

  const createInvoiceMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/invoices', {
        method: 'POST',
        body: JSON.stringify({
          branchId: ACTIVE_BRANCH_ID,
          warehouseId: ACTIVE_WAREHOUSE_ID,
          lines: cart.map((line) => ({
            productId: line.productId,
            quantity: String(line.quantity),
            unitPrice: line.unitPrice,
            discountValue: line.discountValue,
          })),
          invoiceDiscountValue: invoiceDiscount,
          payments: [
            {
              method: 'cash',
              amount: money(totals.grandTotal),
              receivedAmount: receivedAmount || money(totals.grandTotal),
            },
          ],
        }),
      }),
    onSuccess: () => {
      setSnackbar('Sale completed.');
      setCart([]);
      setInvoiceDiscount('0');
      setReceivedAmount('');
      setPaymentOpen(false);
      queryClient.invalidateQueries({ queryKey: ['pos-grid'] });
    },
    onError: (error) => {
      setSnackbar(error instanceof ApiError ? error.detail : 'Sale failed.');
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

  return (
    <Box display="flex" flexDirection="column" height="100vh">
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Vantage POS — Main Store
          </Typography>
          <Typography variant="body2">Cashier: {user?.fullName}</Typography>
          <Button size="small" onClick={logout}>
            Sign out
          </Button>
        </Toolbar>
      </AppBar>

      <Box display="flex" flex={1} overflow="hidden">
        <Box flex={2} p={2} overflow="auto">
          <TextField
            fullWidth
            placeholder="Search or scan barcode…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            sx={{ mb: 2 }}
          />
          <Grid container spacing={2}>
            {productsQuery.data?.map((product) => (
              <Grid item xs={4} sm={3} key={product.id}>
                <Card>
                  <CardActionArea onClick={() => addToCart(product)}>
                    <CardContent>
                      <Typography variant="subtitle2" noWrap>
                        {product.name}
                      </Typography>
                      <Typography variant="h6">${Number(product.salePrice).toFixed(2)}</Typography>
                      <Chip
                        size="small"
                        label={`Stock: ${product.quantityOnHand}`}
                        color={Number(product.quantityOnHand) > 0 ? 'success' : 'error'}
                      />
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        <Divider orientation="vertical" flexItem />

        <Box flex={1} p={2} display="flex" flexDirection="column">
          <Typography variant="h6" gutterBottom>
            Cart
          </Typography>
          <Box flex={1} overflow="auto">
            {cart.length === 0 && (
              <Typography color="text.secondary" variant="body2">
                Cart is empty — select a product to begin.
              </Typography>
            )}
            <Stack spacing={1}>
              {cart.map((line) => (
                <Box key={line.productId} display="flex" alignItems="center" gap={1}>
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
            <Box display="flex" justifyContent="space-between">
              <Typography variant="h6">Grand Total</Typography>
              <Typography variant="h6">${money(totals.grandTotal)}</Typography>
            </Box>
          </Stack>
          <Button variant="contained" size="large" disabled={cart.length === 0} onClick={() => setPaymentOpen(true)}>
            Cash Payment (F5)
          </Button>
        </Box>
      </Box>

      <Dialog open={paymentOpen} onClose={() => setPaymentOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Payment</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>Grand Total: ${money(totals.grandTotal)}</Typography>
          <TextField
            fullWidth
            autoFocus
            label="Received Amount"
            value={receivedAmount}
            onChange={(e) => setReceivedAmount(e.target.value)}
            sx={{ mt: 1 }}
          />
          <Typography sx={{ mt: 1 }} color={change < 0 ? 'error' : 'text.primary'}>
            Change: ${money(Number.isFinite(change) ? change : 0)}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={change < 0 || createInvoiceMutation.isPending}
            onClick={() => createInvoiceMutation.mutate()}
          >
            Complete Sale
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(snackbar)} autoHideDuration={3000} onClose={() => setSnackbar(null)} message={snackbar} />
    </Box>
  );
}
