import { TableCell, Skeleton } from '@mui/material';

/** Cells only — Virtuoso provides the <tr> wrapper */
export function SkeletonRow() {
  return (
    <>
      <TableCell><Skeleton variant="text" sx={{ bgcolor: 'rgba(0, 255, 0, 0.06)' }} /></TableCell>
      <TableCell><Skeleton variant="text" sx={{ bgcolor: 'rgba(0, 255, 0, 0.06)' }} /></TableCell>
      <TableCell><Skeleton variant="text" sx={{ bgcolor: 'rgba(0, 255, 0, 0.06)' }} /></TableCell>
      <TableCell><Skeleton variant="text" sx={{ bgcolor: 'rgba(0, 255, 0, 0.06)' }} /></TableCell>
    </>
  );
}
