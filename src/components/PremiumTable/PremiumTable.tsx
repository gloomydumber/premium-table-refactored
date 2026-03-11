import { useCallback, useRef, useState } from 'react';
import { Provider } from 'jotai';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import type { Theme } from '@mui/material';
import { WebSocketProvider } from '../WebSocketProvider';
import { ArbitrageTable } from '../ArbitrageTable';
import { defaultTheme } from './theme';

export interface AvailableMarkets {
  tickers: string[];
  prices?: Map<string, number>;
}

export interface PremiumTableProps {
  height?: string | number;
  theme?: Theme;
  availableMarkets?: AvailableMarkets;
}

/** Measure pixel height via callback ref + ResizeObserver. */
function useContainerHeight() {
  const [height, setHeight] = useState(0);
  const roRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: HTMLDivElement | null) => {
    if (roRef.current) {
      roRef.current.disconnect();
      roRef.current = null;
    }
    if (node) {
      setHeight(node.clientHeight);
      const ro = new ResizeObserver(([entry]) => {
        setHeight(Math.round(entry.contentRect.height));
      });
      ro.observe(node);
      roRef.current = ro;
    } else {
      setHeight(0);
    }
  }, []);

  return { ref, height };
}

export function PremiumTable({ height = '100vh', theme, availableMarkets }: PremiumTableProps) {
  const { ref: containerRef, height: containerHeight } = useContainerHeight();

  return (
    <Provider>
      <ThemeProvider theme={theme ?? defaultTheme}>
        <CssBaseline />
        <WebSocketProvider availableMarkets={availableMarkets} />
        <Box ref={containerRef} sx={{ width: '100%', height }}>
          {containerHeight > 0 && <ArbitrageTable height={containerHeight} />}
        </Box>
      </ThemeProvider>
    </Provider>
  );
}
