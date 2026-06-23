import { useState } from 'react';
import { Box, Snackbar, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { Coupon, GiftCard } from '../api/types';
import { DataTable } from '../components/DataTable';
import { PrimaryButton, SecondaryButton } from '../components/buttons';
import { formatEnumLabel } from '../utils/format';

const DISCOUNT_TYPES = ['percentage', 'fixed'] as const;

export function PromotionsPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(0);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  // --- Coupons ---
  const [couponForm, setCouponForm] = useState({
    code: '',
    discountType: 'percentage' as (typeof DISCOUNT_TYPES)[number],
    discountValue: '',
    expiryDate: '',
    usageLimit: '',
  });

  const couponsQuery = useQuery({
    queryKey: ['coupons'],
    queryFn: () => apiFetch<Coupon[]>('/api/v1/coupons'),
  });

  const createCouponMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/coupons', {
        method: 'POST',
        body: JSON.stringify({
          code: couponForm.code.toUpperCase(),
          discountType: couponForm.discountType,
          discountValue: couponForm.discountValue,
          expiryDate: couponForm.expiryDate ? new Date(couponForm.expiryDate).toISOString() : undefined,
          usageLimit: couponForm.usageLimit ? Number(couponForm.usageLimit) : undefined,
        }),
      }),
    onSuccess: () => {
      setSnackbar('Coupon created.');
      setCouponForm({ code: '', discountType: 'percentage', discountValue: '', expiryDate: '', usageLimit: '' });
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not create coupon.'),
  });

  // --- Gift Cards ---
  const [giftCardForm, setGiftCardForm] = useState({ code: '', initialBalance: '', expiryDate: '' });
  const [reloadCode, setReloadCode] = useState('');
  const [reloadAmount, setReloadAmount] = useState('');

  const giftCardsQuery = useQuery({
    queryKey: ['gift-cards'],
    queryFn: () => apiFetch<GiftCard[]>('/api/v1/gift-cards'),
  });

  const issueGiftCardMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/gift-cards', {
        method: 'POST',
        body: JSON.stringify({
          code: giftCardForm.code ? giftCardForm.code.toUpperCase() : undefined,
          initialBalance: giftCardForm.initialBalance,
          expiryDate: giftCardForm.expiryDate ? new Date(giftCardForm.expiryDate).toISOString() : undefined,
        }),
      }),
    onSuccess: () => {
      setSnackbar('Gift card issued.');
      setGiftCardForm({ code: '', initialBalance: '', expiryDate: '' });
      queryClient.invalidateQueries({ queryKey: ['gift-cards'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not issue gift card.'),
  });

  const reloadGiftCardMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/gift-cards/${reloadCode}/reload`, {
        method: 'POST',
        body: JSON.stringify({ amount: reloadAmount }),
      }),
    onSuccess: () => {
      setSnackbar('Gift card reloaded.');
      setReloadCode('');
      setReloadAmount('');
      queryClient.invalidateQueries({ queryKey: ['gift-cards'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not reload gift card.'),
  });

  return (
    <Box p={2} height="100%" overflow="auto">
      <Typography variant="h6" gutterBottom>
        Promotions
      </Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Coupons" />
        <Tab label="Gift Cards" />
      </Tabs>

      {tab === 0 && (
        <Box>
          <Stack direction="row" spacing={2} mb={3} flexWrap="wrap" alignItems="center">
            <TextField
              label="Code"
              value={couponForm.code}
              onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
            />
            <TextField
              select
              label="Type"
              sx={{ width: 140 }}
              value={couponForm.discountType}
              onChange={(e) =>
                setCouponForm({ ...couponForm, discountType: e.target.value as (typeof DISCOUNT_TYPES)[number] })
              }
              SelectProps={{ native: true }}
            >
              {DISCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </TextField>
            <TextField
              label={couponForm.discountType === 'percentage' ? 'Discount %' : 'Discount Amount'}
              sx={{ width: 160 }}
              value={couponForm.discountValue}
              onChange={(e) => setCouponForm({ ...couponForm, discountValue: e.target.value })}
            />
            <TextField
              label="Expiry Date"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={couponForm.expiryDate}
              onChange={(e) => setCouponForm({ ...couponForm, expiryDate: e.target.value })}
            />
            <TextField
              label="Usage Limit"
              sx={{ width: 120 }}
              value={couponForm.usageLimit}
              onChange={(e) => setCouponForm({ ...couponForm, usageLimit: e.target.value })}
            />
            <PrimaryButton
              disabled={!couponForm.code || !couponForm.discountValue || createCouponMutation.isPending}
              onClick={() => createCouponMutation.mutate()}
            >
              Create Coupon
            </PrimaryButton>
          </Stack>
          <DataTable
            searchPlaceholder="Search coupons…"
            emptyMessage="No coupons yet."
            getRowId={(coupon: Coupon) => coupon.id}
            rows={couponsQuery.data ?? []}
            getSearchText={(coupon) => coupon.code}
            columns={[
              { key: 'code', label: 'Code', sortable: true, render: (c) => c.code },
              { key: 'discountType', label: 'Type', sortable: true, render: (c) => formatEnumLabel(c.discountType) },
              { key: 'discountValue', label: 'Value', align: 'right', sortable: true, render: (c) => c.discountValue },
              {
                key: 'expiryDate',
                label: 'Expiry',
                sortable: true,
                sortValue: (c) => (c.expiryDate ? new Date(c.expiryDate).getTime() : 0),
                render: (c) => (c.expiryDate ? new Date(c.expiryDate).toLocaleDateString() : '—'),
              },
              {
                key: 'usage',
                label: 'Usage',
                align: 'right',
                render: (c) => `${c.usageCount}${c.usageLimit ? ` / ${c.usageLimit}` : ''}`,
              },
              { key: 'isActive', label: 'Active', sortable: true, sortValue: (c) => (c.isActive ? 1 : 0), render: (c) => (c.isActive ? 'Yes' : 'No') },
            ]}
          />
        </Box>
      )}

      {tab === 1 && (
        <Box>
          <Stack direction="row" spacing={2} mb={2} flexWrap="wrap" alignItems="center">
            <TextField
              label="Code (optional, auto-generated if blank)"
              sx={{ width: 260 }}
              value={giftCardForm.code}
              onChange={(e) => setGiftCardForm({ ...giftCardForm, code: e.target.value.toUpperCase() })}
            />
            <TextField
              label="Initial Balance"
              value={giftCardForm.initialBalance}
              onChange={(e) => setGiftCardForm({ ...giftCardForm, initialBalance: e.target.value })}
            />
            <TextField
              label="Expiry Date"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={giftCardForm.expiryDate}
              onChange={(e) => setGiftCardForm({ ...giftCardForm, expiryDate: e.target.value })}
            />
            <PrimaryButton
              disabled={!giftCardForm.initialBalance || issueGiftCardMutation.isPending}
              onClick={() => issueGiftCardMutation.mutate()}
            >
              Issue Gift Card
            </PrimaryButton>
          </Stack>
          <Stack direction="row" spacing={2} mb={3} flexWrap="wrap" alignItems="center">
            <TextField
              label="Gift Card Code"
              value={reloadCode}
              onChange={(e) => setReloadCode(e.target.value.toUpperCase())}
            />
            <TextField label="Reload Amount" value={reloadAmount} onChange={(e) => setReloadAmount(e.target.value)} />
            <SecondaryButton
              disabled={!reloadCode || !reloadAmount || reloadGiftCardMutation.isPending}
              onClick={() => reloadGiftCardMutation.mutate()}
            >
              Reload
            </SecondaryButton>
          </Stack>
          <DataTable
            searchPlaceholder="Search gift cards…"
            emptyMessage="No gift cards yet."
            getRowId={(card: GiftCard) => card.id}
            rows={giftCardsQuery.data ?? []}
            getSearchText={(card) => card.code}
            columns={[
              { key: 'code', label: 'Code', sortable: true, render: (c) => c.code },
              { key: 'initialBalance', label: 'Initial', align: 'right', render: (c) => c.initialBalance },
              { key: 'currentBalance', label: 'Current Balance', align: 'right', sortable: true, render: (c) => c.currentBalance },
              {
                key: 'expiryDate',
                label: 'Expiry',
                sortable: true,
                sortValue: (c) => (c.expiryDate ? new Date(c.expiryDate).getTime() : 0),
                render: (c) => (c.expiryDate ? new Date(c.expiryDate).toLocaleDateString() : '—'),
              },
              { key: 'isActive', label: 'Active', sortable: true, sortValue: (c) => (c.isActive ? 1 : 0), render: (c) => (c.isActive ? 'Yes' : 'No') },
            ]}
          />
        </Box>
      )}

      <Snackbar open={Boolean(snackbar)} autoHideDuration={3000} onClose={() => setSnackbar(null)} message={snackbar} />
    </Box>
  );
}
