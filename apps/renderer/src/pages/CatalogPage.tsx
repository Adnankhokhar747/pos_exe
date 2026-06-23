import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  Autocomplete,
  Box,
  Checkbox,
  FormControlLabel,
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
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { BundleComponentEntry, Category, ProductWithStock, TaxTemplate } from '../api/types';
import { DataTable } from '../components/DataTable';
import { AppModal } from '../components/AppModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PrimaryButton, SecondaryButton } from '../components/buttons';
import { useAuth } from '../state/auth-context';

interface ProductFormState {
  sku: string;
  barcode: string;
  name: string;
  description: string;
  categoryId: string;
  costPrice: string;
  salePrice: string;
  taxRatePct: string;
  taxTemplateId: string;
  parentProductId: string;
  isBundle: boolean;
  trackBatches: boolean;
  trackSerials: boolean;
}

const EMPTY_FORM: ProductFormState = {
  sku: '',
  barcode: '',
  name: '',
  description: '',
  categoryId: '',
  costPrice: '0',
  salePrice: '0',
  taxRatePct: '0',
  taxTemplateId: '',
  parentProductId: '',
  isBundle: false,
  trackBatches: false,
  trackSerials: false,
};

interface BundleLineDraft {
  componentProductId: string;
  quantity: string;
}

interface VariantAttrDraft {
  key: string;
  value: string;
}

function ProductFormFields({
  form,
  setForm,
  categories,
  taxTemplates,
  products,
  excludeProductId,
  topologyDisabled,
  variantAttrs = [],
  setVariantAttrs,
}: {
  form: ProductFormState;
  setForm: (next: ProductFormState) => void;
  categories: Category[];
  taxTemplates: TaxTemplate[];
  products: ProductWithStock[];
  excludeProductId?: string;
  topologyDisabled: boolean;
  variantAttrs?: VariantAttrDraft[];
  setVariantAttrs?: Dispatch<SetStateAction<VariantAttrDraft[]>>;
}): JSX.Element {
  const parentCandidates = products.filter((p) => !p.isBundle && p.id !== excludeProductId);

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2}>
        <TextField label="SKU" fullWidth value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} autoFocus />
        <TextField label="Barcode" fullWidth value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
      </Stack>
      <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <TextField label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <TextField select label="Category" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
        <MenuItem value="">None</MenuItem>
        {categories.map((category) => (
          <MenuItem key={category.id} value={category.id}>
            {category.name}
          </MenuItem>
        ))}
      </TextField>
      <Stack direction="row" spacing={2}>
        <TextField label="Cost Price" fullWidth value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
        <TextField label="Sale Price" fullWidth value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} />
      </Stack>
      <Stack direction="row" spacing={2}>
        <TextField
          label="Flat Tax Rate %"
          fullWidth
          value={form.taxRatePct}
          onChange={(e) => setForm({ ...form, taxRatePct: e.target.value })}
          helperText="Used when no tax template is selected"
        />
        <TextField
          select
          label="Tax Template"
          fullWidth
          value={form.taxTemplateId}
          onChange={(e) => setForm({ ...form, taxTemplateId: e.target.value })}
        >
          <MenuItem value="">None (use flat rate)</MenuItem>
          {taxTemplates.map((template) => (
            <MenuItem key={template.id} value={template.id}>
              {template.name} ({template.ratePct}% {template.isInclusive ? 'incl.' : 'excl.'})
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      <Autocomplete
        disabled={topologyDisabled}
        options={parentCandidates}
        getOptionLabel={(o) => o.name}
        value={parentCandidates.find((p) => p.id === form.parentProductId) ?? null}
        onChange={(_, value) => setForm({ ...form, parentProductId: value?.id ?? '' })}
        renderInput={(params) => <TextField {...params} label="Parent Product (for variants, optional)" />}
      />
      {!topologyDisabled && form.parentProductId && setVariantAttrs && (
        <Stack spacing={1}>
          <Typography variant="caption" color="text.secondary">
            Variant attributes (e.g. Size: Large)
          </Typography>
          {variantAttrs.map((attr, idx) => (
            <Stack direction="row" spacing={1} key={idx}>
              <TextField
                size="small"
                label="Attribute"
                value={attr.key}
                onChange={(e) => setVariantAttrs((current) => current.map((a, i) => (i === idx ? { ...a, key: e.target.value } : a)))}
              />
              <TextField
                size="small"
                label="Value"
                value={attr.value}
                onChange={(e) => setVariantAttrs((current) => current.map((a, i) => (i === idx ? { ...a, value: e.target.value } : a)))}
              />
              <IconButton size="small" onClick={() => setVariantAttrs((current) => current.filter((_, i) => i !== idx))}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          <SecondaryButton
            size="small"
            startIcon={<AddIcon />}
            sx={{ alignSelf: 'flex-start' }}
            onClick={() => setVariantAttrs((c) => [...c, { key: '', value: '' }])}
          >
            Add attribute
          </SecondaryButton>
        </Stack>
      )}
      <Stack direction="row" spacing={2}>
        <FormControlLabel
          control={<Checkbox disabled={topologyDisabled} checked={form.isBundle} onChange={(e) => setForm({ ...form, isBundle: e.target.checked })} />}
          label="Is Bundle/Kit"
        />
        <FormControlLabel
          control={<Checkbox checked={form.trackBatches} onChange={(e) => setForm({ ...form, trackBatches: e.target.checked })} />}
          label="Track Batches/Expiry"
        />
        <FormControlLabel
          control={<Checkbox checked={form.trackSerials} onChange={(e) => setForm({ ...form, trackSerials: e.target.checked })} />}
          label="Track Serial Numbers"
        />
      </Stack>
    </Stack>
  );
}

export function CatalogPage(): JSX.Element {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const ACTIVE_WAREHOUSE_ID = user!.warehouseId;
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [variantAttrs, setVariantAttrs] = useState<VariantAttrDraft[]>([]);
  const [selected, setSelected] = useState<ProductWithStock | null>(null);
  const [editTarget, setEditTarget] = useState<ProductWithStock | null>(null);
  const [editForm, setEditForm] = useState<ProductFormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<ProductWithStock | null>(null);
  const [bundleLines, setBundleLines] = useState<BundleLineDraft[]>([]);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: () => apiFetch<ProductWithStock[]>(`/api/v1/products/pos-grid?warehouseId=${ACTIVE_WAREHOUSE_ID}`),
  });

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiFetch<Category[]>('/api/v1/categories'),
  });

  const taxTemplatesQuery = useQuery({
    queryKey: ['tax-templates'],
    queryFn: () => apiFetch<TaxTemplate[]>('/api/v1/tax-templates'),
  });

  const variantsQuery = useQuery({
    queryKey: ['product-variants', selected?.id],
    queryFn: () => apiFetch<ProductWithStock[]>(`/api/v1/products/${selected?.id}/variants`),
    enabled: Boolean(selected) && !selected?.isBundle,
  });

  const bundleComponentsQuery = useQuery({
    queryKey: ['bundle-components', selected?.id],
    queryFn: () => apiFetch<BundleComponentEntry[]>(`/api/v1/products/${selected?.id}/bundle-components`),
    enabled: Boolean(selected?.isBundle),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/products', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          categoryId: form.categoryId || undefined,
          taxTemplateId: form.taxTemplateId || undefined,
          parentProductId: form.parentProductId || undefined,
          barcode: form.barcode || undefined,
          description: form.description || undefined,
          variantAttributes:
            variantAttrs.length > 0
              ? Object.fromEntries(variantAttrs.filter((a) => a.key).map((a) => [a.key, a.value]))
              : undefined,
        }),
      }),
    onSuccess: () => {
      setSnackbar('Product saved.');
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      setVariantAttrs([]);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not save product.'),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/products/${editTarget?.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          sku: editForm.sku,
          barcode: editForm.barcode || undefined,
          name: editForm.name,
          description: editForm.description || undefined,
          categoryId: editForm.categoryId || undefined,
          costPrice: editForm.costPrice,
          salePrice: editForm.salePrice,
          taxRatePct: editForm.taxRatePct,
          taxTemplateId: editForm.taxTemplateId || undefined,
          trackBatches: editForm.trackBatches,
          trackSerials: editForm.trackSerials,
        }),
      }),
    onSuccess: () => {
      setSnackbar('Product updated.');
      setEditTarget(null);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not update product.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setSnackbar('Product deleted.');
      if (selected?.id === deleteTarget?.id) setSelected(null);
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not delete product.'),
  });

  const setBundleComponentsMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/products/${selected?.id}/bundle-components`, {
        method: 'POST',
        body: JSON.stringify({
          components: bundleLines.filter((l) => l.componentProductId).map((l) => ({ componentProductId: l.componentProductId, quantity: l.quantity })),
        }),
      }),
    onSuccess: () => {
      setSnackbar('Bundle components saved.');
      queryClient.invalidateQueries({ queryKey: ['bundle-components', selected?.id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not save bundle components.'),
  });

  function selectProduct(product: ProductWithStock): void {
    setSelected(product);
    setBundleLines([]);
  }

  function openEdit(product: ProductWithStock): void {
    setEditTarget(product);
    setEditForm({
      sku: product.sku,
      barcode: product.barcode ?? '',
      name: product.name,
      description: product.description ?? '',
      categoryId: product.categoryId ?? '',
      costPrice: product.costPrice,
      salePrice: product.salePrice,
      taxRatePct: product.taxRatePct,
      taxTemplateId: product.taxTemplateId ?? '',
      parentProductId: product.parentProductId ?? '',
      isBundle: product.isBundle,
      trackBatches: product.trackBatches,
      trackSerials: product.trackSerials,
    });
  }

  return (
    <Box display="flex" height="100%">
      <Box flex={1} p={2} overflow="auto" borderRight="1px solid #e0e0e0">
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Catalog</Typography>
          <PrimaryButton onClick={() => setCreateOpen(true)}>New Product</PrimaryButton>
        </Stack>
        <DataTable
          searchPlaceholder="Search products…"
          emptyMessage="No products found."
          getRowId={(p: ProductWithStock) => p.id}
          rows={productsQuery.data ?? []}
          getSearchText={(p) => `${p.name} ${p.sku} ${p.barcode ?? ''}`}
          selectedRowId={selected?.id}
          onRowClick={(p) => selectProduct(p)}
          columns={[
            { key: 'name', label: 'Name', sortable: true, render: (p) => `${p.name}${p.isBundle ? ' (Bundle)' : ''}` },
            { key: 'sku', label: 'SKU', sortable: true, render: (p) => p.sku },
            {
              key: 'salePrice',
              label: 'Price',
              align: 'right',
              sortable: true,
              sortValue: (p) => Number(p.salePrice),
              render: (p) => `$${Number(p.salePrice).toFixed(2)}`,
            },
            {
              key: 'quantityOnHand',
              label: 'Stock',
              align: 'right',
              sortable: true,
              sortValue: (p) => Number(p.quantityOnHand),
              render: (p) => p.quantityOnHand,
            },
            {
              key: 'actions',
              label: '',
              render: (p) => (
                <Stack direction="row" spacing={1} onClick={(e) => e.stopPropagation()}>
                  <SecondaryButton size="small" onClick={() => openEdit(p)}>
                    Edit
                  </SecondaryButton>
                  <SecondaryButton size="small" color="error" onClick={() => setDeleteTarget(p)}>
                    Delete
                  </SecondaryButton>
                </Stack>
              ),
            },
          ]}
        />
      </Box>

      <Box flex={1} p={2} overflow="auto">
        {!selected && <Typography color="text.secondary">Select a product to view variants or bundle components.</Typography>}
        {selected && (
          <>
            <Typography variant="h6">{selected.name}</Typography>
            <Typography color="text.secondary" gutterBottom>
              SKU {selected.sku} · Cost ${Number(selected.costPrice).toFixed(2)} · Sale ${Number(selected.salePrice).toFixed(2)}
            </Typography>

            {!selected.isBundle && (
              <>
                <Typography variant="subtitle1" sx={{ mt: 2 }} gutterBottom>
                  Variants
                </Typography>
                <List dense>
                  {(variantsQuery.data ?? []).map((variant, idx) => (
                    <ListItemButton
                      key={variant.id}
                      onClick={() => selectProduct(variant)}
                      sx={{ mb: 0.5, borderRadius: 1, bgcolor: idx % 2 === 1 ? 'action.hover' : 'transparent' }}
                    >
                      <ListItemText
                        primary={variant.name}
                        secondary={variant.variantAttributes ? Object.entries(variant.variantAttributes).map(([k, v]) => `${k}: ${v}`).join(', ') : undefined}
                      />
                    </ListItemButton>
                  ))}
                  {(variantsQuery.data ?? []).length === 0 && (
                    <Typography color="text.secondary" variant="body2">
                      No variants. Create a product with "Parent Product" set to this product to add one.
                    </Typography>
                  )}
                </List>
              </>
            )}

            {selected.isBundle && (
              <>
                <Typography variant="subtitle1" sx={{ mt: 2 }} gutterBottom>
                  Bundle Components
                </Typography>
                <Stack spacing={1} mb={2}>
                  {(bundleLines.length > 0
                    ? bundleLines
                    : (bundleComponentsQuery.data ?? []).map((c) => ({ componentProductId: c.componentProductId, quantity: c.quantity }))
                  ).map((line, idx) => (
                    <Stack direction="row" spacing={1} key={idx} alignItems="center">
                      <Autocomplete
                        size="small"
                        sx={{ width: 240 }}
                        options={(productsQuery.data ?? []).filter((p) => p.id !== selected.id && !p.isBundle)}
                        getOptionLabel={(o) => o.name}
                        value={(productsQuery.data ?? []).find((p) => p.id === line.componentProductId) ?? null}
                        onChange={(_, value) =>
                          setBundleLines((current) => {
                            const base = current.length > 0 ? current : (bundleComponentsQuery.data ?? []).map((c) => ({ componentProductId: c.componentProductId, quantity: c.quantity }));
                            return base.map((l, i) => (i === idx ? { ...l, componentProductId: value?.id ?? '' } : l));
                          })
                        }
                        renderInput={(params) => <TextField {...params} label="Component" />}
                      />
                      <TextField
                        size="small"
                        label="Qty"
                        sx={{ width: 100 }}
                        value={line.quantity}
                        onChange={(e) =>
                          setBundleLines((current) => {
                            const base = current.length > 0 ? current : (bundleComponentsQuery.data ?? []).map((c) => ({ componentProductId: c.componentProductId, quantity: c.quantity }));
                            return base.map((l, i) => (i === idx ? { ...l, quantity: e.target.value } : l));
                          })
                        }
                      />
                      <IconButton
                        size="small"
                        onClick={() =>
                          setBundleLines((current) => {
                            const base = current.length > 0 ? current : (bundleComponentsQuery.data ?? []).map((c) => ({ componentProductId: c.componentProductId, quantity: c.quantity }));
                            return base.filter((_, i) => i !== idx);
                          })
                        }
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}
                  <SecondaryButton
                    size="small"
                    startIcon={<AddIcon />}
                    sx={{ alignSelf: 'flex-start' }}
                    onClick={() =>
                      setBundleLines((current) => {
                        const base = current.length > 0 ? current : (bundleComponentsQuery.data ?? []).map((c) => ({ componentProductId: c.componentProductId, quantity: c.quantity }));
                        return [...base, { componentProductId: '', quantity: '1' }];
                      })
                    }
                  >
                    Add component
                  </SecondaryButton>
                </Stack>
                <PrimaryButton disabled={setBundleComponentsMutation.isPending} onClick={() => setBundleComponentsMutation.mutate()}>
                  Save Bundle Components
                </PrimaryButton>
              </>
            )}
          </>
        )}
      </Box>

      <AppModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Product"
        maxWidth="sm"
        actions={
          <>
            <SecondaryButton onClick={() => setCreateOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton disabled={!form.sku || !form.name || createMutation.isPending} onClick={() => createMutation.mutate()}>
              Create
            </PrimaryButton>
          </>
        }
      >
        <ProductFormFields
          form={form}
          setForm={setForm}
          categories={categoriesQuery.data ?? []}
          taxTemplates={taxTemplatesQuery.data ?? []}
          products={productsQuery.data ?? []}
          topologyDisabled={false}
          variantAttrs={variantAttrs}
          setVariantAttrs={setVariantAttrs}
        />
      </AppModal>

      <AppModal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title="Edit Product"
        maxWidth="sm"
        actions={
          <>
            <SecondaryButton onClick={() => setEditTarget(null)}>Cancel</SecondaryButton>
            <PrimaryButton disabled={!editForm.sku || !editForm.name || updateMutation.isPending} onClick={() => updateMutation.mutate()}>
              Save
            </PrimaryButton>
          </>
        }
      >
        <ProductFormFields
          form={editForm}
          setForm={setEditForm}
          categories={categoriesQuery.data ?? []}
          taxTemplates={taxTemplatesQuery.data ?? []}
          products={productsQuery.data ?? []}
          excludeProductId={editTarget?.id}
          topologyDisabled
        />
      </AppModal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Product"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      <Snackbar open={Boolean(snackbar)} autoHideDuration={3000} onClose={() => setSnackbar(null)} message={snackbar} />
    </Box>
  );
}
