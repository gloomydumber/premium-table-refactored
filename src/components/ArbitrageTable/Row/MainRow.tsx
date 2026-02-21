import React, { useEffect, useRef } from 'react';
import { TableCell, useTheme } from '@mui/material';
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

  const theme = useTheme();
  const premiumBg = calculatePremiumBackgroundColor(premium);
  const tickerColor = row.isMuted ? theme.palette.text.disabled : isArbitrageable ? theme.palette.success.main : theme.palette.error.main;
  const iconDimColor = theme.palette.text.disabled;
  const mutedOpacity = row.isMuted ? 0.3 : 1;

  return (
    <>
      <TableCell
        style={{ color: tickerColor, fontWeight: 'bold' }}
      >
        <span style={{ userSelect: 'none' }}>{row.ticker}</span>
        {!row.isMuted && (
          <span
            className="pt-icon pt-show-on-hover"
            onClick={() => onTogglePin(row.ticker)}
            style={{
              marginLeft: 4,
              color: row.isPinned ? theme.palette.primary.main : iconDimColor,
              visibility: row.isPinned ? 'visible' : undefined,
            }}
          >
            ▴
          </span>
        )}
        {!row.isPinned && (
          <span
            className="pt-icon pt-show-on-hover"
            onClick={() => onToggleMute(row.ticker)}
            style={{
              marginLeft: row.isMuted ? 4 : 2.4,
              color: iconDimColor,
              visibility: row.isMuted ? 'visible' : undefined,
            }}
          >
            ▾
          </span>
        )}
        {row.isPinned && (
          isOpen ? (
            <span
              className="pt-icon"
              onClick={() => onToggleExpand(row.ticker)}
              style={{ marginLeft: 2.4, color: theme.palette.primary.main }}
            >
              ▾
            </span>
          ) : (
            <span
              className="pt-icon pt-show-on-hover"
              onClick={() => onToggleExpand(row.ticker)}
              style={{ marginLeft: 2.4, color: iconDimColor }}
            >
              ▸
            </span>
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
