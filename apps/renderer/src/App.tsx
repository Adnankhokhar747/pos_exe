import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { PosPage } from './pages/PosPage';
import { useAuth } from './state/auth-context';

function RequireAuth({ children }: { children: JSX.Element }): JSX.Element {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
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
      <Route path="*" element={<Navigate to="/pos" replace />} />
    </Routes>
  );
}
