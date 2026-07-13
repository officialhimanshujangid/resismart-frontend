import React, { ReactNode } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Skeleton, TablePagination,
} from '@mui/material';
import { Inbox } from 'lucide-react';

export interface ColumnDef<T> {
  id: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  render: (row: T, index: number) => ReactNode;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  /** Initial load — shows skeleton rows so the layout doesn't jump. */
  loading?: boolean;
  /**
   * Background refetch (pagination / filter change) while rows already exist.
   * Keeps the current rows visible under a subtle dim + no layout shift, which
   * feels far faster than blanking the table on every page turn as data grows.
   */
  refetching?: boolean;
  emptyText?: string;
  /** Optional richer empty state. Falls back to `emptyText` when omitted. */
  emptyTitle?: string;
  emptyIcon?: ReactNode;
  keyExtractor: (row: T) => string;
  pagination?: {
    page: number; // 0-indexed for MUI
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
  };
}

export function DataTable<T>({
  columns,
  data,
  loading = false,
  refetching = false,
  emptyText = 'No records found.',
  emptyTitle,
  emptyIcon,
  keyExtractor,
  pagination,
}: DataTableProps<T>) {
  // Skeleton row count tracks the page size so the table reserves the right height.
  const skeletonCount = Math.min(pagination?.pageSize || 8, 8);

  return (
    <div className="w-full">
      <TableContainer component={Paper} elevation={0} className="border border-slate-200/60 rounded-2xl overflow-hidden shadow-sm">
        <Table>
          <TableHead className="bg-slate-50 border-b border-slate-200/60">
            <TableRow>
              {columns.map((col) => (
                <TableCell
                  key={col.id}
                  align={col.align || 'left'}
                  className="font-bold text-slate-700 py-4"
                >
                  {col.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody
            sx={refetching ? { opacity: 0.55, transition: 'opacity 150ms ease', pointerEvents: 'none' } : { transition: 'opacity 150ms ease' }}
          >
            {loading ? (
              // Skeleton rows preserve layout on first load — no spinner-then-jump.
              Array.from({ length: skeletonCount }).map((_, r) => (
                <TableRow key={`sk-${r}`}>
                  {columns.map((col) => (
                    <TableCell key={col.id} align={col.align || 'left'}>
                      <Skeleton variant="rounded" height={16} sx={{ borderRadius: 1, bgcolor: 'rgba(15,23,42,0.06)' }} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-16">
                  <div className="flex flex-col items-center justify-center gap-3 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-center text-slate-400">
                      {emptyIcon || <Inbox className="w-6 h-6" />}
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-slate-700 font-bold text-sm">{emptyTitle || emptyText}</p>
                      {emptyTitle && <p className="text-slate-400 text-xs">{emptyText}</p>}
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, rowIndex) => (
                <TableRow key={keyExtractor(row)} className="hover:bg-slate-50/50 transition-colors">
                  {columns.map((col) => (
                    <TableCell key={col.id} align={col.align || 'left'}>
                      {col.render(row, rowIndex)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {pagination && (
        <TablePagination
          component="div"
          count={pagination.total}
          page={pagination.page}
          onPageChange={(_, newPage) => pagination.onPageChange(newPage)}
          rowsPerPage={pagination.pageSize}
          onRowsPerPageChange={(e) => pagination.onPageSizeChange?.(parseInt(e.target.value, 10))}
          className="border-t border-slate-200/60 bg-white rounded-b-2xl"
        />
      )}
    </div>
  );
}
