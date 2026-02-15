import type { ExchangeAdapter, NormalizedTick } from '../types';
import { createTickerNormalizer } from '../tickerNormalizer';

const normalizer = createTickerNormalizer('coinbase');

/** Module-level cache for REST-fetched tickers, keyed by quote currency */
const tickerCache = new Map<string, string[]>();


export const coinbaseAdapter: ExchangeAdapter = {
  id: 'coinbase',
  name: 'Coinbase',
  availableQuoteCurrencies: ['USDC'],

  getWebSocketUrl(): string {
    return 'wss://advanced-trade-ws.coinbase.com';
  },

  getSubscribeMessage(_quoteCurrency: string, tickers: string[]): string {
    const productIds = tickers.map(t => `${normalizer.toExchange(t)}-USD`);
    return JSON.stringify({
      type: 'subscribe',
      product_ids: productIds,
      channel: 'ticker_batch',
    });
  },

  parseMessage(data: unknown): NormalizedTick | null {
    if (!(data instanceof MessageEvent) || typeof data.data !== 'string') return null;

    try {
      const parsed = JSON.parse(data.data) as Record<string, unknown>;

      if (parsed.channel !== 'ticker_batch') return null;

      const events = parsed.events as { type?: string; tickers?: { product_id?: string; price?: string }[] }[] | undefined;
      if (!events?.[0]?.tickers?.[0]) return null;

      const item = events[0].tickers[0];
      if (!item.product_id || !item.price) return null;

      const price = Number(item.price);
      if (isNaN(price)) return null;

      // product_id format: "BTC-USD" — split on hyphen
      const parts = item.product_id.split('-');
      if (parts.length < 2) return null;

      const ticker = normalizer.toCanonical(parts[0]);

      // Coinbase USD/USDC unified — display as USDC
      return { ticker, price, quoteCurrency: 'USDC' };
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
      // Use Exchange API (CORS-safe) — Advanced Trade API blocks browser CORS
      const res = await fetch('https://api.exchange.coinbase.com/products');
      if (!res.ok) throw new Error(`Coinbase REST ${res.status}`);
      const json = (await res.json()) as {
        id: string; base_currency: string; quote_currency: string; status: string;
      }[];
      const tickers: string[] = [];
      for (const item of json) {
        // Coinbase USD/USDC unified — filter by USD pairs
        if (item.quote_currency !== 'USD') continue;
        if (item.status !== 'online') continue;
        const canonical = normalizer.toCanonical(item.base_currency);
        tickers.push(canonical);
      }
      tickerCache.set(quoteCurrency, tickers);
      // No REST prices from Exchange API — WS ticker_batch snapshot seeds within 5s
      return tickers;
    } catch (e) {
      console.warn('Coinbase REST fetch failed:', e);
      return [];
    }
  },


  normalizeSymbol(rawSymbol: string): string {
    // "BTC-USD" → "BTC"
    return rawSymbol.split('-')[0];
  },
};
