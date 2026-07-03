import React, { ReactNode } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, CircularProgress, IconButton, Menu, MenuItem, TablePagination
} from '@mui/material';

export interface ColumnDef<T> {
  id: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  render: (row: T, index: number) => ReactNode;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;
  emptyText?: string;
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
  emptyText = 'No records found.',
  keyExtractor,
  pagination,
}: DataTableProps<T>) {
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
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-16">
                  <CircularProgress size={32} thickness={5} sx={{ color: '#0a5bd7' }} />
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-16 text-slate-500 font-medium">
                  {emptyText}
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
