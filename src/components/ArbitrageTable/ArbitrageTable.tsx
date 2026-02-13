import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useAtomValue, useAtom, useSetAtom } from 'jotai';
import { TableVirtuoso } from 'react-virtuoso';
import { TableCell, TableRow, Box, IconButton, Tooltip } from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { MarketPairSelector } from '../MarketPairSelector';
import { sortedTickersAtom, openRowsAtom, pinnedAtom, mutedAtom, rowMapAtom, rowAtomFamily, crossRateAtom, calcPremium, wsReadyStateAAtom, wsReadyStateBAtom } from '../../store/marketAtoms';
import { marketPairAtom } from '../../store/marketPairAtom';
import { EXCHANGE_COLORS } from '../../exchanges/colors';
import { virtuosoTableComponents } from './VirtuosoTableComponents';
import { MemoMainRow, MemoDetailRow } from './Row';
import { SkeletonRow } from './SkeletonRow';
import { buildPrefsKey, savePrefs } from '../../utils/prefsStorage';

interface VirtualRow {
  type: 'main' | 'detail' | 'skeleton';
  ticker: string;
}

const SKELETON_COUNT = 40;

function MainRowByTicker({
  ticker,
  quoteCurrencyA,
  quoteCurrencyB,
  isOpen,
  onTogglePin,
  onToggleExpand,
  onToggleMute,
}: {
  ticker: string;
  quoteCurrencyA: string;
  quoteCurrencyB: string;
  isOpen: boolean;
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
      isOpen={isOpen}
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

const WS_STATUS_LABELS: Record<number, string> = {
  0: 'Connecting',
  1: 'Connected',
  2: 'Closing',
  3: 'Closed',
};

const wsTooltipSlotProps = {
  tooltip: {
    sx: {
      bgcolor: 'rgba(0, 0, 0, 0.92)',
      color: 'lime',
      border: '1px solid rgba(0, 255, 0, 0.3)',
      fontSize: '0.75rem',
      fontFamily: '"JetBrains Mono", monospace',
    },
  },
  arrow: {
    sx: {
      color: 'rgba(0, 0, 0, 0.92)',
      '&::before': { border: '1px solid rgba(0, 255, 0, 0.3)' },
    },
  },
} as const;

function wsStatusDot(readyState: number, exchangeName: string) {
  const color = readyState === 1 ? '#00ff00' : readyState === 0 ? '#ffff00' : '#ff0000';
  const label = WS_STATUS_LABELS[readyState] ?? 'Unknown';
  return (
    <Tooltip
      title={`${exchangeName} WebSocket: ${label}`}
      arrow
      placement="bottom"
      slotProps={wsTooltipSlotProps}
    >
      <Box
        component="span"
        sx={{
          display: 'inline-block',
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: color,
          ml: 0.5,
          verticalAlign: 'middle',
          cursor: 'default',
        }}
      />
    </Tooltip>
  );
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
  const readyStateA = useAtomValue(wsReadyStateAAtom);
  const readyStateB = useAtomValue(wsReadyStateBAtom);

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

  // Derive market keys for localStorage scoping
  const marketKeyA = `${pair.marketA.exchangeId}:${pair.marketA.quoteCurrency}`;
  const marketKeyB = `${pair.marketB.exchangeId}:${pair.marketB.quoteCurrency}`;

  // Persist prefs to localStorage whenever pin/mute/expand state changes.
  // When market keys change (page refresh or tab switch), skip the first fire —
  // atoms still hold stale values until WebSocketProvider restores from localStorage.
  const prevKeysRef = useRef('');
  useEffect(() => {
    const currentKeys = `${marketKeyA}|${marketKeyB}`;
    if (currentKeys !== prevKeysRef.current) {
      prevKeysRef.current = currentKeys;
      return;
    }
    const key = buildPrefsKey(marketKeyA, marketKeyB);
    savePrefs(key, pinned, muted, openRows);
  }, [pinned, muted, openRows, marketKeyA, marketKeyB]);

  // Sync rowMap isPinned/isMuted flags to match restored prefs.
  // Runs on every sortedTickers change so rows arriving in later batches get synced.
  // Short-circuits via next===prev when all flags already match (no-op).
  useEffect(() => {
    if ((pinned.size === 0 && muted.size === 0) || sortedTickers.length === 0) return;
    setRowMap((prev) => {
      let next = prev;
      for (const ticker of pinned) {
        if (next[ticker] && !next[ticker].isPinned) {
          next = { ...next, [ticker]: { ...next[ticker], isPinned: true } };
        }
      }
      for (const ticker of muted) {
        if (next[ticker] && !next[ticker].isMuted) {
          next = { ...next, [ticker]: { ...next[ticker], isMuted: true } };
        }
      }
      return next === prev ? prev : next;
    });
  }, [sortedTickers, pinned, muted, setRowMap]);

  // Reset all prefs for current tab
  const handleResetPrefs = useCallback(() => {
    setPinned(new Set());
    setOpenRows(new Set());
    setMuted(new Set());
    setRowMap((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (next[key].isPinned || next[key].isMuted) {
          next[key] = { ...next[key], isPinned: false, isMuted: false };
        }
      }
      return next;
    });
  }, [setPinned, setOpenRows, setMuted, setRowMap]);

  // Build flat virtual row list: skeleton rows when loading, else main + detail rows
  const virtualRows: VirtualRow[] = useMemo(() => {
    if (sortedTickers.length === 0) {
      return Array.from({ length: SKELETON_COUNT }, (_, i) => ({
        type: 'skeleton' as const,
        ticker: `sk-${i}`,
      }));
    }
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
          <TableCell sx={{ width: '16%', borderBottom: '1px solid rgba(0, 255, 0, 0.12)', verticalAlign: 'bottom', p: '0 8px 4px' }}>
            <MarketPairSelector />
          </TableCell>
          <TableCell align="right" sx={{ width: '30%', borderBottom: '1px solid rgba(0, 255, 0, 0.12)', color: EXCHANGE_COLORS[exchangeNameA] ?? '#00ff00' }}>
            {exchangeNameA.toUpperCase()} ({quoteCurrencyA}){wsStatusDot(readyStateA, exchangeNameA)}
          </TableCell>
          <TableCell align="right" sx={{ width: '30%', borderBottom: '1px solid rgba(0, 255, 0, 0.12)', color: EXCHANGE_COLORS[exchangeNameB] ?? '#00ff00' }}>
            {exchangeNameB.toUpperCase()} ({quoteCurrencyB}){wsStatusDot(readyStateB, exchangeNameB)}
          </TableCell>
          <TableCell align="right" sx={{ width: '24%', borderBottom: '1px solid rgba(0, 255, 0, 0.12)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
              PREMIUM
              <Tooltip
                title="Reset pin, mute, and expand preferences for the current tab only. Other tabs are not affected."
                arrow
                placement="bottom"
                slotProps={{
                  tooltip: {
                    sx: {
                      bgcolor: 'rgba(0, 0, 0, 0.92)',
                      color: 'lime',
                      border: '1px solid rgba(0, 255, 0, 0.3)',
                      fontSize: '0.75rem',
                      fontFamily: '"JetBrains Mono", monospace',
                    },
                  },
                  arrow: {
                    sx: {
                      color: 'rgba(0, 0, 0, 0.92)',
                      '&::before': { border: '1px solid rgba(0, 255, 0, 0.3)' },
                    },
                  },
                }}
              >
                <IconButton
                  size="small"
                  onClick={handleResetPrefs}
                  sx={{ opacity: 0.5, '&:hover': { opacity: 1 }, p: '2px' }}
                >
                  <RestartAltIcon sx={{ fontSize: 14, color: 'rgba(0, 255, 0, 0.6)' }} />
                </IconButton>
              </Tooltip>
            </Box>
          </TableCell>
        </TableRow>
      )}
      itemContent={(_, virtualRow) => {
        if (virtualRow.type === 'skeleton') {
          return <SkeletonRow />;
        }
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
            isOpen={openRows.has(virtualRow.ticker)}
            onTogglePin={handleTogglePin}
            onToggleExpand={handleToggleExpand}
            onToggleMute={handleToggleMute}
          />
        );
      }}
    />
  );
}
