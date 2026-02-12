import type { ExchangeAdapter, NormalizedTick } from '../types';

/** Module-level cache for REST-fetched tickers */
let cachedKrwTickers: string[] | null = null;

export const upbitAdapter: ExchangeAdapter = {
  id: 'upbit',
  name: 'Upbit',
  availableQuoteCurrencies: ['KRW'],

  getWebSocketUrl() {
    return 'wss://api.upbit.com/websocket/v1';
  },

  getSubscribeMessage(quoteCurrency: string, tickers: string[], crossRateTicker?: string): string {
    const codes = tickers.map(t => `${quoteCurrency}-${t}`);
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
    // Upbit sends Blob wrapped in MessageEvent
    if (!(data instanceof Object) || !('data' in data)) return null;
    const event = data as { data: unknown };
    if (!(event.data instanceof Blob)) return null;

    // Return a promise-wrapped result won't work here.
    // The caller must handle Blob async parsing separately.
    // This method handles the already-parsed JSON object.
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
      const res = await fetch('https://api.upbit.com/v1/market/all');
      if (!res.ok) throw new Error(`Upbit REST ${res.status}`);
      const data = (await res.json()) as { market: string }[];
      const tickers = data
        .filter(m => m.market.startsWith('KRW-'))
        .map(m => m.market.split('-')[1]!);
      cachedKrwTickers = tickers;
      return tickers;
    } catch (e) {
      console.warn('Upbit REST fetch failed:', e);
      return [];
    }
  },

  normalizeSymbol(rawSymbol: string): string {
    // "KRW-BTC" → "BTC"
    return rawSymbol.split('-')[1] ?? rawSymbol;
  },
};

/**
 * Parse a decoded Upbit message (post Blob→JSON).
 * Separate from parseMessage because Blob decoding is async.
 */
export function parseUpbitJson(parsed: Record<string, unknown>): NormalizedTick | null {
  const code = parsed.cd as string | undefined;
  const price = parsed.tp as number | undefined;
  if (!code || typeof price !== 'number') return null;

  const parts = code.split('-');
  const quoteCurrency = parts[0] ?? '';
  const ticker = parts[1] ?? '';
  if (!ticker) return null;

  return { ticker, price, quoteCurrency };
}
