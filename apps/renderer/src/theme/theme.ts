import { createTheme } from '@mui/material/styles';

// Design tokens per docs/07-ui-wireframes.md §8 — light/dark share structure,
// only the palette changes, so a theme switch never reflows the POS layout.
//
// Component defaults below are the single source of truth for sizing: every
// TextField/Select/Button/Table across the app inherits dense, consistent
// dimensions from here instead of each page re-deciding `size="small"` ad hoc.
export function createAppTheme(mode: 'light' | 'dark') {
  const isLight = mode === 'light';

  return createTheme({
    palette: {
      mode,
      primary: { main: '#1565c0' },
      secondary: { main: '#00897b' },
      success: { main: '#2e7d32' },
      warning: { main: '#ed6c02' },
      error: { main: '#d32f2f' },
      background: {
        default: isLight ? '#f3f5f7' : '#0f1216',
        paper: isLight ? '#ffffff' : '#1a1d21',
      },
    },
    shape: { borderRadius: 8 },
    spacing: 8,
    typography: {
      fontSize: 13,
      h4: { fontSize: '1.6rem', fontWeight: 700 },
      h5: { fontSize: '1.25rem', fontWeight: 700 },
      h6: { fontSize: '1.05rem', fontWeight: 600 },
      subtitle1: { fontSize: '0.95rem', fontWeight: 600 },
      subtitle2: { fontSize: '0.85rem', fontWeight: 600 },
      body1: { fontSize: '0.875rem' },
      body2: { fontSize: '0.8125rem' },
      caption: { fontSize: '0.7rem' },
      button: { fontWeight: 600, textTransform: 'none' },
    },
    components: {
      MuiTextField: {
        defaultProps: { size: 'small' },
      },
      MuiSelect: {
        defaultProps: { size: 'small' },
      },
      MuiFormControl: {
        defaultProps: { size: 'small' },
      },
      MuiAutocomplete: {
        defaultProps: { size: 'small' },
      },
      MuiButton: {
        defaultProps: { size: 'small', disableElevation: true },
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 600, borderRadius: 6 },
        },
      },
      MuiIconButton: {
        defaultProps: { size: 'small' },
      },
      MuiChip: {
        defaultProps: { size: 'small' },
      },
      MuiTable: {
        defaultProps: { size: 'small' },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { padding: '7px 12px', fontSize: '0.8125rem' },
          head: { fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.3 },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: { padding: '12px 20px', fontSize: '1rem', fontWeight: 700 },
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          root: { padding: '16px 20px' },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: { padding: '10px 20px' },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: { borderRadius: 10 },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: { borderRadius: 6 },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: { minHeight: 40, textTransform: 'none', fontWeight: 600 },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: { minHeight: 40 },
        },
      },
    },
  });
}
