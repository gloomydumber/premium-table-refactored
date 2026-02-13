import type { ExchangeAdapter, NormalizedTick } from '../types';
import { createTickerNormalizer } from '../tickerNormalizer';

/** Tickers delisted from OKX — placeholder for future use */
const DELISTED_TICKERS = new Set<string>();

const normalizer = createTickerNormalizer('okx');

/** Module-level cache for REST-fetched tickers, keyed by quote currency */
const tickerCache = new Map<string, string[]>();

/** Module-level cache for REST-fetched prices, keyed by quote currency → (base → price) */
const restPriceCache = new Map<string, Map<string, number>>();

export const okxAdapter: ExchangeAdapter = {
  id: 'okx',
  name: 'OKX',
  availableQuoteCurrencies: ['USDT', 'USDC'],

  heartbeatConfig: {
    message: 'ping',
    interval: 25000,
  },

  getWebSocketUrl(): string {
    return 'wss://ws.okx.com:8443/ws/v5/public';
  },

  getSubscribeMessage(quoteCurrency: string, tickers: string[]): string[] {
    const allArgs = tickers.map(t => ({
      channel: 'tickers',
      instId: `${normalizer.toExchange(t)}-${quoteCurrency}`,
    }));
    // OKX: conservative 25 args per subscribe message
    const messages: string[] = [];
    for (let i = 0; i < allArgs.length; i += 25) {
      messages.push(JSON.stringify({ op: 'subscribe', args: allArgs.slice(i, i + 25) }));
    }
    return messages;
  },

  parseMessage(data: unknown): NormalizedTick | null {
    if (!(data instanceof MessageEvent) || typeof data.data !== 'string') return null;

    try {
      const parsed = JSON.parse(data.data) as Record<string, unknown>;

      // Only process ticker channel data messages; ignore pong / subscription ack
      const arg = parsed.arg as { channel?: string; instId?: string } | undefined;
      const dataArr = parsed.data as { instId?: string; last?: string }[] | undefined;
      if (!arg?.channel || arg.channel !== 'tickers' || !dataArr?.[0]) return null;

      const item = dataArr[0];
      if (!item.instId || !item.last) return null;

      const price = Number(item.last);
      if (isNaN(price)) return null;

      // instId format: "BTC-USDT" — split on hyphen
      const parts = item.instId.split('-');
      if (parts.length < 2) return null;

      const quoteCurrency = parts[1];
      const ticker = normalizer.toCanonical(parts[0]);

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
      const res = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SPOT');
      if (!res.ok) throw new Error(`OKX REST ${res.status}`);
      const json = (await res.json()) as {
        data: { instId: string; last: string }[];
      };
      const tickers: string[] = [];
      const prices = new Map<string, number>();
      for (const item of json.data) {
        // instId format: "BTC-USDT" — filter by quote currency
        if (!item.instId.endsWith(`-${quoteCurrency}`)) continue;
        const p = Number(item.last);
        if (!p || isNaN(p)) continue;
        const base = item.instId.split('-')[0];
        if (DELISTED_TICKERS.has(base)) continue;
        const canonical = normalizer.toCanonical(base);
        tickers.push(canonical);
        prices.set(canonical, p);
      }
      tickerCache.set(quoteCurrency, tickers);
      restPriceCache.set(quoteCurrency, prices);
      return tickers;
    } catch (e) {
      console.warn('OKX REST fetch failed:', e);
      return [];
    }
  },

  getCachedPrices(quoteCurrency: string): Map<string, number> {
    return restPriceCache.get(quoteCurrency) ?? new Map();
  },

  normalizeSymbol(rawSymbol: string): string {
    // "BTC-USDT" → "BTC"
    return rawSymbol.split('-')[0];
  },
};
