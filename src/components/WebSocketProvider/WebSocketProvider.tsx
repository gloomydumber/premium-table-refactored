import { useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { marketPairAtom, initMarketPairAsync } from '../../store/marketPairAtom';
import { rowMapAtom, tickersAtom, crossRateAtom, pinnedAtom, openRowsAtom, mutedAtom, sortFrozenAtom, wsReadyStateAAtom, wsReadyStateBAtom } from '../../store/marketAtoms';
import { useExchangeWebSocket } from '../../hooks/useExchangeWebSocket';
import { initMarketData, clearMarketData, updatePrice } from '../../store/marketData';
import { buildPrefsKey, loadPrefs } from '../../utils/prefsStorage';

export function WebSocketProvider() {
  const pair = useAtomValue(marketPairAtom);
  const setPair = useSetAtom(marketPairAtom);
  const setRowMap = useSetAtom(rowMapAtom);
  const setTickers = useSetAtom(tickersAtom);
  const setCrossRate = useSetAtom(crossRateAtom);
  const setPinned = useSetAtom(pinnedAtom);
  const setOpenRows = useSetAtom(openRowsAtom);
  const setMuted = useSetAtom(mutedAtom);
  const setSortFrozen = useSetAtom(sortFrozenAtom);
  const setWsReadyStateA = useSetAtom(wsReadyStateAAtom);
  const setWsReadyStateB = useSetAtom(wsReadyStateBAtom);
  const didFetchRef = useRef(false);
  const pairRef = useRef(pair);
  pairRef.current = pair;

  const marketKeyA = `${pair.marketA.exchangeId}:${pair.marketA.quoteCurrency}`;
  const marketKeyB = `${pair.marketB.exchangeId}:${pair.marketB.quoteCurrency}`;

  // Fetch dynamic tickers from REST APIs on first mount
  useEffect(() => {
    if (didFetchRef.current) return;
    didFetchRef.current = true;
    initMarketPairAsync(setPair);
  }, [setPair]);

  // Initialize/reinitialize market data when pair changes
  useEffect(() => {
    clearMarketData(setRowMap, setTickers, setCrossRate);
    setSortFrozen(false);
    const key = buildPrefsKey(marketKeyA, marketKeyB);
    const prefs = loadPrefs(key);
    setPinned(prefs.pinned);
    setOpenRows(prefs.openRows);
    setMuted(prefs.muted);
    initMarketData(marketKeyA, marketKeyB, setRowMap, setTickers, setCrossRate);
  }, [marketKeyA, marketKeyB, setRowMap, setTickers, setCrossRate, setPinned, setOpenRows, setMuted, setSortFrozen]);

  // Seed initial prices from REST cache.
  // Runs when `pair` updates (e.g., after initMarketPairAsync resolves with real tickers).
  useEffect(() => {
    if (pair.commonTickers.length === 0) return;
    for (const [adapter, mKey, quoteCurrency] of [
      [pair.adapterA, marketKeyA, pair.marketA.quoteCurrency],
      [pair.adapterB, marketKeyB, pair.marketB.quoteCurrency],
    ] as const) {
      const cached = adapter.getCachedPrices?.(quoteCurrency);
      if (cached) {
        for (const ticker of pair.commonTickers) {
          const price = cached.get(ticker);
          if (price !== undefined) updatePrice(mKey, ticker, price);
        }
      }
    }
  }, [pair, marketKeyA, marketKeyB]);

  // Connect exchange A
  const readyStateA = useExchangeWebSocket(
    pair.adapterA,
    pair.marketA.quoteCurrency,
    pair.commonTickers,
    pair.crossRateSource,
  );

  // Connect exchange B
  const readyStateB = useExchangeWebSocket(
    pair.adapterB,
    pair.marketB.quoteCurrency,
    pair.commonTickers,
    pair.crossRateSource,
  );

  // Sync WS readyState to atoms
  useEffect(() => { setWsReadyStateA(readyStateA); }, [readyStateA, setWsReadyStateA]);
  useEffect(() => { setWsReadyStateB(readyStateB); }, [readyStateB, setWsReadyStateB]);

  return null;
}
