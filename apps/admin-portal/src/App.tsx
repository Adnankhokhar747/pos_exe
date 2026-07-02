import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { CompaniesPage } from './pages/CompaniesPage';
import { PlansPage } from './pages/PlansPage';
import { AlertsPage } from './pages/AlertsPage';
import { ModulesPage } from './pages/ModulesPage';
import { AppShell } from './layout/AppShell';
import { useAuth } from './state/auth-context';

function RequireAuth({ children }: { children: JSX.Element }): JSX.Element {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
}

export function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/companies"
        element={
          <RequireAuth>
            <CompaniesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/plans"
        element={
          <RequireAuth>
            <PlansPage />
          </RequireAuth>
        }
      />
      <Route
        path="/alerts"
        element={
          <RequireAuth>
            <AlertsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/modules"
        element={
          <RequireAuth>
            <ModulesPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/companies" replace />} />
    </Routes>
  );
}
