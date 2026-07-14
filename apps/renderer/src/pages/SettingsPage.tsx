import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Snackbar,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { BackupSnapshotMeta, BackupStatus, Currency, ExchangeRate, Printer, PrinterType, ReceiptSettings, Role, TaxTemplate, TenantSettings, TenantUser } from '../api/types';
import { DataTable } from '../components/DataTable';
import { AppModal } from '../components/AppModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PrimaryButton, SecondaryButton } from '../components/buttons';
import { formatEnumLabel } from '../utils/format';
import { renderInvoiceHtml } from '../printing/invoice-template';
import { renderReceiptHtml } from '../printing/receipt-template';
import { TEST_INVOICE_FIXTURE } from '../printing/test-fixture';
import { useAuth } from '../state/auth-context';

const PRINTER_TYPES: { value: PrinterType; label: string }[] = [
  { value: 'thermal_80', label: 'Thermal 80mm' },
  { value: 'thermal_58', label: 'Thermal 58mm' },
  { value: 'a4', label: 'A4' },
  { value: 'pdf', label: 'PDF' },
];

const PRINTER_EMPTY_FORM = {
  name: '',
  type: 'thermal_80' as PrinterType,
  systemPrinterName: '',
  isDefaultReceipt: false,
  isDefaultInvoice: false,
};

const TAX_TYPES = ['vat', 'gst', 'sales_tax', 'custom'] as const;

const USER_EMPTY_FORM = { fullName: '', username: '', email: '', password: '', roleId: '' };

export function SettingsPage(): JSX.Element {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const ACTIVE_BRANCH_ID = user!.branchId;
  const ACTIVE_BRANCH_NAME = user!.branchName;
  const canManageUsers = user!.permissions.includes('user.manage');
  const [tab, setTab] = useState(0);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  // --- Currencies ---
  const [currencyForm, setCurrencyForm] = useState({ code: '', name: '', symbol: '', decimalPlaces: '2' });
  const [rateCurrency, setRateCurrency] = useState('');
  const [rateValue, setRateValue] = useState('');

  const currenciesQuery = useQuery({
    queryKey: ['currencies'],
    queryFn: () => apiFetch<Currency[]>('/api/v1/currencies'),
  });

  const ratesQuery = useQuery({
    queryKey: ['exchange-rates', rateCurrency],
    queryFn: () => apiFetch<ExchangeRate[]>(`/api/v1/currencies/${rateCurrency}/exchange-rates`),
    enabled: Boolean(rateCurrency),
  });

  const tenantSettingsQuery = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: () => apiFetch<TenantSettings>('/api/v1/settings/tenant'),
  });

  const [defaultCurrency, setDefaultCurrency] = useState('');
  useEffect(() => {
    if (tenantSettingsQuery.data) {
      setDefaultCurrency(tenantSettingsQuery.data.baseCurrency);
    }
  }, [tenantSettingsQuery.data]);

  const updateDefaultCurrencyMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/settings/tenant', {
        method: 'PATCH',
        body: JSON.stringify({ baseCurrency: defaultCurrency }),
      }),
    onSuccess: () => {
      setSnackbar('Default currency updated.');
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not update default currency.'),
  });

  const createCurrencyMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/currencies', {
        method: 'POST',
        body: JSON.stringify({ ...currencyForm, decimalPlaces: Number(currencyForm.decimalPlaces) }),
      }),
    onSuccess: () => {
      setSnackbar('Currency saved.');
      setCurrencyForm({ code: '', name: '', symbol: '', decimalPlaces: '2' });
      queryClient.invalidateQueries({ queryKey: ['currencies'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not save currency.'),
  });

  const recordRateMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/currencies/${rateCurrency}/exchange-rates`, {
        method: 'POST',
        body: JSON.stringify({ rateToBase: rateValue }),
      }),
    onSuccess: () => {
      setSnackbar('Exchange rate recorded.');
      setRateValue('');
      queryClient.invalidateQueries({ queryKey: ['exchange-rates', rateCurrency] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not record rate.'),
  });

  // --- Tax Templates ---
  const [taxForm, setTaxForm] = useState({ name: '', taxType: 'vat' as (typeof TAX_TYPES)[number], ratePct: '', isInclusive: false });

  const taxTemplatesQuery = useQuery({
    queryKey: ['tax-templates'],
    queryFn: () => apiFetch<TaxTemplate[]>('/api/v1/tax-templates'),
  });

  const createTaxTemplateMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/tax-templates', {
        method: 'POST',
        body: JSON.stringify(taxForm),
      }),
    onSuccess: () => {
      setSnackbar('Tax template created.');
      setTaxForm({ name: '', taxType: 'vat', ratePct: '', isInclusive: false });
      queryClient.invalidateQueries({ queryKey: ['tax-templates'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not create tax template.'),
  });

  const toggleTaxTemplateMutation = useMutation({
    mutationFn: (template: TaxTemplate) =>
      apiFetch(`/api/v1/tax-templates/${template.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !template.isActive }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-templates'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not update tax template.'),
  });

  // --- Company ---
  const [companyForm, setCompanyForm] = useState({
    name: '',
    address: '',
    taxNumber: '',
    logoPath: '',
    defaultTaxTemplateId: '',
  });

  useEffect(() => {
    if (tenantSettingsQuery.data) {
      setCompanyForm({
        name: tenantSettingsQuery.data.name,
        address: tenantSettingsQuery.data.address ?? '',
        taxNumber: tenantSettingsQuery.data.taxNumber ?? '',
        logoPath: tenantSettingsQuery.data.logoPath ?? '',
        defaultTaxTemplateId: tenantSettingsQuery.data.defaultTaxTemplateId ?? '',
      });
    }
  }, [tenantSettingsQuery.data]);

  const updateCompanyMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/settings/tenant', {
        method: 'PATCH',
        body: JSON.stringify(companyForm),
      }),
    onSuccess: () => {
      setSnackbar('Company profile updated.');
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not update company profile.'),
  });

  function handleLogoFileChange(e: ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCompanyForm((prev) => ({ ...prev, logoPath: String(reader.result) }));
    reader.readAsDataURL(file);
  }

  // --- Users & Roles ---
  const [userForm, setUserForm] = useState(USER_EMPTY_FORM);
  const [editUserTarget, setEditUserTarget] = useState<TenantUser | null>(null);
  const [editUserForm, setEditUserForm] = useState(USER_EMPTY_FORM);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [deactivateUserTarget, setDeactivateUserTarget] = useState<TenantUser | null>(null);

  const usersQuery = useQuery({
    queryKey: ['tenant-users'],
    queryFn: () => apiFetch<TenantUser[]>('/api/v1/users'),
    enabled: canManageUsers,
  });

  const rolesQuery = useQuery({
    queryKey: ['tenant-roles'],
    queryFn: () => apiFetch<Role[]>('/api/v1/roles'),
    enabled: canManageUsers,
  });

  const createUserMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/users', {
        method: 'POST',
        body: JSON.stringify({
          fullName: userForm.fullName,
          username: userForm.username,
          email: userForm.email || undefined,
          password: userForm.password,
          roleIds: userForm.roleId ? [userForm.roleId] : [],
        }),
      }),
    onSuccess: () => {
      setSnackbar('User created.');
      setUserForm(USER_EMPTY_FORM);
      setCreateUserOpen(false);
      queryClient.invalidateQueries({ queryKey: ['tenant-users'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not create user.'),
  });

  const updateUserMutation = useMutation({
    mutationFn: async () => {
      await apiFetch(`/api/v1/users/${editUserTarget?.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: editUserForm.fullName,
          email: editUserForm.email || undefined,
          roleIds: editUserForm.roleId ? [editUserForm.roleId] : [],
        }),
      });
      if (editUserForm.password) {
        await apiFetch(`/api/v1/users/${editUserTarget?.id}/change-password`, {
          method: 'POST',
          body: JSON.stringify({ newPassword: editUserForm.password }),
        });
      }
    },
    onSuccess: () => {
      setSnackbar('User updated.');
      setEditUserTarget(null);
      queryClient.invalidateQueries({ queryKey: ['tenant-users'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not update user.'),
  });

  const toggleUserStatusMutation = useMutation({
    mutationFn: (targetUser: TenantUser) =>
      targetUser.status === 'active'
        ? apiFetch(`/api/v1/users/${targetUser.id}`, { method: 'DELETE' })
        : apiFetch(`/api/v1/users/${targetUser.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'active' }) }),
    onSuccess: () => {
      setSnackbar('User status updated.');
      setDeactivateUserTarget(null);
      queryClient.invalidateQueries({ queryKey: ['tenant-users'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not update user status.'),
  });

  function openEditUser(targetUser: TenantUser): void {
    setEditUserTarget(targetUser);
    setEditUserForm({
      fullName: targetUser.fullName,
      username: targetUser.username,
      email: targetUser.email ?? '',
      password: '',
      roleId: (targetUser.roles ?? [])[0]?.id ?? '',
    });
  }

  // --- Printing ---
  const [printerForm, setPrinterForm] = useState(PRINTER_EMPTY_FORM);
  const [editPrinterTarget, setEditPrinterTarget] = useState<Printer | null>(null);
  const [editPrinterForm, setEditPrinterForm] = useState(PRINTER_EMPTY_FORM);
  const [deletePrinterTarget, setDeletePrinterTarget] = useState<Printer | null>(null);
  const [systemPrinters, setSystemPrinters] = useState<VantagePrinterInfo[]>([]);
  const [receiptForm, setReceiptForm] = useState({ headerText: '', footerText: '', paperWidthMm: '80' });

  const printersQuery = useQuery({
    queryKey: ['printers'],
    queryFn: () => apiFetch<Printer[]>(`/api/v1/settings/printers?branchId=${ACTIVE_BRANCH_ID}`),
  });

  const receiptSettingsQuery = useQuery({
    queryKey: ['receipt-settings'],
    queryFn: () => apiFetch<ReceiptSettings>('/api/v1/settings/receipt-settings'),
  });

  useEffect(() => {
    if (receiptSettingsQuery.data) {
      setReceiptForm({
        headerText: receiptSettingsQuery.data.headerText ?? '',
        footerText: receiptSettingsQuery.data.footerText ?? '',
        paperWidthMm: String(receiptSettingsQuery.data.paperWidthMm),
      });
    }
  }, [receiptSettingsQuery.data]);

  useEffect(() => {
    if (tab !== 2 || !window.vantage) return;
    window.vantage.printing.listPrinters().then(setSystemPrinters).catch(() => undefined);
  }, [tab]);

  const createPrinterMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/settings/printers?branchId=${ACTIVE_BRANCH_ID}`, {
        method: 'POST',
        body: JSON.stringify(printerForm),
      }),
    onSuccess: () => {
      setSnackbar('Printer added.');
      setPrinterForm(PRINTER_EMPTY_FORM);
      queryClient.invalidateQueries({ queryKey: ['printers'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not add printer.'),
  });

  const updatePrinterMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/settings/printers/${editPrinterTarget?.id}?branchId=${ACTIVE_BRANCH_ID}`, {
        method: 'PATCH',
        body: JSON.stringify(editPrinterForm),
      }),
    onSuccess: () => {
      setSnackbar('Printer updated.');
      setEditPrinterTarget(null);
      queryClient.invalidateQueries({ queryKey: ['printers'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not update printer.'),
  });

  const deletePrinterMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/settings/printers/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setSnackbar('Printer removed.');
      setDeletePrinterTarget(null);
      queryClient.invalidateQueries({ queryKey: ['printers'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not remove printer.'),
  });

  const updateReceiptSettingsMutation = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/settings/receipt-settings', {
        method: 'PATCH',
        body: JSON.stringify({ ...receiptForm, paperWidthMm: Number(receiptForm.paperWidthMm) }),
      }),
    onSuccess: () => {
      setSnackbar('Receipt settings saved.');
      queryClient.invalidateQueries({ queryKey: ['receipt-settings'] });
    },
    onError: (error) => setSnackbar(error instanceof ApiError ? error.detail : 'Could not save receipt settings.'),
  });

  function openEditPrinter(printer: Printer): void {
    setEditPrinterTarget(printer);
    setEditPrinterForm({
      name: printer.name,
      type: printer.type,
      systemPrinterName: printer.systemPrinterName,
      isDefaultReceipt: printer.isDefaultReceipt,
      isDefaultInvoice: printer.isDefaultInvoice,
    });
  }

  async function handleTestPrint(printer: Printer): Promise<void> {
    if (!window.vantage) {
      setSnackbar('Printing is only available in the desktop app.');
      return;
    }
    const headerText = receiptSettingsQuery.data?.headerText ?? null;
    const footerText = receiptSettingsQuery.data?.footerText ?? null;
    try {
      if (printer.type === 'pdf') {
        const html = renderInvoiceHtml({ invoice: TEST_INVOICE_FIXTURE, branchName: ACTIVE_BRANCH_NAME, headerText, footerText });
        await window.vantage.printing.printToPdf(html);
      } else if (printer.type === 'a4') {
        const html = renderInvoiceHtml({ invoice: TEST_INVOICE_FIXTURE, branchName: ACTIVE_BRANCH_NAME, headerText, footerText });
        await window.vantage.printing.printHtml(html, { printerName: printer.systemPrinterName, silent: true });
      } else {
        const paperWidthMm = printer.type === 'thermal_58' ? 58 : 80;
        const html = renderReceiptHtml({ invoice: TEST_INVOICE_FIXTURE, branchName: ACTIVE_BRANCH_NAME, headerText, footerText, paperWidthMm });
        await window.vantage.printing.printHtml(html, { printerName: printer.systemPrinterName, silent: true });
      }
      setSnackbar('Test print sent.');
    } catch {
      setSnackbar('Test print failed.');
    }
  }

  return (
    <Box p={2} height="100%" overflow="auto">
      <Typography variant="h6" gutterBottom>
        Settings
      </Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Currencies & Exchange Rates" />
        <Tab label="Tax Templates" />
        <Tab label="Printing" />
        <Tab label="Company" />
        {canManageUsers && <Tab label="Users & Roles" />}
        <Tab label="Backup" />
      </Tabs>

      {tab === 0 && (
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Default Currency
          </Typography>
          <Stack direction="row" spacing={2} mb={3} alignItems="center">
            <TextField
              select
              label="Default currency"
              sx={{ width: 220 }}
              value={defaultCurrency}
              onChange={(e) => setDefaultCurrency(e.target.value)}
            >
              {defaultCurrency && !(currenciesQuery.data ?? []).some((c) => c.code === defaultCurrency) && (
                <MenuItem value={defaultCurrency}>{defaultCurrency}</MenuItem>
              )}
              {(currenciesQuery.data ?? []).map((currency) => (
                <MenuItem key={currency.code} value={currency.code}>
                  {currency.code} — {currency.name}
                </MenuItem>
              ))}
            </TextField>
            <PrimaryButton
              disabled={
                !defaultCurrency ||
                defaultCurrency === tenantSettingsQuery.data?.baseCurrency ||
                updateDefaultCurrencyMutation.isPending
              }
              onClick={() => updateDefaultCurrencyMutation.mutate()}
            >
              Save Default Currency
            </PrimaryButton>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 3, display: 'block' }}>
            This is the currency new sales in the POS default to. Make sure it's added to the currency list below.
          </Typography>

          <Stack direction="row" spacing={2} mb={3} flexWrap="wrap">
            <TextField
              label="Code"
              sx={{ width: 110 }}
              inputProps={{ maxLength: 10 }}
              helperText="e.g. PKR, RS, USD"
              value={currencyForm.code}
              onChange={(e) => setCurrencyForm({ ...currencyForm, code: e.target.value.toUpperCase() })}
            />
            <TextField
              label="Name"
              helperText="e.g. Pakistani Rupee"
              value={currencyForm.name}
              onChange={(e) => setCurrencyForm({ ...currencyForm, name: e.target.value })}
            />
            <TextField
              label="Symbol"
              sx={{ width: 110 }}
              inputProps={{ maxLength: 10 }}
              helperText="e.g. Rs, ₨, $"
              value={currencyForm.symbol}
              onChange={(e) => setCurrencyForm({ ...currencyForm, symbol: e.target.value })}
            />
            <TextField
              label="Decimal Places"
              sx={{ width: 140 }}
              value={currencyForm.decimalPlaces}
              onChange={(e) => setCurrencyForm({ ...currencyForm, decimalPlaces: e.target.value })}
            />
            <PrimaryButton
              disabled={!currencyForm.code || !currencyForm.name || createCurrencyMutation.isPending}
              onClick={() => createCurrencyMutation.mutate()}
            >
              Save Currency
            </PrimaryButton>
          </Stack>
          <Box mb={4}>
            <DataTable
              hideSearch
              emptyMessage="No currencies configured yet."
              getRowId={(currency: Currency) => currency.code}
              rows={currenciesQuery.data ?? []}
              columns={[
                { key: 'code', label: 'Code', sortable: true, render: (c) => c.code },
                { key: 'name', label: 'Name', sortable: true, render: (c) => c.name },
                { key: 'symbol', label: 'Symbol', render: (c) => c.symbol },
                { key: 'decimalPlaces', label: 'Decimals', align: 'right', render: (c) => c.decimalPlaces },
              ]}
            />
          </Box>

          <Typography variant="subtitle1" gutterBottom>
            Exchange Rates (to base currency)
          </Typography>
          <Stack direction="row" spacing={2} mb={2} alignItems="center">
            <TextField select label="Currency" sx={{ width: 160 }} value={rateCurrency} onChange={(e) => setRateCurrency(e.target.value)}>
              {(currenciesQuery.data ?? []).map((currency) => (
                <MenuItem key={currency.code} value={currency.code}>
                  {currency.code}
                </MenuItem>
              ))}
            </TextField>
            <TextField label="Rate to base" value={rateValue} onChange={(e) => setRateValue(e.target.value)} />
            <SecondaryButton
              disabled={!rateCurrency || !rateValue || recordRateMutation.isPending}
              onClick={() => recordRateMutation.mutate()}
            >
              Record Rate
            </SecondaryButton>
          </Stack>
          {rateCurrency && (
            <DataTable
              hideSearch
              emptyMessage="No exchange rate history yet."
              getRowId={(rate: ExchangeRate) => rate.id}
              rows={ratesQuery.data ?? []}
              columns={[
                {
                  key: 'effectiveAt',
                  label: 'Effective At',
                  sortable: true,
                  sortValue: (r) => new Date(r.effectiveAt).getTime(),
                  render: (r) => new Date(r.effectiveAt).toLocaleString(),
                },
                { key: 'rateToBase', label: 'Rate to Base', align: 'right', render: (r) => r.rateToBase },
              ]}
            />
          )}
        </Box>
      )}

      {tab === 1 && (
        <Box>
          <Stack direction="row" spacing={2} mb={3} flexWrap="wrap" alignItems="center">
            <TextField label="Name" value={taxForm.name} onChange={(e) => setTaxForm({ ...taxForm, name: e.target.value })} />
            <TextField
              select
              label="Type"
              sx={{ width: 140 }}
              value={taxForm.taxType}
              onChange={(e) => setTaxForm({ ...taxForm, taxType: e.target.value as (typeof TAX_TYPES)[number] })}
            >
              {TAX_TYPES.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Rate %"
              sx={{ width: 100 }}
              value={taxForm.ratePct}
              onChange={(e) => setTaxForm({ ...taxForm, ratePct: e.target.value })}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={taxForm.isInclusive}
                  onChange={(e) => setTaxForm({ ...taxForm, isInclusive: e.target.checked })}
                />
              }
              label="Inclusive (tax baked into price)"
            />
            <PrimaryButton
              disabled={!taxForm.name || !taxForm.ratePct || createTaxTemplateMutation.isPending}
              onClick={() => createTaxTemplateMutation.mutate()}
            >
              Create Tax Template
            </PrimaryButton>
          </Stack>
          <DataTable
            searchPlaceholder="Search tax templates…"
            emptyMessage="No tax templates yet."
            getRowId={(template: TaxTemplate) => template.id}
            rows={taxTemplatesQuery.data ?? []}
            getSearchText={(t) => `${t.name} ${t.taxType}`}
            columns={[
              { key: 'name', label: 'Name', sortable: true, render: (t) => t.name },
              { key: 'taxType', label: 'Type', sortable: true, render: (t) => formatEnumLabel(t.taxType) },
              { key: 'ratePct', label: 'Rate %', align: 'right', sortable: true, render: (t) => t.ratePct },
              { key: 'isInclusive', label: 'Mode', render: (t) => (t.isInclusive ? 'Inclusive' : 'Exclusive') },
              { key: 'isActive', label: 'Active', sortable: true, sortValue: (t) => (t.isActive ? 1 : 0), render: (t) => (t.isActive ? 'Yes' : 'No') },
              {
                key: 'actions',
                label: '',
                render: (template) => (
                  <Button size="small" onClick={() => toggleTaxTemplateMutation.mutate(template)}>
                    {template.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                ),
              },
            ]}
          />
        </Box>
      )}

      {tab === 2 && (
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Printers
          </Typography>
          <Stack direction="row" spacing={2} mb={3} flexWrap="wrap" alignItems="center">
            <TextField label="Name" value={printerForm.name} onChange={(e) => setPrinterForm({ ...printerForm, name: e.target.value })} />
            <TextField
              select
              label="Type"
              sx={{ width: 160 }}
              value={printerForm.type}
              onChange={(e) => setPrinterForm({ ...printerForm, type: e.target.value as PrinterType })}
            >
              {PRINTER_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>
                  {t.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="System Printer"
              sx={{ width: 220 }}
              value={printerForm.systemPrinterName}
              onChange={(e) => setPrinterForm({ ...printerForm, systemPrinterName: e.target.value })}
            >
              {systemPrinters.length === 0 && <MenuItem value="">No printers detected</MenuItem>}
              {systemPrinters.map((p) => (
                <MenuItem key={p.name} value={p.name}>
                  {p.displayName || p.name}
                </MenuItem>
              ))}
            </TextField>
            <FormControlLabel
              control={
                <Checkbox
                  checked={printerForm.isDefaultReceipt}
                  onChange={(e) => setPrinterForm({ ...printerForm, isDefaultReceipt: e.target.checked })}
                />
              }
              label="Default for receipts"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={printerForm.isDefaultInvoice}
                  onChange={(e) => setPrinterForm({ ...printerForm, isDefaultInvoice: e.target.checked })}
                />
              }
              label="Default for invoices"
            />
            <PrimaryButton
              disabled={!printerForm.name || !printerForm.systemPrinterName || createPrinterMutation.isPending}
              onClick={() => createPrinterMutation.mutate()}
            >
              Add Printer
            </PrimaryButton>
          </Stack>

          <DataTable
            hideSearch
            emptyMessage="No printers configured yet."
            getRowId={(printer: Printer) => printer.id}
            rows={printersQuery.data ?? []}
            columns={[
              { key: 'name', label: 'Name', sortable: true, render: (p) => p.name },
              { key: 'type', label: 'Type', sortable: true, render: (p) => formatEnumLabel(p.type) },
              { key: 'systemPrinterName', label: 'System Printer', render: (p) => p.systemPrinterName },
              { key: 'isDefaultReceipt', label: 'Default Receipt', render: (p) => (p.isDefaultReceipt ? 'Yes' : '') },
              { key: 'isDefaultInvoice', label: 'Default Invoice', render: (p) => (p.isDefaultInvoice ? 'Yes' : '') },
              {
                key: 'actions',
                label: '',
                render: (p) => (
                  <Stack direction="row" spacing={1}>
                    <SecondaryButton size="small" onClick={() => handleTestPrint(p)}>
                      Test Print
                    </SecondaryButton>
                    <SecondaryButton size="small" onClick={() => openEditPrinter(p)}>
                      Edit
                    </SecondaryButton>
                    <SecondaryButton size="small" color="error" onClick={() => setDeletePrinterTarget(p)}>
                      Delete
                    </SecondaryButton>
                  </Stack>
                ),
              },
            ]}
          />

          <Typography variant="subtitle1" sx={{ mt: 4 }} gutterBottom>
            Receipt Customization
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center">
            <TextField
              label="Header Text"
              sx={{ width: 260 }}
              value={receiptForm.headerText}
              onChange={(e) => setReceiptForm({ ...receiptForm, headerText: e.target.value })}
            />
            <TextField
              label="Footer Text"
              sx={{ width: 260 }}
              value={receiptForm.footerText}
              onChange={(e) => setReceiptForm({ ...receiptForm, footerText: e.target.value })}
            />
            <TextField
              select
              label="Paper Width"
              sx={{ width: 160 }}
              value={receiptForm.paperWidthMm}
              onChange={(e) => setReceiptForm({ ...receiptForm, paperWidthMm: e.target.value })}
            >
              <MenuItem value="80">80mm</MenuItem>
              <MenuItem value="58">58mm</MenuItem>
            </TextField>
            <PrimaryButton disabled={updateReceiptSettingsMutation.isPending} onClick={() => updateReceiptSettingsMutation.mutate()}>
              Save Receipt Settings
            </PrimaryButton>
          </Stack>
        </Box>
      )}

      {tab === 3 && (
        <Box maxWidth={520}>
          <Typography variant="subtitle1" gutterBottom>
            Company Profile
          </Typography>
          <Stack spacing={2} mb={3}>
            <TextField
              label="Company Name"
              value={companyForm.name}
              onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
            />
            <TextField
              label="Address"
              multiline
              minRows={2}
              value={companyForm.address}
              onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
            />
            <TextField
              label="Tax Number"
              value={companyForm.taxNumber}
              onChange={(e) => setCompanyForm({ ...companyForm, taxNumber: e.target.value })}
            />
            <TextField
              select
              label="Default Tax Template"
              value={companyForm.defaultTaxTemplateId}
              onChange={(e) => setCompanyForm({ ...companyForm, defaultTaxTemplateId: e.target.value })}
            >
              <MenuItem value="">None</MenuItem>
              {(taxTemplatesQuery.data ?? []).map((template) => (
                <MenuItem key={template.id} value={template.id}>
                  {template.name}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" spacing={2} alignItems="center">
              {companyForm.logoPath && (
                <Box
                  component="img"
                  src={companyForm.logoPath}
                  alt="Company logo"
                  sx={{ width: 64, height: 64, objectFit: 'contain', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
                />
              )}
              <Button component="label" variant="outlined" size="small">
                Upload Logo
                <input type="file" accept="image/*" hidden onChange={handleLogoFileChange} />
              </Button>
            </Stack>
            <Box>
              <PrimaryButton
                disabled={!companyForm.name || updateCompanyMutation.isPending}
                onClick={() => updateCompanyMutation.mutate()}
              >
                Save Company Profile
              </PrimaryButton>
            </Box>
          </Stack>
        </Box>
      )}

      {tab === 4 && canManageUsers && (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="subtitle1">Users</Typography>
            <PrimaryButton onClick={() => setCreateUserOpen(true)}>Add User</PrimaryButton>
          </Stack>
          <DataTable
            searchPlaceholder="Search users…"
            emptyMessage="No users yet."
            getRowId={(u: TenantUser) => u.id}
            rows={usersQuery.data ?? []}
            getSearchText={(u) => `${u.fullName} ${u.username}`}
            columns={[
              { key: 'fullName', label: 'Name', sortable: true, render: (u) => u.fullName },
              { key: 'username', label: 'Username', sortable: true, render: (u) => u.username },
              { key: 'role', label: 'Role', render: (u) => (u.roles ?? [])[0]?.name ?? '—' },
              {
                key: 'status',
                label: 'Status',
                sortable: true,
                sortValue: (u) => (u.status === 'active' ? 1 : 0),
                render: (u) => (u.status === 'active' ? 'Active' : 'Inactive'),
              },
              {
                key: 'actions',
                label: '',
                render: (u) => (
                  <Stack direction="row" spacing={1}>
                    <SecondaryButton size="small" onClick={() => openEditUser(u)}>
                      Edit
                    </SecondaryButton>
                    <SecondaryButton size="small" color={u.status === 'active' ? 'error' : 'primary'} onClick={() => setDeactivateUserTarget(u)}>
                      {u.status === 'active' ? 'Deactivate' : 'Reactivate'}
                    </SecondaryButton>
                  </Stack>
                ),
              },
            ]}
          />
        </Box>
      )}

      <AppModal
        open={createUserOpen}
        onClose={() => setCreateUserOpen(false)}
        title="Add User"
        maxWidth="xs"
        actions={
          <>
            <SecondaryButton onClick={() => setCreateUserOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton
              disabled={
                !userForm.fullName ||
                !userForm.username ||
                userForm.password.length < 8 ||
                !userForm.roleId ||
                createUserMutation.isPending
              }
              onClick={() => createUserMutation.mutate()}
            >
              Create
            </PrimaryButton>
          </>
        }
      >
        <Stack spacing={2} mt={0.5}>
          <TextField
            label="Full Name"
            value={userForm.fullName}
            onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
            autoFocus
          />
          <TextField label="Username" value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} />
          <TextField label="Email (optional)" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
          <TextField
            label="Password"
            type="password"
            helperText="At least 8 characters"
            value={userForm.password}
            onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
          />
          <TextField select label="Role" value={userForm.roleId} onChange={(e) => setUserForm({ ...userForm, roleId: e.target.value })}>
            <MenuItem value="">Select a role…</MenuItem>
            {(rolesQuery.data ?? []).map((role) => (
              <MenuItem key={role.id} value={role.id}>
                {role.name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </AppModal>

      <AppModal
        open={Boolean(editUserTarget)}
        onClose={() => setEditUserTarget(null)}
        title="Edit User"
        maxWidth="xs"
        actions={
          <>
            <SecondaryButton onClick={() => setEditUserTarget(null)}>Cancel</SecondaryButton>
            <PrimaryButton
              disabled={!editUserForm.fullName || !editUserForm.roleId || updateUserMutation.isPending}
              onClick={() => updateUserMutation.mutate()}
            >
              Save
            </PrimaryButton>
          </>
        }
      >
        <Stack spacing={2} mt={0.5}>
          <TextField label="Username" value={editUserForm.username} disabled />
          <TextField
            label="Full Name"
            value={editUserForm.fullName}
            onChange={(e) => setEditUserForm({ ...editUserForm, fullName: e.target.value })}
            autoFocus
          />
          <TextField
            label="Email (optional)"
            value={editUserForm.email}
            onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
          />
          <TextField
            label="New Password (optional)"
            type="password"
            helperText="Leave blank to keep current password"
            value={editUserForm.password}
            onChange={(e) => setEditUserForm({ ...editUserForm, password: e.target.value })}
          />
          <TextField
            select
            label="Role"
            value={editUserForm.roleId}
            onChange={(e) => setEditUserForm({ ...editUserForm, roleId: e.target.value })}
          >
            {editUserForm.roleId && !(rolesQuery.data ?? []).some((r) => r.id === editUserForm.roleId) && (
              <MenuItem value={editUserForm.roleId}>Loading…</MenuItem>
            )}
            {(rolesQuery.data ?? []).map((role) => (
              <MenuItem key={role.id} value={role.id}>
                {role.name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </AppModal>

      <ConfirmDialog
        open={Boolean(deactivateUserTarget)}
        title={deactivateUserTarget?.status === 'active' ? 'Deactivate User' : 'Reactivate User'}
        message={
          deactivateUserTarget?.status === 'active'
            ? `Deactivate "${deactivateUserTarget?.fullName}"? They will no longer be able to log in.`
            : `Reactivate "${deactivateUserTarget?.fullName}"? They will regain access immediately.`
        }
        confirmLabel={deactivateUserTarget?.status === 'active' ? 'Deactivate' : 'Reactivate'}
        destructive={deactivateUserTarget?.status === 'active'}
        onConfirm={() => deactivateUserTarget && toggleUserStatusMutation.mutate(deactivateUserTarget)}
        onCancel={() => setDeactivateUserTarget(null)}
      />

      <AppModal
        open={Boolean(editPrinterTarget)}
        onClose={() => setEditPrinterTarget(null)}
        title="Edit Printer"
        maxWidth="xs"
        actions={
          <>
            <SecondaryButton onClick={() => setEditPrinterTarget(null)}>Cancel</SecondaryButton>
            <PrimaryButton
              disabled={!editPrinterForm.name || !editPrinterForm.systemPrinterName || updatePrinterMutation.isPending}
              onClick={() => updatePrinterMutation.mutate()}
            >
              Save
            </PrimaryButton>
          </>
        }
      >
        <Stack spacing={2} mt={0.5}>
          <TextField
            label="Name"
            value={editPrinterForm.name}
            onChange={(e) => setEditPrinterForm({ ...editPrinterForm, name: e.target.value })}
            autoFocus
          />
          <TextField
            select
            label="Type"
            value={editPrinterForm.type}
            onChange={(e) => setEditPrinterForm({ ...editPrinterForm, type: e.target.value as PrinterType })}
          >
            {PRINTER_TYPES.map((t) => (
              <MenuItem key={t.value} value={t.value}>
                {t.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="System Printer"
            value={editPrinterForm.systemPrinterName}
            onChange={(e) => setEditPrinterForm({ ...editPrinterForm, systemPrinterName: e.target.value })}
          >
            {editPrinterForm.systemPrinterName && !systemPrinters.some((p) => p.name === editPrinterForm.systemPrinterName) && (
              <MenuItem value={editPrinterForm.systemPrinterName}>{editPrinterForm.systemPrinterName}</MenuItem>
            )}
            {systemPrinters.map((p) => (
              <MenuItem key={p.name} value={p.name}>
                {p.displayName || p.name}
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel
            control={
              <Checkbox
                checked={editPrinterForm.isDefaultReceipt}
                onChange={(e) => setEditPrinterForm({ ...editPrinterForm, isDefaultReceipt: e.target.checked })}
              />
            }
            label="Default for receipts"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={editPrinterForm.isDefaultInvoice}
                onChange={(e) => setEditPrinterForm({ ...editPrinterForm, isDefaultInvoice: e.target.checked })}
              />
            }
            label="Default for invoices"
          />
        </Stack>
      </AppModal>

      <ConfirmDialog
        open={Boolean(deletePrinterTarget)}
        title="Delete Printer"
        message={`Delete "${deletePrinterTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => deletePrinterTarget && deletePrinterMutation.mutate(deletePrinterTarget.id)}
        onCancel={() => setDeletePrinterTarget(null)}
      />

      {tab === (canManageUsers ? 5 : 4) && <CloudBackupTab setSnackbar={setSnackbar} />}

      <Snackbar open={Boolean(snackbar)} autoHideDuration={3000} onClose={() => setSnackbar(null)} message={snackbar} />
    </Box>
  );
}

// ─── Backup Tab ───────────────────────────────────────────────────────────────

const LOCAL_BACKUP_AUTO_KEY = 'vantage.localBackup.autoEnabled';
const LOCAL_BACKUP_LAST_KEY = 'vantage.localBackup.lastAt';
const LOCAL_BACKUP_INTERVAL_DAYS = 2;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function downloadBlobFromApi(url: string, filename: string, token: string | null): void {
  fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    .then((r) => {
      if (!r.ok) throw new Error('Download failed');
      return r.blob();
    })
    .then((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    });
}

function CloudBackupTab({ setSnackbar }: { setSnackbar: (msg: string) => void }): JSX.Element {
  const queryClient = useQueryClient();
  const restoreFileRef = useRef<HTMLInputElement>(null);
  const [restoreTarget, setRestoreTarget] = useState<BackupSnapshotMeta | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [autoLocal, setAutoLocal] = useState(
    () => localStorage.getItem(LOCAL_BACKUP_AUTO_KEY) === 'true',
  );
  const [lastLocalAt, setLastLocalAt] = useState<string | null>(
    () => localStorage.getItem(LOCAL_BACKUP_LAST_KEY),
  );
  const [localBusy, setLocalBusy] = useState(false);

  const base  = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:4000';
  const token = localStorage.getItem('vantage.accessToken');

  const statusQuery = useQuery({
    queryKey: ['backup-status'],
    queryFn: () => apiFetch<BackupStatus>('/api/v1/backup/status'),
  });

  const snapshotsQuery = useQuery({
    queryKey: ['backup-snapshots'],
    queryFn: () => apiFetch<BackupSnapshotMeta[]>('/api/v1/backup/snapshots'),
    enabled: statusQuery.data?.enabled === true,
  });

  const createMutation = useMutation({
    mutationFn: () => apiFetch('/api/v1/backup/create', { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => {
      setSnackbar('Cloud backup created.');
      queryClient.invalidateQueries({ queryKey: ['backup-status'] });
      queryClient.invalidateQueries({ queryKey: ['backup-snapshots'] });
    },
    onError: (e) => setSnackbar(e instanceof ApiError ? e.detail : 'Cloud backup failed.'),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/backup/snapshots/${id}/restore`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => {
      setSnackbar('Restore completed. Please refresh the app.');
      setRestoreTarget(null);
      setConfirmRestore(false);
    },
    onError: (e) => {
      setSnackbar(e instanceof ApiError ? e.detail : 'Restore failed.');
      setConfirmRestore(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/backup/snapshots/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setSnackbar('Snapshot deleted.');
      queryClient.invalidateQueries({ queryKey: ['backup-snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['backup-status'] });
    },
    onError: (e) => setSnackbar(e instanceof ApiError ? e.detail : 'Delete failed.'),
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${base}/api/v1/backup/import`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new ApiError(res.status, err.message ?? 'Restore failed.');
      }
      return res.json();
    },
    onSuccess: () => {
      setSnackbar('Restore completed. Please refresh the app.');
      queryClient.invalidateQueries({ queryKey: ['backup-status'] });
      queryClient.invalidateQueries({ queryKey: ['backup-snapshots'] });
    },
    onError: (e) => setSnackbar(e instanceof ApiError ? e.detail : 'Restore failed.'),
  });

  // Auto local backup: on mount, check if 2 days have passed
  useEffect(() => {
    if (!autoLocal) return;
    const last = lastLocalAt ? new Date(lastLocalAt).getTime() : 0;
    const daysSince = (Date.now() - last) / (1000 * 60 * 60 * 24);
    if (daysSince >= LOCAL_BACKUP_INTERVAL_DAYS) {
      handleLocalDownload(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleLocalDownload(silent = false): void {
    setLocalBusy(true);
    const now = new Date().toISOString();
    const filename = `local-backup-${now.slice(0, 10)}.json`;
    downloadBlobFromApi(`${base}/api/v1/backup/export`, filename, token);
    localStorage.setItem(LOCAL_BACKUP_LAST_KEY, now);
    setLastLocalAt(now);
    setLocalBusy(false);
    if (!silent) setSnackbar('Local backup downloaded.');
  }

  function toggleAutoLocal(checked: boolean): void {
    setAutoLocal(checked);
    localStorage.setItem(LOCAL_BACKUP_AUTO_KEY, String(checked));
  }

  if (statusQuery.isLoading) {
    return (
      <Box display="flex" justifyContent="center" mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  const status = statusQuery.data;
  const cloudEnabled = status?.enabled === true;

  return (
    <Box maxWidth={700}>

      {/* ── SECTION 1: Local Backup (always free) ── */}
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Local Backup
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Download your entire company data as a single JSON file to your computer. Free — always
        available. If your PC crashes or you reinstall the app, upload this file to restore all
        your data instantly.
      </Typography>

      <Box border={1} borderColor="divider" borderRadius={1.5} p={2} mb={1}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
          <Box>
            <Typography variant="body2" color="text.secondary">Last local backup</Typography>
            <Typography variant="body1">
              {lastLocalAt ? new Date(lastLocalAt).toLocaleString() : 'Never'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Switch
              size="small"
              checked={autoLocal}
              onChange={(e) => toggleAutoLocal(e.target.checked)}
            />
            <Typography variant="body2">Auto-backup every {LOCAL_BACKUP_INTERVAL_DAYS} days</Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              size="small"
              disabled={localBusy}
              onClick={() => handleLocalDownload(false)}
            >
              Download Backup Now
            </Button>
            <Button
              variant="outlined"
              size="small"
              disabled={importMutation.isPending}
              onClick={() => restoreFileRef.current?.click()}
            >
              {importMutation.isPending ? 'Restoring…' : 'Restore from File'}
            </Button>
            <input
              ref={restoreFileRef}
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importMutation.mutate(file);
                e.target.value = '';
              }}
            />
          </Stack>
        </Stack>
      </Box>

      <Typography variant="caption" color="text.secondary" display="block" mb={4}>
        After reinstalling: open the app → log in → Settings → Backup → "Restore from File" and select
        your downloaded .json file.
      </Typography>

      {/* ── SECTION 2: Cloud Backup (paid, superadmin-enabled) ── */}
      <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
        <Typography variant="subtitle1" fontWeight={600}>
          Cloud Backup
        </Typography>
        <Chip
          size="small"
          label={cloudEnabled ? 'Enabled' : 'Not Enabled'}
          color={cloudEnabled ? 'success' : 'default'}
        />
      </Stack>
      <Typography variant="body2" color="text.secondary" mb={2}>
        When enabled by your administrator, your data is also saved securely on our server. You can
        restore any cloud snapshot even after a complete reinstall without needing the local file.
      </Typography>

      {!cloudEnabled ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Cloud backup is not enabled for your account. Contact your platform administrator to activate
          this paid feature.
        </Alert>
      ) : (
        <>
          {/* Cloud status card */}
          <Box border={1} borderColor="divider" borderRadius={1.5} p={2} mb={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
              <Box>
                <Typography variant="body2" color="text.secondary">Last cloud backup</Typography>
                <Typography variant="body1">
                  {status?.lastBackedUpAt ? new Date(status.lastBackedUpAt).toLocaleString() : 'Never'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Snapshots</Typography>
                <Typography variant="body1">{status?.snapshotCount ?? 0} / {status?.maxSnapshots ?? 10}</Typography>
              </Box>
              <Button
                variant="contained"
                size="small"
                disabled={createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? 'Backing up…' : 'Create Cloud Backup'}
              </Button>
            </Stack>
          </Box>

          {/* Restore confirmation */}
          {confirmRestore && restoreTarget && (
            <Alert
              severity="warning"
              sx={{ mb: 2 }}
              action={
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    color="inherit"
                    disabled={restoreMutation.isPending}
                    onClick={() => restoreMutation.mutate(restoreTarget.id)}
                  >
                    {restoreMutation.isPending ? 'Restoring…' : 'Yes, Restore'}
                  </Button>
                  <Button size="small" color="inherit" onClick={() => { setConfirmRestore(false); setRestoreTarget(null); }}>
                    Cancel
                  </Button>
                </Stack>
              }
            >
              Restore from <strong>{restoreTarget.label}</strong>? This replaces all current data and
              cannot be undone.
            </Alert>
          )}

          {/* Cloud snapshot list */}
          <Typography variant="subtitle2" gutterBottom>Cloud Snapshots</Typography>
          {snapshotsQuery.isLoading ? (
            <CircularProgress size={24} />
          ) : (snapshotsQuery.data ?? []).length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No cloud snapshots yet. Click "Create Cloud Backup" to save one.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {(snapshotsQuery.data ?? []).map((snap) => (
                <Box
                  key={snap.id}
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  border={1}
                  borderColor="divider"
                  borderRadius={1}
                  px={2}
                  py={1}
                  flexWrap="wrap"
                  gap={1}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Chip label={`v${snap.version}`} size="small" />
                    <Box>
                      <Typography variant="body2">{snap.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(snap.createdAt).toLocaleString()} · {formatBytes(snap.sizeBytes)}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() =>
                        downloadBlobFromApi(
                          `${base}/api/v1/backup/snapshots/${snap.id}/download`,
                          `cloud-backup-v${snap.version}.json`,
                          token,
                        )
                      }
                    >
                      Download
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="warning"
                      onClick={() => { setRestoreTarget(snap); setConfirmRestore(true); }}
                    >
                      Restore
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(snap.id)}
                    >
                      Delete
                    </Button>
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </>
      )}
    </Box>
  );
}
