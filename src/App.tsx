import { ThemeProvider, createTheme, CssBaseline, Box } from '@mui/material';
import { WebSocketProvider } from './components/WebSocketProvider';
import { ArbitrageTable } from './components/ArbitrageTable';

const MONO_FONT = "'JetBrains Mono', 'Fira Code', Consolas, monospace";

// Static dark theme — outside component body to avoid recreation on every render
const darkTheme = createTheme({
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

function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <WebSocketProvider />
      <Box sx={{ width: '100%', height: '100vh' }}>
        <ArbitrageTable />
      </Box>
    </ThemeProvider>
  );
}

export default App;
