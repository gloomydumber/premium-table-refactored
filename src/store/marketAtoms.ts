import { atom } from 'jotai';
import { selectAtom } from 'jotai/utils';
import type { Atom } from 'jotai';
import type { MarketRow } from '../types/market';

export type RowMap = Record<string, MarketRow>;

/** Full row map — written by marketData.ts RAF flush */
export const rowMapAtom = atom<RowMap>({});

/** Known tickers list — written by marketData.ts RAF flush */
export const tickersAtom = atom<string[]>([]);

/**
 * Cross-rate: units of quoteCurrencyA per 1 unit of quoteCurrencyB.
 * Updated directly from WS handler — NOT part of the RAF batch cycle.
 * Decoupled from rowMapAtom so cross-rate changes don't create new MarketRow objects.
 */
export const crossRateAtom = atom<number>(0);

/** Per-row atom cache: only re-renders when this specific row changes */
const rowAtomCache = new Map<string, Atom<MarketRow | undefined>>();

export function rowAtomFamily(ticker: string): Atom<MarketRow | undefined> {
  let cached = rowAtomCache.get(ticker);
  if (!cached) {
    cached = selectAtom(rowMapAtom, (rows) => rows[ticker]);
    rowAtomCache.set(ticker, cached);
  }
  return cached;
}

/** Set of pinned tickers */
export const pinnedAtom = atom<Set<string>>(new Set<string>());

/** Set of expanded (open detail) tickers — only pinned rows can expand */
export const openRowsAtom = atom<Set<string>>(new Set<string>());

/** Set of muted tickers — sorted to bottom, dimmed in UI */
export const mutedAtom = atom<Set<string>>(new Set<string>());

/** When true, sortedTickersAtom returns a frozen snapshot (no re-sorting) */
export const sortFrozenAtom = atom(false);

/** WebSocket readyState for exchange A (0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED) */
export const wsReadyStateAAtom = atom<number>(3);

/** WebSocket readyState for exchange B */
export const wsReadyStateBAtom = atom<number>(3);

/** Compute premium from prices and cross-rate */
export function calcPremium(priceA: number, priceB: number, crossRate: number): number {
  if (priceA <= 0 || priceB <= 0 || crossRate <= 0) return 0;
  return priceA / (priceB * crossRate) - 1;
}

/**
 * Internal: compute sorted ticker list.
 * Re-derives when rowMap, crossRate, pinned, openRows, or tickers change.
 */
const _rawSortedAtom = atom<string[]>((get) => {
  const rowMap = get(rowMapAtom);
  const crossRate = get(crossRateAtom);
  const pinned = get(pinnedAtom);
  const openRows = get(openRowsAtom);
  const muted = get(mutedAtom);
  const tickers = get(tickersAtom);

  return [...tickers].sort((a, b) => {
    const rowA = rowMap[a];
    const rowB = rowMap[b];
    if (!rowA || !rowB) return 0;

    const pinnedA = pinned.has(a);
    const pinnedB = pinned.has(b);
    const openA = openRows.has(a) && pinnedA;
    const openB = openRows.has(b) && pinnedB;

    // Expanded pinned first
    if (openA !== openB) return openA ? -1 : 1;
    // Then pinned
    if (pinnedA !== pinnedB) return pinnedA ? -1 : 1;
    // Muted rows sink to bottom
    const mutedA = muted.has(a);
    const mutedB = muted.has(b);
    if (mutedA !== mutedB) return mutedA ? 1 : -1;
    // Then by |premium| descending
    const premA = calcPremium(rowA.priceA, rowA.priceB, crossRate);
    const premB = calcPremium(rowB.priceA, rowB.priceB, crossRate);
    const premDiff = Math.abs(premB) - Math.abs(premA);
    if (premDiff !== 0) return premDiff;
    // Stable tiebreaker: insertion id ascending
    return rowA.id - rowB.id;
  });
});

/**
 * Freeze-aware wrapper: when sortFrozenAtom is true (mouse over tbody),
 * returns the last snapshot so rows don't reorder while the user is hovering.
 * Prices still update live — only the order is frozen.
 */
let _frozenSnapshot: string[] = [];

const _freezeAwareSortedAtom = atom<string[]>((get) => {
  const frozen = get(sortFrozenAtom);
  const raw = get(_rawSortedAtom);

  if (!frozen) {
    _frozenSnapshot = raw;
    return raw;
  }
  return _frozenSnapshot;
});

/**
 * Derived read-only atom: sorted ticker list.
 * ArbitrageTable reads ONLY this — never rowMapAtom directly.
 *
 * Uses selectAtom with array equality to maintain referential stability:
 * if cross-rate changes but sort order is identical, no re-render.
 */
export const sortedTickersAtom = selectAtom(
  _freezeAwareSortedAtom,
  (v) => v,
  (a, b) => a.length === b.length && a.every((v, i) => v === b[i]),
);
