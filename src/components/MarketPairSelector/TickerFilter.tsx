import React, { useCallback, useRef } from 'react';
import { useAtom } from 'jotai';
import { useTheme } from '@mui/material';
import { filterAtom } from '../../store/marketAtoms';

const SearchIcon = ({ color }: { color: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

function TickerFilterInner() {
  const [filter, setFilter] = useAtom(filterAtom);
  const [focused, setFocused] = React.useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const theme = useTheme();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilter(e.target.value);
    },
    [setFilter],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFilter('');
        inputRef.current?.blur();
      }
    },
    [setFilter],
  );

  const handleBoxClick = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      onClick={handleBoxClick}
      style={{
        flex: '1 1 auto',
        minWidth: 0,
        height: 18,
        boxSizing: 'border-box',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 4,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        paddingLeft: 4,
        paddingRight: 4,
        cursor: 'text',
      }}
    >
      {!filter && !focused && <SearchIcon color={theme.palette.text.secondary} />}
      <input
        ref={inputRef}
        value={filter}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: theme.palette.primary.main,
          fontFamily: 'inherit',
          fontSize: '0.6rem',
          width: '100%',
          padding: 0,
          margin: 0,
          lineHeight: '16px',
          height: 16,
        }}
      />
    </div>
  );
}

export const TickerFilter = React.memo(TickerFilterInner);
