import { useState, type FormEvent } from 'react';
import { Box, Button, Card, CardContent, TextField, Typography, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { apiFetch, ApiError } from '../api/client';
import type { LoginResponse } from '../api/types';
import { useAuth } from '../state/auth-context';

export function LoginPage(): JSX.Element {
  const [username, setUsername] = useState('admin');
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
      const result = await apiFetch<LoginResponse>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      login(result.accessToken, result.user);
      navigate('/pos');
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Unable to reach the Branch API.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box display="flex" alignItems="center" justifyContent="center" minHeight="100vh" bgcolor="background.default">
      <Card sx={{ width: 360 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Vantage POS
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Sign in to continue
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
            <Button type="submit" variant="contained" size="large" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign In'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
