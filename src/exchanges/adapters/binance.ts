import type { ExchangeAdapter, NormalizedTick } from '../types';
import { createTickerNormalizer } from '../tickerNormalizer';

/** Tickers delisted from Binance but still returned by /ticker/price with stale prices */
const DELISTED_TICKERS = new Set(['WAVES', 'AERGO', 'ELF', 'SNT']);

const normalizer = createTickerNormalizer('binance');

/** Module-level cache for REST-fetched tickers, keyed by quote currency */
const tickerCache = new Map<string, string[]>();

/** Module-level cache for REST-fetched prices, keyed by quote currency → (base → price) */
const restPriceCache = new Map<string, Map<string, number>>();

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
    const params = tickers.map(t => {
      const exchangeTicker = normalizer.toExchange(t);
      return `${exchangeTicker.toLowerCase()}${suffix}@miniTicker`;
    });
    return JSON.stringify({ method: 'SUBSCRIBE', params, id: 1 });
  },

  parseMessage(data: unknown): NormalizedTick | null {
    if (!(data instanceof MessageEvent) || typeof data.data !== 'string') return null;

    try {
      const parsed = JSON.parse(data.data) as Record<string, unknown>;

      // Handle combined-stream format (has .data wrapper) and direct format
      const payload = (parsed.data ?? parsed) as { e?: string; s?: string; c?: string };

      // Only process miniTicker events; ignore subscription ack ({ result: null })
      if (!payload.s || !payload.c) return null;

      const symbol = payload.s as string;
      const price = Number(payload.c);
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

      ticker = normalizer.toCanonical(ticker);

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
      const res = await fetch('https://api.binance.com/api/v3/ticker/price');
      if (!res.ok) throw new Error(`Binance REST ${res.status}`);
      const data = (await res.json()) as { symbol: string; price: string }[];
      const tickers: string[] = [];
      const prices = new Map<string, number>();
      for (const item of data) {
        if (!item.symbol.endsWith(quoteCurrency)) continue;
        const p = Number(item.price);
        // Skip delisted/halted pairs (price 0) and invalid prices
        if (!p || isNaN(p)) continue;
        const base = item.symbol.slice(0, -quoteCurrency.length);
        if (DELISTED_TICKERS.has(base)) continue;
        const canonical = normalizer.toCanonical(base);
        tickers.push(canonical);
        prices.set(canonical, p);
      }
      tickerCache.set(quoteCurrency, tickers);
      restPriceCache.set(quoteCurrency, prices);
      return tickers;
    } catch (e) {
      console.warn('Binance REST fetch failed:', e);
      return [];
    }
  },

  getCachedPrices(quoteCurrency: string): Map<string, number> {
    return restPriceCache.get(quoteCurrency) ?? new Map();
  },

  normalizeSymbol(rawSymbol: string, quoteCurrency: string): string {
    // "BTCUSDT" → "BTC"
    return rawSymbol.replace(quoteCurrency, '');
  },
};
