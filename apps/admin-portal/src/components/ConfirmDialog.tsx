import { Typography } from '@mui/material';
import { AppModal } from './AppModal';
import { DangerButton, PrimaryButton, SecondaryButton } from './buttons';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): JSX.Element {
  const ConfirmButton = destructive ? DangerButton : PrimaryButton;
  return (
    <AppModal
      open={open}
      onClose={onCancel}
      title={title}
      maxWidth="xs"
      actions={
        <>
          <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
          <ConfirmButton onClick={onConfirm}>{confirmLabel}</ConfirmButton>
        </>
      }
    >
      <Typography>{message}</Typography>
    </AppModal>
  );
}
