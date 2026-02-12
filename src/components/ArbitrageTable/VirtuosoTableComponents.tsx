import React, { useCallback } from 'react';
import {
  Table,
  TableBody,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import { useSetAtom } from 'jotai';
import type { TableComponents } from 'react-virtuoso';
import { sortFrozenAtom } from '../../store/marketAtoms';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const virtuosoTableComponents: TableComponents<any> = {
  Scroller: React.forwardRef<HTMLDivElement>((props, ref) => (
    <TableContainer
      component={Paper}
      {...props}
      ref={ref}
      sx={{
        maxHeight: '100%',
        backgroundColor: '#0a0a0a',
        '&::-webkit-scrollbar': {
          width: 6,
          background: 'transparent',
        },
        '&::-webkit-scrollbar-thumb': {
          background: 'rgba(0, 255, 0, 0.15)',
          borderRadius: 3,
        },
        '&::-webkit-scrollbar-thumb:hover': {
          background: 'rgba(0, 255, 0, 0.3)',
        },
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(0, 255, 0, 0.15) transparent',
      }}
    />
  )),
  Table: (props) => (
    <Table {...props} size="small" stickyHeader sx={{ tableLayout: 'fixed' }} />
  ),
  TableHead: React.forwardRef<HTMLTableSectionElement>((props, ref) => (
    <TableHead {...props} ref={ref} />
  )),
  TableBody: React.forwardRef<HTMLTableSectionElement>((props, ref) => {
    const setSortFrozen = useSetAtom(sortFrozenAtom);
    const onMouseEnter = useCallback(() => setSortFrozen(true), [setSortFrozen]);
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
