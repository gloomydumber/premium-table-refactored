import type { ExchangeAdapter, MarketId } from './types';

export type CrossRateConfig =
  | { type: 'fixed'; rate: 1 }
  | { type: 'ticker'; exchangeId: string; code: string }
  | { type: 'btc-derived' };

/** Two specific markets being compared */
export interface MarketPair {
  marketA: MarketId;
  marketB: MarketId;
  adapterA: ExchangeAdapter;
  adapterB: ExchangeAdapter;
  commonTickers: string[];
  crossRateSource: CrossRateConfig;
}

/**
 * Compute the intersection of base tickers available on both markets.
 */
export function resolveCommonTickers(
  tickersA: string[],
  tickersB: string[],
): string[] {
  const setB = new Set(tickersB);
  return tickersA.filter(t => setB.has(t));
}

/**
 * Async version: fetches full ticker lists from both exchange REST APIs,
 * then intersects. Falls back to sync getAvailableTickers if fetch is unsupported.
 */
export async function fetchCommonTickers(
  adapterA: ExchangeAdapter,
  quoteCurrencyA: string,
  adapterB: ExchangeAdapter,
  quoteCurrencyB: string,
): Promise<string[]> {
  const [tickersA, tickersB] = await Promise.all([
    adapterA.fetchAvailableTickers
      ? adapterA.fetchAvailableTickers(quoteCurrencyA)
      : Promise.resolve(adapterA.getAvailableTickers(quoteCurrencyA)),
    adapterB.fetchAvailableTickers
      ? adapterB.fetchAvailableTickers(quoteCurrencyB)
      : Promise.resolve(adapterB.getAvailableTickers(quoteCurrencyB)),
  ]);
  return resolveCommonTickers(tickersA, tickersB);
}
