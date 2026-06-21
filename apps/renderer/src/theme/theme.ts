import { createTheme } from '@mui/material/styles';

// Design tokens per docs/07-ui-wireframes.md §8 — light/dark share structure,
// only the palette changes, so a theme switch never reflows the POS layout.
export function createAppTheme(mode: 'light' | 'dark') {
  return createTheme({
    palette: {
      mode,
      primary: { main: '#1565c0' },
      secondary: { main: '#00897b' },
    },
    shape: { borderRadius: 8 },
  });
}
