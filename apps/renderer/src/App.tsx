import { Navigate, Route, Routes } from 'react-router-dom';
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
import { AppShell } from './layout/AppShell';
import { LicenseBlockedScreen } from './layout/LicenseBlockedScreen';
import { useAuth } from './state/auth-context';
import { useLicense } from './state/license-context';

function RequireAuth({ children, permission }: { children: JSX.Element; permission?: string }): JSX.Element {
  const { isAuthenticated, user } = useAuth();
  const { isBlocked } = useLicense();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isBlocked) return <LicenseBlockedScreen />;
  if (permission && !user?.permissions.includes(permission)) return <Navigate to="/pos" replace />;

  return <AppShell>{children}</AppShell>;
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
          <RequireAuth permission="customer.write">
            <CustomersPage />
          </RequireAuth>
        }
      />
      <Route
        path="/suppliers"
        element={
          <RequireAuth permission="supplier.write">
            <SuppliersPage />
          </RequireAuth>
        }
      />
      <Route
        path="/purchasing"
        element={
          <RequireAuth permission="purchase.create">
            <PurchasingPage />
          </RequireAuth>
        }
      />
      <Route
        path="/inventory"
        element={
          <RequireAuth permission="stock.adjust">
            <InventoryPage />
          </RequireAuth>
        }
      />
      <Route
        path="/reports"
        element={
          <RequireAuth permission="report.financial.view">
            <ReportsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/accounting"
        element={
          <RequireAuth permission="accounting.write">
            <AccountingPage />
          </RequireAuth>
        }
      />
      <Route
        path="/catalog"
        element={
          <RequireAuth permission="product.write">
            <CatalogPage />
          </RequireAuth>
        }
      />
      <Route
        path="/promotions"
        element={
          <RequireAuth permission="settings.write">
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
      <Route path="*" element={<Navigate to="/pos" replace />} />
    </Routes>
  );
}
