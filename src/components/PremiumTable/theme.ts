import { createTheme } from '@mui/material';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';

const MONO_FONT = "'JetBrains Mono', 'Fira Code', Consolas, monospace";

// Default dark theme for standalone use — internal to PremiumTable, not exported from library
export const defaultTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#00ff00' },
    background: { default: '#0a0a0a', paper: '#111111' },
    text: { primary: '#00ff00', secondary: 'rgba(0, 255, 0, 0.4)' },
    divider: 'rgba(0, 255, 0, 0.06)',
  },
  typography: {
    fontFamily: MONO_FONT,
  },
  components: {
    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: '4px 8px',
          borderBottomColor: 'rgba(0, 255, 0, 0.06)',
          fontSize: '0.8rem',
        },
        head: {
          backgroundColor: '#0d0d0d',
          color: 'rgba(0, 255, 0, 0.4)',
          textTransform: 'uppercase',
          fontSize: '0.7rem',
          fontWeight: 700,
          letterSpacing: '0.05em',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&.MuiTableRow-hover:hover': {
            backgroundColor: 'rgba(0, 255, 0, 0.04)',
          },
        },
      },
    },
  },
});
