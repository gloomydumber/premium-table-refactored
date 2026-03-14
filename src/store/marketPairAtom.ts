import { atom } from 'jotai';
import type { MarketPair, CrossRateConfig } from '../exchanges/pair';
import { resolveCommonTickers, fetchCommonTickers, parseRawCommonTickers } from '../exchanges/pair';
import type { ExchangeAdapter } from '../exchanges/types';
import { upbitAdapter, binanceAdapter, bybitAdapter, bithumbAdapter, okxAdapter, coinbaseAdapter } from '../exchanges/adapters';

// ── Adapter registry (lookup by id) ──────────────────────────────
const ADAPTERS: ExchangeAdapter[] = [
  upbitAdapter, binanceAdapter, bybitAdapter, bithumbAdapter, okxAdapter, coinbaseAdapter,
];

function getAdapter(id: string): ExchangeAdapter | undefined {
  return ADAPTERS.find(a => a.id === id);
}

// ── localStorage key convention: wts:<widget>:<key> ──────────────
const KEYS = {
  exchangeA: 'wts:premium:exchangeA',
  exchangeB: 'wts:premium:exchangeB',
  quoteA: 'wts:premium:quoteA',
  quoteB: 'wts:premium:quoteB',
} as const;

// ── Sync localStorage read ───────────────────────────────────────
// Named "hydrate" for brevity, NOT related to SSR/React hydration.
// Reads localStorage synchronously at module init so that
// buildDefaultMarketPair() uses the persisted exchange selection
// from the very first frame — prevents flash-mount with wrong defaults.
// Cannot use atomWithStorage getOnInit here because MarketPair contains
// adapter objects (functions) that can't be serialized to JSON.
function hydrate<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored != null) return JSON.parse(stored) as T;
  } catch { /* corrupted localStorage — use default */ }
  return fallback;
}

function persist(key: string, value: string): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

// ── Build MarketPair from exchange IDs + quotes ──────────────────

export function buildCrossRateConfig(
  adapterA: ExchangeAdapter,
  quoteCurrencyA: string,
  quoteCurrencyB: string,
): CrossRateConfig {
  if (quoteCurrencyA === quoteCurrencyB) return { type: 'fixed', rate: 1 };
  if (quoteCurrencyA === 'KRW' && (quoteCurrencyB === 'USDT' || quoteCurrencyB === 'USDC')) {
    return { type: 'ticker', exchangeId: adapterA.id, code: `KRW-${quoteCurrencyB}` };
  }
  return { type: 'btc-derived' };
}

function buildMarketPair(
  adapterA: ExchangeAdapter,
  quoteCurrencyA: string,
  adapterB: ExchangeAdapter,
  quoteCurrencyB: string,
): MarketPair {
  const commonTickers = resolveCommonTickers(
    adapterA.getAvailableTickers(quoteCurrencyA),
    adapterB.getAvailableTickers(quoteCurrencyB),
  );

  return {
    marketA: { exchangeId: adapterA.id, quoteCurrency: quoteCurrencyA },
    marketB: { exchangeId: adapterB.id, quoteCurrency: quoteCurrencyB },
    adapterA,
    adapterB,
    commonTickers,
    crossRateSource: buildCrossRateConfig(adapterA, quoteCurrencyA, quoteCurrencyB),
  };
}

function buildDefaultMarketPair(): MarketPair {
  // Hydrate persisted exchange selection; fall back to Upbit–Binance
  const savedA = hydrate(KEYS.exchangeA, 'upbit');
  const savedB = hydrate(KEYS.exchangeB, 'binance');
  const adapterA = getAdapter(savedA);
  const adapterB = getAdapter(savedB);

  // Validate: both adapters must exist and differ
  if (adapterA && adapterB && adapterA.id !== adapterB.id) {
    const isKoreanA = adapterA.availableQuoteCurrencies.includes('KRW');
    const isKoreanB = adapterB.availableQuoteCurrencies.includes('KRW');
    const defaultQuoteA = isKoreanA ? 'KRW' : 'USDT';
    const defaultQuoteB = isKoreanB ? 'KRW' : 'USDT';
    const quoteA = hydrate(KEYS.quoteA, defaultQuoteA);
    const quoteB = hydrate(KEYS.quoteB, defaultQuoteB);
    return buildMarketPair(adapterA, quoteA, adapterB, quoteB);
  }

  // Fallback: Upbit–Binance (KRW–USDT)
  return buildMarketPair(upbitAdapter, 'KRW', binanceAdapter, 'USDT');
}

// ── Persist helper (called by MarketPairSelector on user action) ─
export function persistMarketPairSelection(pair: MarketPair): void {
  persist(KEYS.exchangeA, pair.adapterA.id);
  persist(KEYS.exchangeB, pair.adapterB.id);
  persist(KEYS.quoteA, pair.marketA.quoteCurrency);
  persist(KEYS.quoteB, pair.marketB.quoteCurrency);
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
 * Used when the host app provides `rawExchangeData.rawResponses`.
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
