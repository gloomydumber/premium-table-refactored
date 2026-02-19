import React, { useEffect, useRef } from 'react';
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
  const cellRefA = useRef<HTMLTableCellElement>(null);
  const cellRefB = useRef<HTMLTableCellElement>(null);
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

  // Clear stale flash when ticker changes (Virtuoso recycling)
  useEffect(() => {
    if (cellRefA.current) cellRefA.current.style.color = '';
    if (cellRefB.current) cellRefB.current.style.color = '';
    if (timeoutARef.current !== null) { clearTimeout(timeoutARef.current); timeoutARef.current = null; }
    if (timeoutBRef.current !== null) { clearTimeout(timeoutBRef.current); timeoutBRef.current = null; }
  }, [row.ticker]);

  // Flash on priceA change — ref-based DOM manipulation (no re-render)
  useEffect(() => {
    if (prevPriceARef.current !== row.priceA && prevPriceARef.current > 0) {
      const color = row.priceA > prevPriceARef.current ? '#ff0000' : '#0000ff';
      if (cellRefA.current) cellRefA.current.style.color = color;
      timeoutARef.current = window.setTimeout(() => {
        if (cellRefA.current) cellRefA.current.style.color = '';
        timeoutARef.current = null;
      }, 100);
    }
    prevPriceARef.current = row.priceA;
    return () => {
      if (timeoutARef.current !== null) clearTimeout(timeoutARef.current);
    };
  }, [row.priceA]);

  // Flash on priceB change — ref-based DOM manipulation (no re-render)
  useEffect(() => {
    if (prevPriceBRef.current !== row.priceB && prevPriceBRef.current > 0) {
      const color = row.priceB > prevPriceBRef.current ? '#ff0000' : '#0000ff';
      if (cellRefB.current) cellRefB.current.style.color = color;
      timeoutBRef.current = window.setTimeout(() => {
        if (cellRefB.current) cellRefB.current.style.color = '';
        timeoutBRef.current = null;
      }, 100);
    }
    prevPriceBRef.current = row.priceB;
    return () => {
      if (timeoutBRef.current !== null) clearTimeout(timeoutBRef.current);
    };
  }, [row.priceB]);

  const premiumBg = calculatePremiumBackgroundColor(premium);
  const tickerColor = row.isMuted ? 'rgba(255, 255, 255, 0.3)' : isArbitrageable ? '#00ff00' : '#ff0000';
  const mutedOpacity = row.isMuted ? 0.3 : 1;

  return (
    <>
      <TableCell
        style={{ color: tickerColor, fontWeight: 'bold' }}
      >
        <span style={{ userSelect: 'none' }}>{row.ticker}</span>
        {!row.isMuted && (
          <ArrowUpwardIcon
            className="pt-icon pt-show-on-hover"
            onClick={() => onTogglePin(row.ticker)}
            style={{
              fontSize: '0.75rem',
              marginLeft: 6,
              color: row.isPinned ? '#00ff00' : 'rgba(255, 255, 255, 0.4)',
              visibility: row.isPinned ? 'visible' : undefined,
            }}
          />
        )}
        {!row.isPinned && (
          <ArrowDownwardIcon
            className="pt-icon pt-show-on-hover"
            onClick={() => onToggleMute(row.ticker)}
            style={{
              fontSize: '0.75rem',
              marginLeft: row.isMuted ? 6 : 4,
              color: row.isMuted ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.4)',
              visibility: row.isMuted ? 'visible' : undefined,
            }}
          />
        )}
        {row.isPinned && (
          isOpen ? (
            <ExpandLessIcon
              className="pt-icon"
              onClick={() => onToggleExpand(row.ticker)}
              style={{ fontSize: '0.9rem', marginLeft: 2.4, color: 'lime' }}
            />
          ) : (
            <ExpandMoreIcon
              className="pt-icon pt-show-on-hover"
              onClick={() => onToggleExpand(row.ticker)}
              style={{ fontSize: '0.9rem', marginLeft: 2.4, color: 'rgba(255, 255, 255, 0.4)' }}
            />
          )
        )}
      </TableCell>
      <TableCell
        ref={cellRefA}
        align="right"
        style={{ fontVariantNumeric: 'tabular-nums', transition: 'color 0.1s ease-out', opacity: mutedOpacity }}
      >
        {formatPrice(row.priceA, quoteCurrencyA)}
      </TableCell>
      <TableCell
        ref={cellRefB}
        align="right"
        style={{ fontVariantNumeric: 'tabular-nums', transition: 'color 0.1s ease-out', opacity: mutedOpacity }}
      >
        {formatPrice(row.priceB, quoteCurrencyB)}
      </TableCell>
      <TableCell
        align="right"
        style={{ fontVariantNumeric: 'tabular-nums', opacity: mutedOpacity }}
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
