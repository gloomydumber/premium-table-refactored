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
    setWsReadyStateA(0);
    setWsReadyStateB(0);
    const key = buildPrefsKey(marketKeyA, marketKeyB);
    const prefs = loadPrefs(key);
    setPinned(prefs.pinned);
    setOpenRows(prefs.openRows);
    setMuted(prefs.muted);
    initMarketData(marketKeyA, marketKeyB, setRowMap, setTickers, setCrossRate);

    // Seed initial prices from REST cache (if available)
    const p = pairRef.current;
    for (const [adapter, mKey, quoteCurrency] of [
      [p.adapterA, marketKeyA, p.marketA.quoteCurrency],
      [p.adapterB, marketKeyB, p.marketB.quoteCurrency],
    ] as const) {
      const cached = adapter.getCachedPrices?.(quoteCurrency);
      if (cached) {
        for (const ticker of p.commonTickers) {
          const price = cached.get(ticker);
          if (price !== undefined) updatePrice(mKey, ticker, price);
        }
      }
    }
  }, [marketKeyA, marketKeyB, setRowMap, setTickers, setCrossRate, setPinned, setOpenRows, setMuted, setSortFrozen, setWsReadyStateA, setWsReadyStateB]);

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
