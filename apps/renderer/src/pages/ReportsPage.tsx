import { useState } from 'react';
import { Box, Card, CircularProgress, Stack, Tab, Table, TableBody, TableCell, TableRow, Tabs, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import type { InventoryValuation, InventoryValuationLine, LowStockLine, SalesSummary, TopProduct } from '../api/types';
import { DataTable } from '../components/DataTable';
import { useAuth } from '../state/auth-context';

function defaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ReportsPage(): JSX.Element {
  const { user } = useAuth();
  const ACTIVE_BRANCH_ID = user!.branchId;
  const ACTIVE_WAREHOUSE_ID = user!.warehouseId;
  const [tab, setTab] = useState(0);
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(defaultTo());

  const salesSummaryQuery = useQuery({
    queryKey: ['sales-summary', from, to],
    queryFn: () =>
      apiFetch<SalesSummary>(`/api/v1/reports/sales-summary?branchId=${ACTIVE_BRANCH_ID}&from=${from}&to=${to}`),
    enabled: tab === 0,
  });

  const topProductsQuery = useQuery({
    queryKey: ['top-products', from, to],
    queryFn: () =>
      apiFetch<TopProduct[]>(`/api/v1/reports/top-products?branchId=${ACTIVE_BRANCH_ID}&from=${from}&to=${to}`),
    enabled: tab === 1,
  });

  const valuationQuery = useQuery({
    queryKey: ['inventory-valuation'],
    queryFn: () => apiFetch<InventoryValuation>(`/api/v1/reports/inventory-valuation?warehouseId=${ACTIVE_WAREHOUSE_ID}`),
    enabled: tab === 2,
  });

  const lowStockQuery = useQuery({
    queryKey: ['low-stock'],
    queryFn: () => apiFetch<LowStockLine[]>(`/api/v1/reports/low-stock?warehouseId=${ACTIVE_WAREHOUSE_ID}`),
    enabled: tab === 3,
  });

  return (
    <Box p={2} height="100%" overflow="auto">
      <Typography variant="h6" gutterBottom>
        Reports
      </Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Sales Summary" />
        <Tab label="Top Products" />
        <Tab label="Inventory Valuation" />
        <Tab label="Low Stock" />
      </Tabs>

      {(tab === 0 || tab === 1) && (
        <Stack direction="row" spacing={2} mb={2} maxWidth={500}>
          <TextField
            label="From"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <TextField
            label="To"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Stack>
      )}

      {tab === 0 && (
        salesSummaryQuery.isLoading ? (
          <CircularProgress />
        ) : salesSummaryQuery.isError ? (
          <Typography color="error">Failed to load sales summary. Please try again.</Typography>
        ) : salesSummaryQuery.data ? (
          <Card variant="outlined" sx={{ maxWidth: 420 }}>
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell>Gross Sales</TableCell>
                  <TableCell align="right">{Number(salesSummaryQuery.data.grossSales).toFixed(2)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Discounts</TableCell>
                  <TableCell align="right">{Number(salesSummaryQuery.data.discounts).toFixed(2)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Tax Collected</TableCell>
                  <TableCell align="right">{Number(salesSummaryQuery.data.taxCollected).toFixed(2)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <strong>Net Sales</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>{Number(salesSummaryQuery.data.netSales).toFixed(2)}</strong>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>
        ) : (
          <Typography color="text.secondary">No sales data for this period.</Typography>
        )
      )}

      {tab === 1 && (
        topProductsQuery.isLoading ? (
          <CircularProgress />
        ) : topProductsQuery.isError ? (
          <Typography color="error">Failed to load top products. Please try again.</Typography>
        ) : (
          <DataTable
            searchPlaceholder="Search products…"
            emptyMessage="No sales in this date range."
            getRowId={(p: TopProduct) => p.productId}
            rows={topProductsQuery.data ?? []}
            getSearchText={(p) => p.name}
            columns={[
              { key: 'name', label: 'Product', sortable: true, render: (p) => p.name },
              { key: 'quantitySold', label: 'Quantity Sold', align: 'right', sortable: true, render: (p) => p.quantitySold },
              {
                key: 'revenue',
                label: 'Revenue',
                align: 'right',
                sortable: true,
                sortValue: (p) => Number(p.revenue),
                render: (p) => Number(p.revenue).toFixed(2),
              },
            ]}
          />
        )
      )}

      {tab === 2 && (
        valuationQuery.isLoading ? (
          <CircularProgress />
        ) : valuationQuery.isError ? (
          <Typography color="error">Failed to load inventory valuation. Please try again.</Typography>
        ) : valuationQuery.data ? (
          <>
            <DataTable
              searchPlaceholder="Search products…"
              emptyMessage="No inventory on hand."
              getRowId={(l: InventoryValuationLine) => l.productId}
              rows={valuationQuery.data.lines}
              getSearchText={(l) => l.name}
              columns={[
                { key: 'name', label: 'Product', sortable: true, render: (l) => l.name },
                { key: 'quantityOnHand', label: 'On Hand', align: 'right', sortable: true, render: (l) => l.quantityOnHand },
                {
                  key: 'costPrice',
                  label: 'Cost Price',
                  align: 'right',
                  sortable: true,
                  sortValue: (l) => Number(l.costPrice),
                  render: (l) => Number(l.costPrice).toFixed(2),
                },
                {
                  key: 'value',
                  label: 'Value',
                  align: 'right',
                  sortable: true,
                  sortValue: (l) => Number(l.value),
                  render: (l) => Number(l.value).toFixed(2),
                },
              ]}
            />
            <Typography variant="h6" mt={2}>
              Total: {Number(valuationQuery.data.total).toFixed(2)}
            </Typography>
          </>
        ) : (
          <Typography color="text.secondary">No inventory data available.</Typography>
        )
      )}

      {tab === 3 && (
        lowStockQuery.isLoading ? (
          <CircularProgress />
        ) : lowStockQuery.isError ? (
          <Typography color="error">Failed to load low stock report. Please try again.</Typography>
        ) : (
          <DataTable
            searchPlaceholder="Search products…"
            emptyMessage="No products below reorder level."
            getRowId={(l: LowStockLine) => l.productId}
            rows={lowStockQuery.data ?? []}
            getSearchText={(l) => l.name}
            columns={[
              { key: 'name', label: 'Product', sortable: true, render: (l) => l.name },
              { key: 'quantityOnHand', label: 'On Hand', align: 'right', sortable: true, render: (l) => l.quantityOnHand },
              { key: 'reorderLevel', label: 'Reorder Level', align: 'right', sortable: true, render: (l) => l.reorderLevel },
            ]}
          />
        )
      )}
    </Box>
  );
}
