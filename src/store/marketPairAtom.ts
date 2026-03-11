import { atom } from 'jotai';
import type { MarketPair } from '../exchanges/pair';
import { resolveCommonTickers, fetchCommonTickers, parseRawCommonTickers } from '../exchanges/pair';
import { upbitAdapter, binanceAdapter } from '../exchanges/adapters';

function buildDefaultMarketPair(): MarketPair {
  const quoteCurrencyA = 'KRW';
  const quoteCurrencyB = 'USDT';
  const commonTickers = resolveCommonTickers(
    upbitAdapter.getAvailableTickers(quoteCurrencyA),
    binanceAdapter.getAvailableTickers(quoteCurrencyB),
  );

  return {
    marketA: { exchangeId: 'upbit', quoteCurrency: quoteCurrencyA },
    marketB: { exchangeId: 'binance', quoteCurrency: quoteCurrencyB },
    adapterA: upbitAdapter,
    adapterB: binanceAdapter,
    commonTickers,
    crossRateSource: { type: 'ticker', exchangeId: 'upbit', code: 'KRW-USDT' },
  };
}

/** Active market pair config — drives WS connections and table rendering */
export const marketPairAtom = atom<MarketPair>(buildDefaultMarketPair());

/**
 * Fetch full ticker lists from REST APIs and update the market pair atom.
 * Call once on app startup — the table shows skeleton rows until this resolves,
 * then re-renders with real data once WS prices arrive.
 */
export async function initMarketPairAsync(set: (pair: MarketPair) => void): Promise<void> {
  const defaultPair = buildDefaultMarketPair();
  const dynamicTickers = await fetchCommonTickers(
    defaultPair.adapterA,
    defaultPair.marketA.quoteCurrency,
    defaultPair.adapterB,
    defaultPair.marketB.quoteCurrency,
  );

  if (dynamicTickers.length > 0) {
    set({ ...defaultPair, commonTickers: dynamicTickers });
  }
}

/**
 * Initialize market pair from pre-fetched raw REST responses.
 * Each adapter's parseRawTickerData handles normalization and filtering.
 * Used when the host app provides `availableMarkets.rawResponses`.
 */
export function initMarketPairWithRawData(
  set: (pair: MarketPair) => void,
  rawResponses: Record<string, unknown>,
): void {
  const defaultPair = buildDefaultMarketPair();
  const rawA = rawResponses[defaultPair.marketA.exchangeId];
  const rawB = rawResponses[defaultPair.marketB.exchangeId];
  if (!rawA || !rawB) return;

  const tickers = parseRawCommonTickers(
    defaultPair.adapterA,
    defaultPair.marketA.quoteCurrency,
    rawA,
    defaultPair.adapterB,
    defaultPair.marketB.quoteCurrency,
    rawB,
  );

  if (tickers.length > 0) {
    set({ ...defaultPair, commonTickers: tickers });
  }
}
