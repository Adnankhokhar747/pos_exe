import { useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import VisibilityIcon    from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useMutation }   from '@tanstack/react-query';
import { apiFetch, ApiError } from '../api/client';
import type { AuthenticatedUser } from '../api/types';
import { PrimaryButton }  from '../components/buttons';
import { useAuth }        from '../state/auth-context';

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export function ProfilePage(): JSX.Element {
  const { user, refreshUser } = useAuth();

  const [fullName, setFullName]         = useState(user?.fullName ?? '');
  const [currentPw, setCurrentPw]       = useState('');
  const [newPw, setNewPw]               = useState('');
  const [confirmPw, setConfirmPw]       = useState('');
  const [showCurrent, setShowCurrent]   = useState(false);
  const [showNew, setShowNew]           = useState(false);
  const [snackbar, setSnackbar]         = useState<string | null>(null);
  const [snackbarSeverity, setSeverity] = useState<'success' | 'error'>('success');

  const nameDirty = fullName.trim() !== (user?.fullName ?? '').trim();
  const pwFilled  = currentPw.length > 0 || newPw.length > 0;
  const pwValid   = !pwFilled || (currentPw.length > 0 && newPw.length >= 6 && newPw === confirmPw);
  const canSave   = (nameDirty || pwFilled) && pwValid && fullName.trim().length > 0;

  const saveMutation = useMutation({
    mutationFn: () => apiFetch<AuthenticatedUser>('/api/v1/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({
        ...(nameDirty ? { fullName: fullName.trim() } : {}),
        ...(pwFilled  ? { currentPassword: currentPw, newPassword: newPw } : {}),
      }),
    }),
    onSuccess: async () => {
      await refreshUser();
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setSeverity('success');
      setSnackbar('Profile updated.');
    },
    onError: (e) => {
      setSeverity('error');
      setSnackbar(e instanceof ApiError ? e.detail : 'Could not update profile.');
    },
  });

  return (
    <Box p={3} maxWidth={520}>

      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main', fontSize: '1.3rem', fontWeight: 700 }}>
          {user?.fullName ? getInitials(user.fullName) : <AccountCircleIcon />}
        </Avatar>
        <Box>
          <Typography variant="h6" fontWeight={700}>{user?.fullName}</Typography>
          <Typography variant="body2" color="text.secondary">@{user?.username}</Typography>
        </Box>
      </Stack>

      <Stack spacing={3}>

        {/* ── Display name ─────────────────────────────────────────────── */}
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
          <Typography variant="subtitle2" fontWeight={700} mb={2}>Display Name</Typography>
          <TextField
            label="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            fullWidth
            size="small"
            inputProps={{ maxLength: 100 }}
          />
        </Paper>

        {/* ── Change password ───────────────────────────────────────────── */}
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
          <Typography variant="subtitle2" fontWeight={700} mb={0.5}>Change Password</Typography>
          <Typography variant="caption" color="text.secondary" display="block" mb={2}>
            Leave blank to keep your current password.
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="Current Password"
              type={showCurrent ? 'text' : 'password'}
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              fullWidth size="small"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowCurrent((v) => !v)} edge="end">
                      {showCurrent ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="New Password"
              type={showNew ? 'text' : 'password'}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              fullWidth size="small"
              error={newPw.length > 0 && newPw.length < 6}
              helperText={newPw.length > 0 && newPw.length < 6 ? 'At least 6 characters' : ''}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowNew((v) => !v)} edge="end">
                      {showNew ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Confirm New Password"
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              fullWidth size="small"
              error={confirmPw.length > 0 && confirmPw !== newPw}
              helperText={confirmPw.length > 0 && confirmPw !== newPw ? 'Passwords do not match' : ''}
            />
          </Stack>
        </Paper>

        <Divider />

        <PrimaryButton
          disabled={!canSave || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          sx={{ alignSelf: 'flex-start' }}
        >
          {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
        </PrimaryButton>
      </Stack>

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={3500}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbarSeverity} onClose={() => setSnackbar(null)} variant="filled" sx={{ width: '100%' }}>
          {snackbar}
        </Alert>
      </Snackbar>
    </Box>
  );
}
