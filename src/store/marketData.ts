import type { SetStateAction } from 'jotai';
import type { MarketRow, WalletStatus } from '../types/market';
import type { RowMap } from './marketAtoms';

// ---------------------------------------------------------------------------
// Module-level price storage (O(1) writes, no React overhead)
// ---------------------------------------------------------------------------

/** Key: "exchangeId:quoteCurrency" (e.g., "upbit:KRW", "binance:USDT") */
type MarketKey = string;

const pricesByMarket = new Map<MarketKey, Map<string, number>>();

/** Active market keys — set by initMarketData when market pair changes */
let marketKeyA = '';
let marketKeyB = '';

// ---------------------------------------------------------------------------
// Ticker ID tracking (stable insertion order)
// ---------------------------------------------------------------------------

let nextId = 1;
const idByTicker = new Map<string, number>();

function getIdForTicker(ticker: string): number {
  const existing = idByTicker.get(ticker);
  if (existing !== undefined) return existing;
  const id = nextId++;
  idByTicker.set(ticker, id);
  return id;
}

// ---------------------------------------------------------------------------
// Wallet status placeholder
// ---------------------------------------------------------------------------

const walletStatusByTicker = new Map<string, WalletStatus[]>();

// PLACEHOLDER: random wallet status until server API is available
function getWalletStatusForTicker(ticker: string): WalletStatus[] {
  const existing = walletStatusByTicker.get(ticker);
  if (existing) return existing;

  const generated: WalletStatus[] = [
    {
      networkName: ticker,
      marketA: { deposit: Math.random() < 0.5, withdraw: Math.random() < 0.5 },
      marketB: { deposit: Math.random() < 0.5, withdraw: Math.random() < 0.5 },
    },
    {
      networkName: 'BSC',
      marketA: { deposit: Math.random() < 0.5, withdraw: Math.random() < 0.5 },
      marketB: { deposit: Math.random() < 0.5, withdraw: Math.random() < 0.5 },
    },
  ];
  walletStatusByTicker.set(ticker, generated);
  return generated;
}

// ---------------------------------------------------------------------------
// Resize pause — freezes all React state updates while grid is being resized
// ---------------------------------------------------------------------------

let paused = false;
let pendingCrossRate: number | null = null;

/**
 * Pause/resume React state flushes.
 * While paused, WS messages still write to module-level Maps (O(1), no React).
 * On resume, one catch-up flush applies all accumulated changes.
 */
export function setUpdatesPaused(value: boolean) {
  paused = value;
  if (!value) {
    // Resume: flush buffered cross-rate + pending row updates
    if (pendingCrossRate !== null) {
      if (lastSetCrossRate) lastSetCrossRate(pendingCrossRate);
      pendingCrossRate = null;
    }
    if (pendingTickers.size > 0) {
      scheduleFlush();
    }
  }
}

// ---------------------------------------------------------------------------
// RAF batch flush
// ---------------------------------------------------------------------------

const pendingTickers = new Set<string>();
let flushScheduled = false;
let lastSetRowMap: ((update: SetStateAction<RowMap>) => void) | null = null;
let lastSetTickers: ((update: SetStateAction<string[]>) => void) | null = null;

function upsertRow(ticker: string, prev: RowMap): RowMap {
  const existing = prev[ticker];
  const priceA = pricesByMarket.get(marketKeyA)?.get(ticker) ?? existing?.priceA ?? 0;
  const priceB = pricesByMarket.get(marketKeyB)?.get(ticker) ?? existing?.priceB ?? 0;

  // Skip if prices unchanged — preserves object reference so selectAtom won't emit
  if (existing && existing.priceA === priceA && existing.priceB === priceB) {
    return prev;
  }

  const nextRow: MarketRow = {
    id: existing?.id ?? getIdForTicker(ticker),
    ticker,
    priceA,
    priceB,
    walletStatus: existing?.walletStatus ?? getWalletStatusForTicker(ticker),
    isPinned: existing?.isPinned ?? false,
    isMuted: existing?.isMuted ?? false,
  };
  return { ...prev, [ticker]: nextRow };
}

function flush() {
  flushScheduled = false;
  if (pendingTickers.size === 0) return;

  const tickers = Array.from(pendingTickers);
  pendingTickers.clear();

  // Update tickers list (add any new ones)
  if (lastSetTickers) {
    lastSetTickers((prev) => {
      const existing = new Set(prev);
      const newTickers = tickers.filter(t => !existing.has(t));
      return newTickers.length > 0 ? [...prev, ...newTickers] : prev;
    });
  }

  // Update row map
  if (lastSetRowMap) {
    lastSetRowMap((prev) => {
      let next = prev;
      for (const ticker of tickers) {
        next = upsertRow(ticker, next);
      }
      return next;
    });
  }
}

function scheduleFlush() {
  if (flushScheduled || paused) return;
  flushScheduled = true;
  requestAnimationFrame(flush);
}

// ---------------------------------------------------------------------------
// Cross-rate — decoupled from row data path
// ---------------------------------------------------------------------------

let lastSetCrossRate: ((rate: number) => void) | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize market data for a new market pair.
 * Call when the user switches exchange/stablecoin tabs.
 */
export function initMarketData(
  keyA: string,
  keyB: string,
  setRowMap: (update: SetStateAction<RowMap>) => void,
  setTickers: (update: SetStateAction<string[]>) => void,
  setCrossRate: (rate: number) => void,
) {
  marketKeyA = keyA;
  marketKeyB = keyB;
  lastSetRowMap = setRowMap;
  lastSetTickers = setTickers;
  lastSetCrossRate = setCrossRate;

  // Ensure market maps exist
  if (!pricesByMarket.has(keyA)) pricesByMarket.set(keyA, new Map());
  if (!pricesByMarket.has(keyB)) pricesByMarket.set(keyB, new Map());
}

/**
 * Clear all price data. Call when switching market pairs.
 */
export function clearMarketData(
  setRowMap: (update: SetStateAction<RowMap>) => void,
  setTickers: (update: SetStateAction<string[]>) => void,
  setCrossRate: (rate: number) => void,
) {
  pricesByMarket.clear();
  pendingTickers.clear();
  flushScheduled = false;
  setRowMap({});
  setTickers([]);
  setCrossRate(0);
}

/**
 * Update a price for a specific market. Called by the WS hook.
 */
export function updatePrice(
  marketKey: string,
  ticker: string,
  price: number,
) {
  let map = pricesByMarket.get(marketKey);
  if (!map) {
    map = new Map();
    pricesByMarket.set(marketKey, map);
  }
  map.set(ticker, price);
  pendingTickers.add(ticker);
  scheduleFlush();
}

/**
 * Update the cross-rate between the two quote currencies.
 * Sets the crossRateAtom directly — does NOT touch pendingTickers.
 * Premium is computed at the render layer from crossRateAtom + row prices.
 */
export function updateCrossRate(rate: number) {
  if (paused) {
    pendingCrossRate = rate;
    return;
  }
  if (lastSetCrossRate) {
    lastSetCrossRate(rate);
  }
}

/**
 * For 'btc-derived' cross-rate mode.
 * Called after any BTC price update on either market.
 */
export function recalcBtcDerivedCrossRate() {
  const btcA = pricesByMarket.get(marketKeyA)?.get('BTC') ?? 0;
  const btcB = pricesByMarket.get(marketKeyB)?.get('BTC') ?? 0;
  if (btcA > 0 && btcB > 0) {
    updateCrossRate(btcA / btcB);
  }
}
