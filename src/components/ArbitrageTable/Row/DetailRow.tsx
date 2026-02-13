import React from 'react';
import {
  TableRow,
  TableCell,
  Table,
  TableHead,
  TableBody,
} from '@mui/material';
import type { WalletStatus } from '../../../types/market';
import { EXCHANGE_COLORS } from '../../../exchanges/colors';

interface DetailRowProps {
  walletStatus: WalletStatus[];
  exchangeNameA: string;
  exchangeNameB: string;
}

function StatusText({ ok }: { ok: boolean }) {
  return (
    <span style={{ color: ok ? '#00ff00' : '#ff0000', fontSize: '0.7rem' }}>
      {ok ? 'OK' : 'OFF'}
    </span>
  );
}

function NetworkName({
  name,
  ws,
  exchangeNameA,
  exchangeNameB,
}: {
  name: string;
  ws: WalletStatus;
  exchangeNameA: string;
  exchangeNameB: string;
}) {
  const aToB = ws.marketA.withdraw && ws.marketB.deposit;
  const bToA = ws.marketB.withdraw && ws.marketA.deposit;

  if (aToB && bToA) {
    return <span style={{ color: '#00ff00' }}>{name}</span>;
  }

  if (!aToB && !bToA) {
    return <span style={{ color: '#ff0000' }}>{name}</span>;
  }

  const colorA = EXCHANGE_COLORS[exchangeNameA] ?? '#00ff00';
  const colorB = EXCHANGE_COLORS[exchangeNameB] ?? '#00ff00';
  const leftColor = aToB ? colorA : colorB;
  const rightColor = aToB ? colorB : colorA;

  return (
    <span
      style={{
        backgroundImage: `linear-gradient(to right, ${leftColor} 50%, ${rightColor} 50%)`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}
    >
      {name}
    </span>
  );
}

/**
 * Renders a single cell spanning the full row with wallet status detail table.
 * Does NOT wrap in <TableRow> — Virtuoso provides the row wrapper.
 */
function DetailRowInner({ walletStatus, exchangeNameA, exchangeNameB }: DetailRowProps) {
  return (
    <TableCell colSpan={4} sx={{ py: 1, px: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Network</TableCell>
            <TableCell align="center">{exchangeNameA} Deposit</TableCell>
            <TableCell align="center">{exchangeNameA} Withdraw</TableCell>
            <TableCell align="center">{exchangeNameB} Deposit</TableCell>
            <TableCell align="center">{exchangeNameB} Withdraw</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {walletStatus.map((ws) => (
            <TableRow key={ws.networkName}>
              <TableCell>
                <NetworkName
                  name={ws.networkName}
                  ws={ws}
                  exchangeNameA={exchangeNameA}
                  exchangeNameB={exchangeNameB}
                />
              </TableCell>
              <TableCell align="center"><StatusText ok={ws.marketA.deposit} /></TableCell>
              <TableCell align="center"><StatusText ok={ws.marketA.withdraw} /></TableCell>
              <TableCell align="center"><StatusText ok={ws.marketB.deposit} /></TableCell>
              <TableCell align="center"><StatusText ok={ws.marketB.withdraw} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableCell>
  );
}

export const MemoDetailRow = React.memo(DetailRowInner);
