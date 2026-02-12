import React, { useEffect, useRef, useState } from 'react';
import { TableCell } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import type { MarketRow } from '../../../types/market';
import { formatPrice, formatPremium, calculatePremiumBackgroundColor } from '../../../utils/format';

interface MainRowProps {
  row: MarketRow;
  premium: number;
  quoteCurrencyA: string;
  quoteCurrencyB: string;
  isOpen: boolean;
  onTogglePin: (ticker: string) => void;
  onToggleExpand: (ticker: string) => void;
  onToggleMute: (ticker: string) => void;
  isArbitrageable: boolean;
}

/**
 * Renders the cells for a single data row.
 * Does NOT wrap in <TableRow> — Virtuoso provides the row wrapper.
 */
function MainRowInner({
  row,
  premium,
  quoteCurrencyA,
  quoteCurrencyB,
  isOpen,
  onTogglePin,
  onToggleExpand,
  onToggleMute,
  isArbitrageable,
}: MainRowProps) {
  const [flashA, setFlashA] = useState<'up' | 'down' | null>(null);
  const [flashB, setFlashB] = useState<'up' | 'down' | null>(null);
  const timeoutARef = useRef<number | null>(null);
  const timeoutBRef = useRef<number | null>(null);
  const prevPriceARef = useRef(row.priceA);
  const prevPriceBRef = useRef(row.priceB);
  const prevTickerRef = useRef(row.ticker);

  // When Virtuoso recycles this component for a different ticker,
  // reset refs so stale prices from the old ticker don't trigger a flash.
  if (prevTickerRef.current !== row.ticker) {
    prevPriceARef.current = row.priceA;
    prevPriceBRef.current = row.priceB;
    prevTickerRef.current = row.ticker;
  }

  // Clear stale flash state when ticker changes (Virtuoso recycling)
  useEffect(() => {
    setFlashA(null);
    setFlashB(null);
    if (timeoutARef.current !== null) { clearTimeout(timeoutARef.current); timeoutARef.current = null; }
    if (timeoutBRef.current !== null) { clearTimeout(timeoutBRef.current); timeoutBRef.current = null; }
  }, [row.ticker]);

  // Flash on priceA change
  useEffect(() => {
    if (prevPriceARef.current !== row.priceA && prevPriceARef.current > 0) {
      setFlashA(row.priceA > prevPriceARef.current ? 'up' : 'down');
      timeoutARef.current = window.setTimeout(() => setFlashA(null), 100);
    }
    prevPriceARef.current = row.priceA;
    return () => {
      if (timeoutARef.current !== null) clearTimeout(timeoutARef.current);
    };
  }, [row.priceA]);

  // Flash on priceB change
  useEffect(() => {
    if (prevPriceBRef.current !== row.priceB && prevPriceBRef.current > 0) {
      setFlashB(row.priceB > prevPriceBRef.current ? 'up' : 'down');
      timeoutBRef.current = window.setTimeout(() => setFlashB(null), 100);
    }
    prevPriceBRef.current = row.priceB;
    return () => {
      if (timeoutBRef.current !== null) clearTimeout(timeoutBRef.current);
    };
  }, [row.priceB]);

  const premiumBg = calculatePremiumBackgroundColor(premium);
  const tickerColor = row.isMuted ? 'rgba(255, 255, 255, 0.3)' : isArbitrageable ? '#00ff00' : '#ff0000';
  const flashColorA = flashA === 'up' ? '#ff0000' : flashA === 'down' ? '#0000ff' : undefined;
  const flashColorB = flashB === 'up' ? '#ff0000' : flashB === 'down' ? '#0000ff' : undefined;
  const mutedOpacity = row.isMuted ? 0.3 : 1;

  return (
    <>
      <TableCell
        sx={{ color: tickerColor, fontWeight: 'bold' }}
      >
        <span style={{ userSelect: 'none' }}>{row.ticker}</span>
        {!row.isMuted && (
          <ArrowUpwardIcon
            onClick={() => onTogglePin(row.ticker)}
            sx={{
              fontSize: '0.75rem',
              ml: 0.5,
              verticalAlign: 'middle',
              cursor: 'pointer',
              color: row.isPinned ? '#00ff00' : 'rgba(255, 255, 255, 0.4)',
              visibility: row.isPinned ? 'visible' : 'hidden',
              'tr:hover &': { visibility: 'visible' },
            }}
          />
        )}
        {!row.isPinned && (
          <ArrowDownwardIcon
            onClick={() => onToggleMute(row.ticker)}
            sx={{
              fontSize: '0.75rem',
              ml: row.isMuted ? 0.5 : 0.3,
              verticalAlign: 'middle',
              cursor: 'pointer',
              color: row.isMuted ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.4)',
              visibility: row.isMuted ? 'visible' : 'hidden',
              'tr:hover &': { visibility: 'visible' },
            }}
          />
        )}
        {row.isPinned && (
          isOpen ? (
            <ExpandLessIcon
              onClick={() => onToggleExpand(row.ticker)}
              sx={{ fontSize: '0.9rem', ml: 0.3, verticalAlign: 'middle', cursor: 'pointer', color: 'lime' }}
            />
          ) : (
            <ExpandMoreIcon
              onClick={() => onToggleExpand(row.ticker)}
              sx={{
                fontSize: '0.9rem',
                ml: 0.3,
                verticalAlign: 'middle',
                cursor: 'pointer',
                color: 'rgba(255, 255, 255, 0.4)',
                visibility: 'hidden',
                'tr:hover &': { visibility: 'visible' },
              }}
            />
          )
        )}
      </TableCell>
      <TableCell
        align="right"
        sx={{ fontVariantNumeric: 'tabular-nums', color: flashColorA, transition: 'color 0.1s ease-out', opacity: mutedOpacity }}
      >
        {formatPrice(row.priceA, quoteCurrencyA)}
      </TableCell>
      <TableCell
        align="right"
        sx={{ fontVariantNumeric: 'tabular-nums', color: flashColorB, transition: 'color 0.1s ease-out', opacity: mutedOpacity }}
      >
        {formatPrice(row.priceB, quoteCurrencyB)}
      </TableCell>
      <TableCell
        align="right"
        sx={{ fontVariantNumeric: 'tabular-nums', opacity: mutedOpacity }}
      >
        <span style={{ backgroundColor: premiumBg, padding: '1px 4px', borderRadius: 2 }}>
          {formatPremium(premium)}
        </span>
      </TableCell>
    </>
  );
}

function areEqual(prev: MainRowProps, next: MainRowProps) {
  return (
    prev.row === next.row &&
    prev.quoteCurrencyA === next.quoteCurrencyA &&
    prev.quoteCurrencyB === next.quoteCurrencyB &&
    prev.isOpen === next.isOpen &&
    prev.isArbitrageable === next.isArbitrageable &&
    prev.row.isMuted === next.row.isMuted &&
    // Compare formatted strings: tiny cross-rate fluctuations that don't
    // change the displayed value (±0.01%) skip re-render entirely.
    formatPremium(prev.premium) === formatPremium(next.premium)
  );
}

export const MemoMainRow = React.memo(MainRowInner, areEqual);
