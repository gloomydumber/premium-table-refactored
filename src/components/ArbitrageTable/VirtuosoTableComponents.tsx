import React from 'react';
import {
  Table,
  TableBody,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import type { TableComponents } from 'react-virtuoso';

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
  TableBody: React.forwardRef<HTMLTableSectionElement>((props, ref) => (
    <TableBody {...props} ref={ref} />
  )),
  TableRow: (props) => <TableRow hover {...props} />,
};
