import type { ReactNode } from 'react';
import { Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface AppModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
}

// Standardized compact dialog wrapper — replaces ad hoc Dialog/DialogTitle/
// DialogContent/DialogActions blocks so every modal in the app shares the
// same reduced padding, title styling, and close affordance.
export function AppModal({
  open,
  onClose,
  title,
  children,
  actions,
  maxWidth = 'sm',
  fullWidth = true,
}: AppModalProps): JSX.Element {
  return (
    <Dialog open={open} onClose={onClose} maxWidth={maxWidth} fullWidth={fullWidth}>
      <DialogTitle component="div">
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          {title}
          <IconButton size="small" onClick={onClose} aria-label="Close dialog">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>{children}</DialogContent>
      {actions && <DialogActions>{actions}</DialogActions>}
    </Dialog>
  );
}
