import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginPage } from './pages/LoginPage';
import { PosPage } from './pages/PosPage';
import { CustomersPage } from './pages/CustomersPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { PurchasingPage } from './pages/PurchasingPage';
import { InventoryPage } from './pages/InventoryPage';
import { ReportsPage } from './pages/ReportsPage';
import { AccountingPage } from './pages/AccountingPage';
import { SettingsPage } from './pages/SettingsPage';
import { CatalogPage } from './pages/CatalogPage';
import { PromotionsPage } from './pages/PromotionsPage';
import { DashboardPage } from './pages/DashboardPage';
import { DoctorsPage } from './pages/DoctorsPage';
import { PatientsPage } from './pages/PatientsPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { TokenQueuePage } from './pages/TokenQueuePage';
import { DoctorReportsPage } from './pages/DoctorReportsPage';
import { LeaseDashboardPage } from './pages/LeaseDashboardPage';

import { LeaseAgreementsPage } from './pages/LeaseAgreementsPage';
import { LeaseReportsPage } from './pages/LeaseReportsPage';
import { EInvoiceSettingsPage }    from './pages/EInvoiceSettingsPage';
import { WhatsAppSettingsPage }       from './pages/WhatsAppSettingsPage';
import { CashReconciliationPage }     from './pages/CashReconciliationPage';
import { HrEmployeesPage }        from './pages/HrEmployeesPage';
import { HrShiftsPage }           from './pages/HrShiftsPage';
import { HrAttendancePage }       from './pages/HrAttendancePage';
import { HrLeavesPage }           from './pages/HrLeavesPage';
import { HrPayrollPage }          from './pages/HrPayrollPage';
import { HrReportsPage }          from './pages/HrReportsPage';
import { ProfilePage }            from './pages/ProfilePage';
import { AppShell } from './layout/AppShell';
import { LicenseBlockedScreen } from './layout/LicenseBlockedScreen';
import { OfflineLicenseExpiredScreen } from './layout/OfflineLicenseExpiredScreen';
import { useAuth } from './state/auth-context';
import { useLicense } from './state/license-context';
import { useModules } from './state/modules-context';
import { useSubscriptionNotification } from './hooks/useSubscriptionNotification';

function RequireAuth({
  children,
  permission,
  requiredModule,
}: {
  children: JSX.Element;
  permission?: string;
  requiredModule?: string;
}): JSX.Element {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { isBlocked, isOffline, offlineCacheExpired } = useLicense();
  const { isModuleEnabled } = useModules();
  const location = useLocation();

  if (isLoading) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" height="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (offlineCacheExpired) return <OfflineLicenseExpiredScreen />;
  if (isBlocked) return <LicenseBlockedScreen />;
  if (isOffline && !location.pathname.startsWith('/pos') && !location.pathname.startsWith('/settings')) {
    return <Navigate to="/pos" replace />;
  }
  const perms = user?.permissions ?? [];
  const hasAll = perms.includes('ALL') || perms.includes('*');
  const PHP_ALIASES: Record<string, string> = {
    'product.write': 'product.manage',
    'stock.adjust': 'inventory.adjust',
    'stock.transfer': 'inventory.manage',
    'settings.write': 'settings.manage',
    'customer.write': 'customer.manage',
    'supplier.write': 'supplier.manage',
    'purchase.create': 'purchase.manage',
    'report.financial.view': 'report.view',
    'accounting.write': 'expense.manage',
  };
  function hasPerm(code: string): boolean {
    return perms.includes(code) || perms.includes(PHP_ALIASES[code] ?? '');
  }
  if (permission && !hasAll && !hasPerm(permission)) return <Navigate to="/dashboard" replace />;
  if (requiredModule && !isModuleEnabled(requiredModule)) return <Navigate to="/pos" replace />;

  return (
    <AppShell>
      <ErrorBoundary>{children}</ErrorBoundary>
    </AppShell>
  );
}

export function App(): JSX.Element {
  useSubscriptionNotification();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/pos"
        element={
          <RequireAuth>
            <PosPage />
          </RequireAuth>
        }
      />
      <Route
        path="/customers"
        element={
          <RequireAuth permission="customer.manage">
            <CustomersPage />
          </RequireAuth>
        }
      />
      <Route
        path="/suppliers"
        element={
          <RequireAuth permission="supplier.manage">
            <SuppliersPage />
          </RequireAuth>
        }
      />
      <Route
        path="/purchasing"
        element={
          <RequireAuth permission="purchase.manage">
            <PurchasingPage />
          </RequireAuth>
        }
      />
      <Route
        path="/inventory"
        element={
          <RequireAuth permission="inventory.adjust">
            <InventoryPage />
          </RequireAuth>
        }
      />
      <Route
        path="/reports"
        element={
          <RequireAuth permission="report.view">
            <ReportsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/accounting"
        element={
          <RequireAuth permission="expense.manage">
            <AccountingPage />
          </RequireAuth>
        }
      />
      <Route
        path="/catalog"
        element={
          <RequireAuth permission="product.manage">
            <CatalogPage />
          </RequireAuth>
        }
      />
      <Route
        path="/promotions"
        element={
          <RequireAuth permission="settings.manage">
            <PromotionsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <SettingsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/hospital/doctors"
        element={
          <RequireAuth permission="hospital.doctor.manage" requiredModule="hospital">
            <DoctorsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/hospital/patients"
        element={
          <RequireAuth permission="hospital.patient.manage" requiredModule="hospital">
            <PatientsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/hospital/appointments"
        element={
          <RequireAuth permission="hospital.appointment.manage" requiredModule="hospital">
            <AppointmentsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/hospital/queue"
        element={
          <RequireAuth requiredModule="hospital">
            <TokenQueuePage />
          </RequireAuth>
        }
      />
      <Route
        path="/hospital/reports"
        element={
          <RequireAuth permission="hospital.report.view" requiredModule="hospital">
            <DoctorReportsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route path="/einvoice/settings" element={<RequireAuth requiredModule="einvoice"><EInvoiceSettingsPage /></RequireAuth>} />
      <Route path="/whatsapp/settings" element={<RequireAuth requiredModule="whatsapp"><WhatsAppSettingsPage /></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
      <Route path="/lease/dashboard" element={<RequireAuth requiredModule="lease"><LeaseDashboardPage /></RequireAuth>} />

      <Route path="/lease/agreements" element={<RequireAuth permission="lease.agreement.manage" requiredModule="lease"><LeaseAgreementsPage /></RequireAuth>} />
      <Route path="/lease/reports"    element={<RequireAuth permission="lease.report.view"     requiredModule="lease"><LeaseReportsPage /></RequireAuth>} />
      <Route path="/cash-reconciliation" element={<RequireAuth permission="cash.manage"><CashReconciliationPage /></RequireAuth>} />
      <Route path="/hr/employees"  element={<RequireAuth permission="hr.employee.manage"  requiredModule="hr"><HrEmployeesPage /></RequireAuth>} />
      <Route path="/hr/shifts"     element={<RequireAuth permission="hr.employee.manage"  requiredModule="hr"><HrShiftsPage /></RequireAuth>} />
      <Route path="/hr/attendance" element={<RequireAuth requiredModule="hr"><HrAttendancePage /></RequireAuth>} />
      <Route path="/hr/leaves"     element={<RequireAuth permission="hr.leave.manage"     requiredModule="hr"><HrLeavesPage /></RequireAuth>} />
      <Route path="/hr/payroll"    element={<RequireAuth permission="hr.payroll.manage"   requiredModule="hr"><HrPayrollPage /></RequireAuth>} />
      <Route path="/hr/reports"    element={<RequireAuth permission="hr.report.view"      requiredModule="hr"><HrReportsPage /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
