import { Box, Card, CardContent, Typography } from '@mui/material';
import LockClockIcon from '@mui/icons-material/LockClock';
import { useAuth } from '../state/auth-context';
import { useLicense } from '../state/license-context';
import { SecondaryButton } from '../components/buttons';

export function LicenseBlockedScreen(): JSX.Element {
  const { logout } = useAuth();
  const { status } = useLicense();

  return (
    <Box display="flex" alignItems="center" justifyContent="center" minHeight="100vh" bgcolor="background.default">
      <Card sx={{ width: 440 }}>
        <CardContent sx={{ textAlign: 'center', py: 5 }}>
          <LockClockIcon color="error" sx={{ fontSize: 56, mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Subscription Expired
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {status?.message ?? 'Access to this company has been suspended. Please contact your administrator to renew the subscription.'}
          </Typography>
          <SecondaryButton sx={{ mt: 3 }} onClick={logout}>
            Sign out
          </SecondaryButton>
        </CardContent>
      </Card>
    </Box>
  );
}
