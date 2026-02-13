/** Unique exchange identifier */
export type ExchangeId = string;

/** A specific market on an exchange: (exchange, quote currency) */
export interface MarketId {
  exchangeId: ExchangeId;
  quoteCurrency: string;
}

/** Normalized price tick — common output from any exchange adapter */
export interface NormalizedTick {
  ticker: string;
  price: number;
  quoteCurrency: string;
}

/** What an exchange adapter must provide */
export interface ExchangeAdapter {
  /** Unique identifier */
  id: ExchangeId;

  /** Display name for UI (e.g., "Upbit", "Binance") */
  name: string;

  /**
   * Quote currencies (markets) available on this exchange.
   * Korean CEXes: ['KRW']
   * Global CEXes: ['USDT', 'USDC']
   */
  availableQuoteCurrencies: string[];

  /**
   * WebSocket endpoint URL for a specific quote currency market.
   */
  getWebSocketUrl(quoteCurrency: string, tickers: string[]): string;

  /**
   * Build the subscription message to send after WS connects (if needed).
   * Upbit requires this; Binance encodes subscriptions in the URL.
   */
  getSubscribeMessage?(quoteCurrency: string, tickers: string[], crossRateTicker?: string): string | string[];

  /**
   * Parse a raw WS message into a normalized price update, or null if irrelevant.
   */
  parseMessage(data: unknown): NormalizedTick | null;

  /**
   * List all base tickers available for a specific quote currency market.
   * Synchronous — returns hardcoded fallback or cached REST results.
   */
  getAvailableTickers(quoteCurrency: string): string[];

  /**
   * Fetch full ticker list from exchange REST API.
   * Updates the internal cache so subsequent getAvailableTickers calls return the full set.
   */
  fetchAvailableTickers?(quoteCurrency: string): Promise<string[]>;

  /**
   * Return cached prices from the most recent REST fetch, if available.
   * Used to seed initial row prices before WebSocket connects.
   */
  getCachedPrices?(quoteCurrency: string): Map<string, number>;

  /**
   * Convert exchange-specific ticker symbol to a canonical base symbol.
   * e.g., Upbit "KRW-BTC" → "BTC", Binance "BTCUSDT" → "BTC"
   */
  normalizeSymbol(rawSymbol: string, quoteCurrency: string): string;

  /**
   * Optional application-level heartbeat config.
   * When set, the WebSocket handler will send periodic ping messages.
   */
  heartbeatConfig?: { message: string; interval: number };
}
