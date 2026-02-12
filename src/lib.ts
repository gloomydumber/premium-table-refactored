// Main component
export { PremiumTable } from './components/PremiumTable';
export type { PremiumTableProps } from './components/PremiumTable';

// Types (for WTS integration)
export type { MarketRow, WalletStatus } from './types/market';
export type { ExchangeAdapter, NormalizedTick } from './exchanges/types';

// Exchange adapters (for future custom exchanges)
export { upbitAdapter } from './exchanges/adapters/upbit';
export { binanceAdapter } from './exchanges/adapters/binance';
