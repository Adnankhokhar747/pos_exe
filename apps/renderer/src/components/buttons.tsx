import { forwardRef } from 'react';
import { Button, type ButtonProps } from '@mui/material';

// Semantic button variants per the design system — pick by intent (Primary
// CTA / neutral secondary action / destructive action / confirm-positive
// action) instead of remembering which `color`/`variant` combo to type out
// at every call site.

export const PrimaryButton = forwardRef<HTMLButtonElement, ButtonProps>(function PrimaryButton(props, ref) {
  return <Button ref={ref} variant="contained" color="primary" {...props} />;
});

export const SecondaryButton = forwardRef<HTMLButtonElement, ButtonProps>(function SecondaryButton(props, ref) {
  return <Button ref={ref} variant="outlined" color="primary" {...props} />;
});

export const DangerButton = forwardRef<HTMLButtonElement, ButtonProps>(function DangerButton(props, ref) {
  return <Button ref={ref} variant="contained" color="error" {...props} />;
});

export const SuccessButton = forwardRef<HTMLButtonElement, ButtonProps>(function SuccessButton(props, ref) {
  return <Button ref={ref} variant="contained" color="success" {...props} />;
});
