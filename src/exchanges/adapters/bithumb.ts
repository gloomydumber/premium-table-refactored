import type { ExchangeAdapter, NormalizedTick } from '../types';
import { createTickerNormalizer } from '../tickerNormalizer';

const normalizer = createTickerNormalizer('bithumb');

/** Module-level cache for REST-fetched tickers */
let cachedKrwTickers: string[] | null = null;

export const bithumbAdapter: ExchangeAdapter = {
  id: 'bithumb',
  name: 'Bithumb',
  availableQuoteCurrencies: ['KRW'],

  getWebSocketUrl() {
    return 'wss://ws-api.bithumb.com/websocket/v1';
  },

  getSubscribeMessage(quoteCurrency: string, tickers: string[], crossRateTicker?: string): string {
    const codes = tickers.map(t => `${quoteCurrency}-${normalizer.toExchange(t)}`);
    if (crossRateTicker && !codes.includes(crossRateTicker)) {
      codes.push(crossRateTicker);
    }
    return JSON.stringify([
      { ticket: 'premium-table' },
      { type: 'ticker', codes },
      { format: 'SIMPLE' },
    ]);
  },

  parseMessage(data: unknown): NormalizedTick | null {
    // Bithumb sends Blob wrapped in MessageEvent — same as Upbit
    if (!(data instanceof Object) || !('data' in data)) return null;
    // Blob async parsing is handled in useExchangeWebSocket
    return null;
  },

  getAvailableTickers(quoteCurrency: string): string[] {
    if (quoteCurrency === 'KRW') return cachedKrwTickers ?? [];
    return [];
  },

  async fetchAvailableTickers(quoteCurrency: string): Promise<string[]> {
    if (quoteCurrency !== 'KRW') return [];
    if (cachedKrwTickers) return cachedKrwTickers;

    try {
      const res = await fetch('https://api.bithumb.com/v1/market/all');
      if (!res.ok) throw new Error(`Bithumb REST ${res.status}`);
      const data = (await res.json()) as { market: string }[];
      const tickers = data
        .filter(m => m.market.startsWith('KRW-'))
        .map(m => normalizer.toCanonical(m.market.split('-')[1]!));
      cachedKrwTickers = tickers;
      return tickers;
    } catch (e) {
      console.warn('Bithumb REST fetch failed:', e);
      return [];
    }
  },

  normalizeSymbol(rawSymbol: string): string {
    // "KRW-BTC" → "BTC"
    return rawSymbol.split('-')[1] ?? rawSymbol;
  },
};
