import { useEffect, useState } from 'react';
import { Alert, Button, Stack, Typography } from '@mui/material';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';

interface UpdateInfo {
  version: string;
  releaseNotes?: string | null;
}

export function UpdateBanner(): JSX.Element | null {
  const [downloaded, setDownloaded] = useState<UpdateInfo | null>(null);
  const [available, setAvailable] = useState<UpdateInfo | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!window.vantage?.updater) return;
    window.vantage.updater.onAvailable((info) => setAvailable(info));
    window.vantage.updater.onDownloaded((info) => setDownloaded(info));
  }, []);

  if (downloaded) {
    return (
      <Alert
        severity="info"
        icon={<SystemUpdateAltIcon fontSize="inherit" />}
        sx={{ borderRadius: 0 }}
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              size="small"
              variant="contained"
              disabled={installing}
              onClick={async () => {
                setInstalling(true);
                await window.vantage!.updater.installNow();
              }}
            >
              {installing ? 'Restarting…' : 'Restart & Install'}
            </Button>
            <Button size="small" onClick={() => setDownloaded(null)}>
              Later
            </Button>
          </Stack>
        }
      >
        <Typography variant="body2">
          <strong>Version {downloaded.version} is ready.</strong> Restart the app to apply the update. Your data is
          safe — only the app files are replaced.
        </Typography>
      </Alert>
    );
  }

  if (available) {
    return (
      <Alert severity="info" icon={<SystemUpdateAltIcon fontSize="inherit" />} sx={{ borderRadius: 0 }} onClose={() => setAvailable(null)}>
        <Typography variant="body2">
          Version {available.version} is downloading in the background — you will be prompted to restart when ready.
        </Typography>
      </Alert>
    );
  }

  return null;
}
