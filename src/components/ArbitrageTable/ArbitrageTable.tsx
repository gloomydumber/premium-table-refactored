import { useCallback, useMemo, useRef } from 'react';
import { useAtomValue, useAtom, useSetAtom } from 'jotai';
import { TableVirtuoso } from 'react-virtuoso';
import { TableCell, TableRow } from '@mui/material';
import { MarketPairSelector } from '../MarketPairSelector';
import { sortedTickersAtom, openRowsAtom, pinnedAtom, mutedAtom, rowMapAtom, rowAtomFamily, crossRateAtom, calcPremium } from '../../store/marketAtoms';
import { marketPairAtom } from '../../store/marketPairAtom';
import { virtuosoTableComponents } from './VirtuosoTableComponents';
import { MemoMainRow, MemoDetailRow } from './Row';
import { SkeletonRow } from './SkeletonRow';

interface VirtualRow {
  type: 'main' | 'detail';
  ticker: string;
}

function MainRowByTicker({
  ticker,
  quoteCurrencyA,
  quoteCurrencyB,
  onTogglePin,
  onToggleExpand,
  onToggleMute,
}: {
  ticker: string;
  quoteCurrencyA: string;
  quoteCurrencyB: string;
  onTogglePin: (ticker: string) => void;
  onToggleExpand: (ticker: string) => void;
  onToggleMute: (ticker: string) => void;
}) {
  const row = useAtomValue(rowAtomFamily(ticker));
  const crossRate = useAtomValue(crossRateAtom);
  if (!row) return <SkeletonRow />;

  const premium = calcPremium(row.priceA, row.priceB, crossRate);
  const isArbitrageable = checkArbitrageable(premium, row.walletStatus);

  return (
    <MemoMainRow
      row={row}
      premium={premium}
      quoteCurrencyA={quoteCurrencyA}
      quoteCurrencyB={quoteCurrencyB}
      onTogglePin={onTogglePin}
      onToggleExpand={onToggleExpand}
      onToggleMute={onToggleMute}
      isArbitrageable={isArbitrageable}
    />
  );
}

function DetailRowByTicker({
  ticker,
  exchangeNameA,
  exchangeNameB,
}: {
  ticker: string;
  exchangeNameA: string;
  exchangeNameB: string;
}) {
  const row = useAtomValue(rowAtomFamily(ticker));
  if (!row) return null;

  return (
    <MemoDetailRow
      walletStatus={row.walletStatus}
      exchangeNameA={exchangeNameA}
      exchangeNameB={exchangeNameB}
    />
  );
}

function checkArbitrageable(premium: number, walletStatus: { marketA: { deposit: boolean; withdraw: boolean }; marketB: { deposit: boolean; withdraw: boolean } }[]): boolean {
  if (!walletStatus.length) return false;
  return walletStatus.some((ws) => {
    if (premium > 0) {
      // Positive: A is expensive → buy on B, transfer B→A, sell on A
      return ws.marketB.withdraw && ws.marketA.deposit;
    }
    // Negative: B is expensive → buy on A, transfer A→B, sell on B
    return ws.marketA.withdraw && ws.marketB.deposit;
  });
}

export function ArbitrageTable() {
  const sortedTickers = useAtomValue(sortedTickersAtom);
  const [openRows, setOpenRows] = useAtom(openRowsAtom);
  const [pinned, setPinned] = useAtom(pinnedAtom);
  const pinnedRef = useRef(pinned);
  pinnedRef.current = pinned;
  const [muted, setMuted] = useAtom(mutedAtom);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const setRowMap = useSetAtom(rowMapAtom);
  const pair = useAtomValue(marketPairAtom);

  const exchangeNameA = pair.adapterA.name;
  const exchangeNameB = pair.adapterB.name;
  const quoteCurrencyA = pair.marketA.quoteCurrency;
  const quoteCurrencyB = pair.marketB.quoteCurrency;

  const handleTogglePin = useCallback((ticker: string) => {
    // Pinning a muted row unmutes it
    if (mutedRef.current.has(ticker)) {
      setMuted((prev) => { const n = new Set(prev); n.delete(ticker); return n; });
      setRowMap((prev) => {
        const row = prev[ticker];
        if (!row) return prev;
        return { ...prev, [ticker]: { ...row, isMuted: false } };
      });
    }
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) {
        next.delete(ticker);
        // Also close detail if unpinning
        setOpenRows((o) => { const n = new Set(o); n.delete(ticker); return n; });
      } else {
        next.add(ticker);
      }
      return next;
    });
    setRowMap((prev) => {
      const row = prev[ticker];
      if (!row) return prev;
      return { ...prev, [ticker]: { ...row, isPinned: !row.isPinned } };
    });
  }, [setPinned, setOpenRows, setRowMap, setMuted]);

  const handleToggleExpand = useCallback((ticker: string) => {
    if (!pinnedRef.current.has(ticker)) return;
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });
  }, [setOpenRows]);

  const handleToggleMute = useCallback((ticker: string) => {
    // Muting a pinned row unpins + closes detail
    if (pinnedRef.current.has(ticker)) {
      setPinned((prev) => { const n = new Set(prev); n.delete(ticker); return n; });
      setOpenRows((prev) => { const n = new Set(prev); n.delete(ticker); return n; });
      setRowMap((prev) => {
        const row = prev[ticker];
        if (!row) return prev;
        return { ...prev, [ticker]: { ...row, isPinned: false } };
      });
    }
    setMuted((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });
    setRowMap((prev) => {
      const row = prev[ticker];
      if (!row) return prev;
      return { ...prev, [ticker]: { ...row, isMuted: !row.isMuted } };
    });
  }, [setPinned, setOpenRows, setRowMap, setMuted]);

  // Build flat virtual row list: main rows + detail rows for expanded items
  const virtualRows: VirtualRow[] = useMemo(() => {
    const rows: VirtualRow[] = [];
    for (const ticker of sortedTickers) {
      rows.push({ type: 'main', ticker });
      if (openRows.has(ticker)) {
        rows.push({ type: 'detail', ticker });
      }
    }
    return rows;
  }, [sortedTickers, openRows]);

  return (
    <TableVirtuoso<VirtualRow>
      style={{ height: '100%' }}
      data={virtualRows}
      components={virtuosoTableComponents}
      fixedHeaderContent={() => (
        <TableRow sx={{ backgroundColor: '#0d0d0d' }}>
          <TableCell sx={{ width: '14%', borderBottom: '1px solid rgba(0, 255, 0, 0.12)', verticalAlign: 'bottom', p: '0 8px 4px' }}>
            <MarketPairSelector />
          </TableCell>
          <TableCell align="right" sx={{ width: '28%', borderBottom: '1px solid rgba(0, 255, 0, 0.12)' }}>
            {exchangeNameA.toUpperCase()} ({quoteCurrencyA})
          </TableCell>
          <TableCell align="right" sx={{ width: '28%', borderBottom: '1px solid rgba(0, 255, 0, 0.12)' }}>
            {exchangeNameB.toUpperCase()} ({quoteCurrencyB})
          </TableCell>
          <TableCell align="right" sx={{ width: '30%', borderBottom: '1px solid rgba(0, 255, 0, 0.12)' }}>PREMIUM</TableCell>
        </TableRow>
      )}
      itemContent={(_, virtualRow) => {
        if (virtualRow.type === 'detail') {
          return (
            <DetailRowByTicker
              ticker={virtualRow.ticker}
              exchangeNameA={exchangeNameA}
              exchangeNameB={exchangeNameB}
            />
          );
        }
        return (
          <MainRowByTicker
            ticker={virtualRow.ticker}
            quoteCurrencyA={quoteCurrencyA}
            quoteCurrencyB={quoteCurrencyB}
            onTogglePin={handleTogglePin}
            onToggleExpand={handleToggleExpand}
            onToggleMute={handleToggleMute}
          />
        );
      }}
    />
  );
}
