import type { ExchangeAdapter, NormalizedTick } from '../types';

/** Module-level cache for REST-fetched tickers, keyed by quote currency */
const tickerCache = new Map<string, string[]>();

export const binanceAdapter: ExchangeAdapter = {
  id: 'binance',
  name: 'Binance',
  availableQuoteCurrencies: ['USDT', 'USDC'],

  getWebSocketUrl(): string {
    // Use base URL — subscriptions sent via getSubscribeMessage
    return 'wss://stream.binance.com:9443/ws';
  },

  getSubscribeMessage(quoteCurrency: string, tickers: string[]): string {
    const suffix = quoteCurrency.toLowerCase();
    const params = tickers.map(t => `${t.toLowerCase()}${suffix}@trade`);
    return JSON.stringify({ method: 'SUBSCRIBE', params, id: 1 });
  },

  parseMessage(data: unknown): NormalizedTick | null {
    if (!(data instanceof MessageEvent) || typeof data.data !== 'string') return null;

    try {
      const parsed = JSON.parse(data.data) as Record<string, unknown>;

      // Handle combined-stream format (has .data wrapper) and direct format
      const payload = (parsed.data ?? parsed) as { e?: string; s?: string; p?: string };

      // Only process trade events; ignore subscription ack ({ result: null })
      if (!payload.s || !payload.p) return null;

      const symbol = payload.s as string;
      const price = Number(payload.p);
      if (isNaN(price)) return null;

      // Detect quote currency from symbol suffix
      let quoteCurrency = '';
      let ticker = '';
      if (symbol.endsWith('USDT')) {
        quoteCurrency = 'USDT';
        ticker = symbol.slice(0, -4);
      } else if (symbol.endsWith('USDC')) {
        quoteCurrency = 'USDC';
        ticker = symbol.slice(0, -4);
      } else {
        return null;
      }

      return { ticker, price, quoteCurrency };
    } catch {
      return null;
    }
  },

  getAvailableTickers(quoteCurrency: string): string[] {
    return tickerCache.get(quoteCurrency) ?? [];
  },

  async fetchAvailableTickers(quoteCurrency: string): Promise<string[]> {
    const cached = tickerCache.get(quoteCurrency);
    if (cached) return cached;

    try {
      const res = await fetch('https://api.binance.com/api/v3/exchangeInfo');
      if (!res.ok) throw new Error(`Binance REST ${res.status}`);
      const data = (await res.json()) as {
        symbols: { baseAsset: string; quoteAsset: string; status: string }[];
      };
      const tickers = data.symbols
        .filter(s => s.quoteAsset === quoteCurrency && s.status === 'TRADING')
        .map(s => s.baseAsset);
      tickerCache.set(quoteCurrency, tickers);
      return tickers;
    } catch (e) {
      console.warn('Binance REST fetch failed:', e);
      return [];
    }
  },

  normalizeSymbol(rawSymbol: string, quoteCurrency: string): string {
    // "BTCUSDT" → "BTC"
    return rawSymbol.replace(quoteCurrency, '');
  },
};
