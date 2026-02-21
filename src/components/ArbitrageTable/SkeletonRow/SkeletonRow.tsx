import { TableCell, Skeleton } from '@mui/material';

/** Cells only — Virtuoso provides the <tr> wrapper */
export function SkeletonRow() {
  return (
    <>
      <TableCell><Skeleton variant="text" sx={{ bgcolor: 'action.hover' }} /></TableCell>
      <TableCell><Skeleton variant="text" sx={{ bgcolor: 'action.hover' }} /></TableCell>
      <TableCell><Skeleton variant="text" sx={{ bgcolor: 'action.hover' }} /></TableCell>
      <TableCell><Skeleton variant="text" sx={{ bgcolor: 'action.hover' }} /></TableCell>
    </>
  );
}
