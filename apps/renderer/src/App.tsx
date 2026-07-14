import { Navigate, Route, Routes } from 'react-router-dom';
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
import { DoctorsPage } from './pages/DoctorsPage';
import { PatientsPage } from './pages/PatientsPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { TokenQueuePage } from './pages/TokenQueuePage';
import { DoctorReportsPage } from './pages/DoctorReportsPage';
import { AppShell } from './layout/AppShell';
import { LicenseBlockedScreen } from './layout/LicenseBlockedScreen';
import { useAuth } from './state/auth-context';
import { useLicense } from './state/license-context';
import { useModules } from './state/modules-context';

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
  const { isBlocked } = useLicense();
  const { isModuleEnabled } = useModules();

  if (isLoading) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" height="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isBlocked) return <LicenseBlockedScreen />;
  if (permission && !user?.permissions.includes(permission)) return <Navigate to="/pos" replace />;
  if (requiredModule && !isModuleEnabled(requiredModule)) return <Navigate to="/pos" replace />;

  return (
    <AppShell>
      <ErrorBoundary>{children}</ErrorBoundary>
    </AppShell>
  );
}

export function App(): JSX.Element {
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
      <Route path="*" element={<Navigate to="/pos" replace />} />
    </Routes>
  );
}
