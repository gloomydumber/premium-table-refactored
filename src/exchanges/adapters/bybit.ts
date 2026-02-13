import type { ExchangeAdapter, NormalizedTick } from '../types';
import { createTickerNormalizer } from '../tickerNormalizer';

/** Tickers delisted from Bybit — placeholder for future use */
const DELISTED_TICKERS = new Set<string>();

const normalizer = createTickerNormalizer('bybit');

/** Module-level cache for REST-fetched tickers, keyed by quote currency */
const tickerCache = new Map<string, string[]>();

/** Module-level cache for REST-fetched prices, keyed by quote currency → (base → price) */
const restPriceCache = new Map<string, Map<string, number>>();

export const bybitAdapter: ExchangeAdapter = {
  id: 'bybit',
  name: 'Bybit',
  availableQuoteCurrencies: ['USDT', 'USDC'],

  heartbeatConfig: {
    message: '{"op":"ping"}',
    interval: 20000,
  },

  getWebSocketUrl(): string {
    return 'wss://stream.bybit.com/v5/public/spot';
  },

  getSubscribeMessage(quoteCurrency: string, tickers: string[]): string[] {
    const suffix = quoteCurrency;
    const allArgs = tickers.map(t => `tickers.${normalizer.toExchange(t)}${suffix}`);
    // Bybit Spot: max 10 args per subscribe request
    const messages: string[] = [];
    for (let i = 0; i < allArgs.length; i += 10) {
      messages.push(JSON.stringify({ op: 'subscribe', args: allArgs.slice(i, i + 10) }));
    }
    return messages;
  },

  parseMessage(data: unknown): NormalizedTick | null {
    if (!(data instanceof MessageEvent) || typeof data.data !== 'string') return null;

    try {
      const parsed = JSON.parse(data.data) as Record<string, unknown>;

      // Only process ticker topic messages; ignore pong / subscription ack
      const topic = parsed.topic as string | undefined;
      if (!topic || !topic.startsWith('tickers.')) return null;

      const payload = parsed.data as { symbol?: string; lastPrice?: string } | undefined;
      if (!payload?.symbol || !payload?.lastPrice) return null;

      const symbol = payload.symbol;
      const price = Number(payload.lastPrice);
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
      const res = await fetch('https://api.bybit.com/v5/market/tickers?category=spot');
      if (!res.ok) throw new Error(`Bybit REST ${res.status}`);
      const json = (await res.json()) as {
        result: { list: { symbol: string; lastPrice: string }[] };
      };
      const tickers: string[] = [];
      const prices = new Map<string, number>();
      for (const item of json.result.list) {
        if (!item.symbol.endsWith(quoteCurrency)) continue;
        const p = Number(item.lastPrice);
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
      console.warn('Bybit REST fetch failed:', e);
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
