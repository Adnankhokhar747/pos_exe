import { useState, type FormEvent } from 'react';
import { Box, Card, CardContent, TextField, Typography, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { apiFetch, ApiError } from '../api/client';
import type { PlatformLoginResponse } from '../api/types';
import { PrimaryButton } from '../components/buttons';
import { useAuth } from '../state/auth-context';

export function LoginPage(): JSX.Element {
  const [username, setUsername] = useState('superadmin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await apiFetch<PlatformLoginResponse>('/api/v1/platform/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      login(result.accessToken, result.admin);
      navigate('/companies');
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Unable to reach the Branch API.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box display="flex" alignItems="center" justifyContent="center" minHeight="100vh" bgcolor="background.default">
      <Card sx={{ width: 380 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Vantage POS
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Super Admin Portal
          </Typography>
          <Box component="form" onSubmit={handleSubmit} display="flex" flexDirection="column" gap={2} mt={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <PrimaryButton type="submit" size="large" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign In'}
            </PrimaryButton>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
