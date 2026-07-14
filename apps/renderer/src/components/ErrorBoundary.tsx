import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Box, Button, Typography } from '@mui/material';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <Box p={4} display="flex" flexDirection="column" alignItems="center" gap={2}>
          <Typography variant="h6" color="error">
            Something went wrong loading this page.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', maxWidth: 600, wordBreak: 'break-word' }}>
            {this.state.message}
          </Typography>
          <Button variant="outlined" onClick={() => this.setState({ hasError: false, message: '' })}>
            Try Again
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}
