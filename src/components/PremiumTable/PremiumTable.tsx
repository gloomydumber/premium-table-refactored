import { Provider } from 'jotai';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import type { Theme } from '@mui/material';
import { WebSocketProvider } from '../WebSocketProvider';
import { ArbitrageTable } from '../ArbitrageTable';
import { defaultTheme } from './theme';

export interface PremiumTableProps {
  height?: string | number;
  theme?: Theme;
}

export function PremiumTable({ height = '100%', theme }: PremiumTableProps) {
  return (
    <Provider>
      <ThemeProvider theme={theme ?? defaultTheme}>
        <CssBaseline />
        <WebSocketProvider />
        <Box sx={{ width: '100%', height }}>
          <ArbitrageTable />
        </Box>
      </ThemeProvider>
    </Provider>
  );
}
