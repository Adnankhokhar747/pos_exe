import { Box, Card, CardContent, Typography } from '@mui/material';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import { useAuth } from '../state/auth-context';
import { SecondaryButton } from '../components/buttons';

export function OfflineLicenseExpiredScreen(): JSX.Element {
  const { logout } = useAuth();

  return (
    <Box display="flex" alignItems="center" justifyContent="center" minHeight="100vh" bgcolor="background.default">
      <Card sx={{ width: 440 }}>
        <CardContent sx={{ textAlign: 'center', py: 5 }}>
          <WifiOffIcon color="error" sx={{ fontSize: 56, mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Connection Required
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Your 7-day offline grace period has expired.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Please connect to the internet and restart the application to continue.
          </Typography>
          <SecondaryButton sx={{ mt: 3 }} onClick={logout}>
            Sign out
          </SecondaryButton>
        </CardContent>
      </Card>
    </Box>
  );
}
