import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { AuthProvider } from './state/auth-context';
import { LicenseProvider } from './state/license-context';
import { ModulesProvider } from './state/modules-context';
import { createAppTheme } from './theme/theme';
import './styles.css';

const queryClient = new QueryClient();

function Root(): JSX.Element {
  const [mode] = useState<'light' | 'dark'>('light');
  return (
    <ThemeProvider theme={createAppTheme(mode)}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LicenseProvider>
            <ModulesProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </ModulesProvider>
          </LicenseProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
