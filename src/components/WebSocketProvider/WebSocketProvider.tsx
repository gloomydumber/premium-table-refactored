import { useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { marketPairAtom, initMarketPairAsync } from '../../store/marketPairAtom';
import { rowMapAtom, tickersAtom, crossRateAtom, pinnedAtom, openRowsAtom, mutedAtom } from '../../store/marketAtoms';
import { useExchangeWebSocket } from '../../hooks/useExchangeWebSocket';
import { initMarketData, clearMarketData } from '../../store/marketData';

export function WebSocketProvider() {
  const pair = useAtomValue(marketPairAtom);
  const setPair = useSetAtom(marketPairAtom);
  const setRowMap = useSetAtom(rowMapAtom);
  const setTickers = useSetAtom(tickersAtom);
  const setCrossRate = useSetAtom(crossRateAtom);
  const setPinned = useSetAtom(pinnedAtom);
  const setOpenRows = useSetAtom(openRowsAtom);
  const setMuted = useSetAtom(mutedAtom);
  const didFetchRef = useRef(false);

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
    setPinned(new Set());
    setOpenRows(new Set());
    setMuted(new Set());
    initMarketData(marketKeyA, marketKeyB, setRowMap, setTickers, setCrossRate);
  }, [marketKeyA, marketKeyB, setRowMap, setTickers, setCrossRate, setPinned, setOpenRows, setMuted]);

  // Connect exchange A
  useExchangeWebSocket(
    pair.adapterA,
    pair.marketA.quoteCurrency,
    pair.commonTickers,
    pair.crossRateSource,
  );

  // Connect exchange B
  useExchangeWebSocket(
    pair.adapterB,
    pair.marketB.quoteCurrency,
    pair.commonTickers,
    pair.crossRateSource,
  );

  return null;
}
