// Main component
export { PremiumTable } from './components/PremiumTable';
export type { PremiumTableProps } from './components/PremiumTable';

// Types (for WTS integration)
export type { MarketRow, WalletStatus } from './types/market';
export type { ExchangeAdapter, NormalizedTick } from './exchanges/types';

// Exchange adapters (for future custom exchanges)
export { upbitAdapter } from './exchanges/adapters/upbit';
export { binanceAdapter } from './exchanges/adapters/binance';
export { bybitAdapter } from './exchanges/adapters/bybit';
export { bithumbAdapter } from './exchanges/adapters/bithumb';
export { okxAdapter } from './exchanges/adapters/okx';
export { coinbaseAdapter } from './exchanges/adapters/coinbase';

// Ticker normalization (for custom adapters)
export { createTickerNormalizer } from './exchanges/tickerNormalizer';
export type { TickerNormalizer } from './exchanges/tickerNormalizer';

// Utilities (for host app integration)
export { setUpdatesPaused } from './store/marketData';
