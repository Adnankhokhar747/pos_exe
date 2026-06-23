import { Box, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import type { AlertEntry, PlatformAlerts } from '../api/types';
import { DataTable } from '../components/DataTable';

function AlertTable({
  rows,
  emptyMessage,
  showInvoices,
  showUsers,
}: {
  rows: AlertEntry[];
  emptyMessage: string;
  showInvoices?: boolean;
  showUsers?: boolean;
}): JSX.Element {
  return (
    <DataTable
      hideSearch
      emptyMessage={emptyMessage}
      getRowId={(e: AlertEntry) => e.tenantId}
      rows={rows}
      columns={[
        { key: 'tenantName', label: 'Company', sortable: true, render: (e) => e.tenantName },
        {
          key: 'daysUntilExpiry',
          label: 'Days Until Expiry',
          align: 'right',
          sortable: true,
          render: (e) => e.daysUntilExpiry,
        },
        ...(showUsers
          ? [
              {
                key: 'users',
                label: 'Users',
                align: 'right' as const,
                render: (e: AlertEntry) => `${e.userCount}${e.userLimit !== null ? ` / ${e.userLimit}` : ''}`,
              },
            ]
          : []),
        ...(showInvoices
          ? [
              {
                key: 'invoices',
                label: 'Invoices',
                align: 'right' as const,
                render: (e: AlertEntry) => `${e.invoiceCount}${e.invoiceLimit !== null ? ` / ${e.invoiceLimit}` : ''}`,
              },
            ]
          : []),
      ]}
    />
  );
}

export function AlertsPage(): JSX.Element {
  const alertsQuery = useQuery({
    queryKey: ['platform-alerts'],
    queryFn: () => apiFetch<PlatformAlerts>('/api/v1/platform/alerts'),
    refetchInterval: 60_000,
  });

  const alerts = alertsQuery.data;

  return (
    <Box p={2} height="100%" overflow="auto">
      <Typography variant="h6" gutterBottom>
        Alerts
      </Typography>

      <Typography variant="subtitle1" gutterBottom>
        Expired
      </Typography>
      <Box mb={4}>
        <AlertTable rows={alerts?.expired ?? []} emptyMessage="No expired subscriptions." />
      </Box>

      <Typography variant="subtitle1" gutterBottom>
        Expiring Soon (≤ 30 days)
      </Typography>
      <Box mb={4}>
        <AlertTable rows={alerts?.expiringSoon ?? []} emptyMessage="No subscriptions expiring soon." />
      </Box>

      <Typography variant="subtitle1" gutterBottom>
        Near Invoice Limit (≥ 90%)
      </Typography>
      <Box mb={4}>
        <AlertTable rows={alerts?.nearInvoiceLimit ?? []} emptyMessage="No companies near their invoice limit." showInvoices />
      </Box>

      <Typography variant="subtitle1" gutterBottom>
        Near User Limit (≥ 90%)
      </Typography>
      <Box mb={4}>
        <AlertTable rows={alerts?.nearUserLimit ?? []} emptyMessage="No companies near their user limit." showUsers />
      </Box>
    </Box>
  );
}
