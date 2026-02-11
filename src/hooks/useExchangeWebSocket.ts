import { useCallback, useRef } from 'react';
import type { ExchangeAdapter } from '../exchanges/types';
import type { CrossRateConfig } from '../exchanges/pair';
import { parseUpbitJson } from '../exchanges/adapters/upbit';
import { updatePrice, updateCrossRate, recalcBtcDerivedCrossRate } from '../store/marketData';
import { useWebSocketHandler } from './useWebSocketHandler';

/**
 * Generic WebSocket hook driven by an ExchangeAdapter.
 * Connects to the exchange, parses messages via the adapter, and routes
 * price updates to marketData.ts.
 */
export function useExchangeWebSocket(
  adapter: ExchangeAdapter,
  quoteCurrency: string,
  tickers: string[],
  crossRateConfig: CrossRateConfig,
) {
  const marketKey = `${adapter.id}:${quoteCurrency}`;
  const crossRateConfigRef = useRef(crossRateConfig);
  crossRateConfigRef.current = crossRateConfig;

  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;

  const processMessage = useCallback((data: unknown) => {
    const currentAdapter = adapterRef.current;
    const config = crossRateConfigRef.current;

    // Upbit sends Blob — needs async handling
    if (currentAdapter.id === 'upbit') {
      if (data instanceof Object && 'data' in data) {
        const event = data as { data: unknown };
        if (event.data instanceof Blob) {
          event.data.text().then((text) => {
            try {
              const parsed = JSON.parse(text) as Record<string, unknown>;
              const tick = parseUpbitJson(parsed);
              if (!tick) return;

              // Check if this is the cross-rate ticker
              const rawCode = parsed.cd as string | undefined;
              if (config.type === 'ticker' && rawCode === config.code) {
                updateCrossRate(tick.price);
                return;
              }

              updatePrice(marketKey, tick.ticker, tick.price);

              // BTC-derived cross-rate: recalc after BTC update
              if (config.type === 'btc-derived' && tick.ticker === 'BTC') {
                recalcBtcDerivedCrossRate();
              }
            } catch {
              // Silently drop unparseable messages
            }
          });
          return;
        }
      }
      return;
    }

    // All other adapters (Binance, etc.) — synchronous parsing
    const tick = currentAdapter.parseMessage(data);
    if (!tick) return;

    updatePrice(marketKey, tick.ticker, tick.price);

    if (config.type === 'btc-derived' && tick.ticker === 'BTC') {
      recalcBtcDerivedCrossRate();
    }
  }, [marketKey]);

  const subscribe = useCallback((sendMessage: (msg: string) => void) => {
    const msg = adapterRef.current.getSubscribeMessage?.(quoteCurrency, tickers);
    if (msg) sendMessage(msg);
  }, [quoteCurrency, tickers]);

  const url = adapter.getWebSocketUrl(quoteCurrency, tickers);
  const hasSubscribe = !!adapter.getSubscribeMessage;

  useWebSocketHandler(url, processMessage, hasSubscribe ? subscribe : undefined);
}
