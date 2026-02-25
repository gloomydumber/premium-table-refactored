import React, { useCallback } from 'react';
import {
  Table,
  TableBody,
  TableHead,
  TableRow,
} from '@mui/material';
import { useSetAtom, useAtomValue } from 'jotai';
import type { TableComponents } from 'react-virtuoso';
import { sortFrozenAtom, tickersAtom } from '../../store/marketAtoms';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const virtuosoTableComponents: TableComponents<any> = {
  Scroller: React.forwardRef<HTMLDivElement>((props, ref) => (
    <div {...props} ref={ref} className="pt-scroller" />
  )),
  Table: (props) => (
    <Table {...props} size="small" stickyHeader sx={{ tableLayout: 'fixed' }} />
  ),
  TableHead: React.forwardRef<HTMLTableSectionElement>((props, ref) => (
    <TableHead {...props} ref={ref} />
  )),
  TableBody: React.forwardRef<HTMLTableSectionElement>((props, ref) => {
    const setSortFrozen = useSetAtom(sortFrozenAtom);
    const tickers = useAtomValue(tickersAtom);
    const hasData = tickers.length > 0;
    const onMouseEnter = useCallback(() => { if (hasData) setSortFrozen(true); }, [setSortFrozen, hasData]);
    const onMouseLeave = useCallback(() => setSortFrozen(false), [setSortFrozen]);
    return (
      <TableBody
        {...props}
        ref={ref}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
    );
  }),
  TableRow: (props) => <TableRow hover {...props} />,
};
