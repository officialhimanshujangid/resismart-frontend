import React, { ReactNode, useMemo, useState } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Skeleton, TablePagination, TableSortLabel, Checkbox, Button,
  Menu, MenuItem, ListItemText, IconButton, Tooltip,
} from '@mui/material';
import { Inbox, Download, Columns3 } from 'lucide-react';

/**
 * The one table.
 *
 * It used to be a styled tbody with pagination and nothing else — no sorting,
 * no row click, no selection, no export. That is why thirty-six screens
 * hand-rolled their own MUI table and another twenty gave up and rendered
 * cards, and why not one column anywhere in the product could be sorted.
 * Everything a person means by "managing data" now lives here, once.
 *
 * Each capability is opt-in per column or per table, so an existing caller that
 * passes only `columns`/`data` behaves exactly as before.
 */

export interface ColumnDef<T> {
  id: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  render: (row: T, index: number) => ReactNode;
  /**
   * Makes the header clickable. Give a comparable value — a string, number or
   * Date — rather than the rendered node, because what you SEE is often a chip
   * or a formatted amount and sorting on that reads as random.
   */
  sortValue?: (row: T) => string | number | Date | null | undefined;
  /** For CSV export. Falls back to `sortValue`, then to nothing. */
  exportValue?: (row: T) => string | number | null | undefined;
  /** Start hidden; the reader can switch it on from the columns menu. */
  defaultHidden?: boolean;
  /** Never offered in the columns menu — the row would stop making sense. */
  alwaysVisible?: boolean;
}

export interface BulkAction<T> {
  label: string;
  icon?: ReactNode;
  /** Called with the selected rows. Return nothing; the table clears selection after. */
  onRun: (rows: T[]) => void | Promise<void>;
  destructive?: boolean;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;
  refetching?: boolean;
  emptyText?: string;
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

  /** Anything the screen wants above the table: search, filters, an Add button. */
  toolbar?: ReactNode;
  /** Clicking a row — the commonest thing a list is for, and it was missing. */
  onRowClick?: (row: T) => void;
  /** Turns on checkboxes. Actions appear in a bar once something is picked. */
  bulkActions?: BulkAction<T>[];
  /** Offer a CSV download. There was previously no way to get data OUT at all. */
  exportFileName?: string;
  /** Let the reader hide columns they do not care about. */
  columnToggle?: boolean;
}

type SortDir = 'asc' | 'desc';

const csvCell = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  const s = v instanceof Date ? v.toISOString() : String(v);
  // Quote when the value could break the row apart.
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

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
  toolbar,
  onRowClick,
  bulkActions,
  exportFileName,
  columnToggle,
}: DataTableProps<T>) {
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set(columns.filter(c => c.defaultHidden).map(c => c.id)),
  );
  const [colMenu, setColMenu] = useState<HTMLElement | null>(null);
  const [running, setRunning] = useState(false);

  const shown = columns.filter(c => !hidden.has(c.id));

  /**
   * Sorting is done here, on the page's rows.
   *
   * That is a deliberate limit worth stating: with server pagination this sorts
   * the CURRENT page, not the whole set. It is honest for the sizes these
   * screens hold and avoids every caller growing a sort parameter overnight; a
   * screen that genuinely needs whole-set ordering should sort server-side and
   * simply not pass `sortValue`.
   */
  const rows = useMemo(() => {
    if (!sortBy) return data;
    const col = columns.find(c => c.id === sortBy);
    if (!col?.sortValue) return data;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      // Blanks always sink, whichever way the arrow points — a column of empty
      // cells at the top is never what somebody meant by "sort by due date".
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (av instanceof Date || bv instanceof Date) {
        return (new Date(av as any).getTime() - new Date(bv as any).getTime()) * dir;
      }
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
    });
  }, [data, columns, sortBy, sortDir]);

  const toggleSort = (id: string) => {
    if (sortBy === id) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(id); setSortDir('asc'); }
  };

  const allOnPage = rows.map(keyExtractor);
  const allPicked = allOnPage.length > 0 && allOnPage.every(k => selected.has(k));
  const somePicked = allOnPage.some(k => selected.has(k)) && !allPicked;

  const pickAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allPicked) allOnPage.forEach(k => next.delete(k));
      else allOnPage.forEach(k => next.add(k));
      return next;
    });
  };

  const runBulk = async (action: BulkAction<T>) => {
    const picked = rows.filter(r => selected.has(keyExtractor(r)));
    if (!picked.length) return;
    setRunning(true);
    try { await action.onRun(picked); setSelected(new Set()); }
    finally { setRunning(false); }
  };

  const exportCsv = () => {
    const cols = shown.filter(c => c.exportValue || c.sortValue);
    const header = cols.map(c => csvCell(c.label)).join(',');
    const body = rows.map(r =>
      cols.map(c => csvCell(c.exportValue ? c.exportValue(r) : c.sortValue?.(r))).join(','),
    ).join('\n');
    // A BOM, because Excel on Windows reads a plain UTF-8 CSV as Latin-1 and
    // turns every rupee sign and Devanagari name into mojibake.
    const blob = new Blob(['﻿' + header + '\n' + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportFileName || 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const skeletonCount = Math.min(pagination?.pageSize || 8, 8);
  const pickedCount = rows.filter(r => selected.has(keyExtractor(r))).length;

  return (
    <div className="w-full space-y-2">
      {(toolbar || exportFileName || columnToggle) && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">{toolbar}</div>
          {columnToggle && (
            <Tooltip title="Which columns to show">
              <IconButton size="small" onClick={e => setColMenu(e.currentTarget)}>
                <Columns3 className="w-4 h-4 text-slate-500" />
              </IconButton>
            </Tooltip>
          )}
          {exportFileName && (
            <Button size="small" variant="outlined" startIcon={<Download className="w-3.5 h-3.5" />}
              onClick={exportCsv} className="!rounded-xl !normal-case !font-bold !text-xs">
              Export
            </Button>
          )}
        </div>
      )}

      <Menu anchorEl={colMenu} open={!!colMenu} onClose={() => setColMenu(null)}>
        {columns.filter(c => !c.alwaysVisible).map(c => (
          <MenuItem key={c.id} dense onClick={() => setHidden(prev => {
            const next = new Set(prev);
            next.has(c.id) ? next.delete(c.id) : next.add(c.id);
            return next;
          })}>
            <Checkbox size="small" checked={!hidden.has(c.id)} className="!p-0 !mr-2" />
            <ListItemText slotProps={{ primary: { className: '!text-sm' } }}>{c.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>

      {bulkActions && pickedCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/60 px-3 py-2">
          <span className="text-xs font-bold text-indigo-900">{pickedCount} selected</span>
          <div className="flex-1" />
          {bulkActions.map(a => (
            <Button key={a.label} size="small" disabled={running} startIcon={a.icon}
              color={a.destructive ? 'error' : 'primary'}
              onClick={() => runBulk(a)}
              className="!rounded-xl !normal-case !font-bold !text-xs">
              {a.label}
            </Button>
          ))}
          <Button size="small" onClick={() => setSelected(new Set())}
            className="!normal-case !font-bold !text-xs !text-slate-500">Clear</Button>
        </div>
      )}

      <TableContainer component={Paper} elevation={0} className="border border-slate-200/60 rounded-2xl overflow-hidden shadow-sm">
        <Table>
          <TableHead className="bg-slate-50 border-b border-slate-200/60">
            <TableRow>
              {bulkActions && (
                <TableCell padding="checkbox">
                  <Checkbox size="small" checked={allPicked} indeterminate={somePicked} onChange={pickAll} />
                </TableCell>
              )}
              {shown.map((col) => (
                <TableCell key={col.id} align={col.align || 'left'} className="font-bold text-slate-700 py-4"
                  sortDirection={sortBy === col.id ? sortDir : false}>
                  {col.sortValue ? (
                    <TableSortLabel active={sortBy === col.id} direction={sortBy === col.id ? sortDir : 'asc'}
                      onClick={() => toggleSort(col.id)}>
                      {col.label}
                    </TableSortLabel>
                  ) : col.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody
            sx={refetching ? { opacity: 0.55, transition: 'opacity 150ms ease', pointerEvents: 'none' } : { transition: 'opacity 150ms ease' }}
          >
            {loading ? (
              Array.from({ length: skeletonCount }).map((_, r) => (
                <TableRow key={`sk-${r}`}>
                  {bulkActions && <TableCell padding="checkbox" />}
                  {shown.map((col) => (
                    <TableCell key={col.id} align={col.align || 'left'}>
                      <Skeleton variant="rounded" height={16} sx={{ borderRadius: 1, bgcolor: 'rgba(15,23,42,0.06)' }} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={shown.length + (bulkActions ? 1 : 0)} className="py-16">
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
              rows.map((row, rowIndex) => {
                const key = keyExtractor(row);
                return (
                  <TableRow key={key}
                    hover={!!onRowClick}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-slate-50/70' : 'hover:bg-slate-50/50'}`}>
                    {bulkActions && (
                      // Stop the click bubbling, or ticking a box would also open
                      // the row — which is maddening when picking twenty of them.
                      <TableCell padding="checkbox" onClick={e => e.stopPropagation()}>
                        <Checkbox size="small" checked={selected.has(key)}
                          onChange={() => setSelected(prev => {
                            const next = new Set(prev);
                            next.has(key) ? next.delete(key) : next.add(key);
                            return next;
                          })} />
                      </TableCell>
                    )}
                    {shown.map((col) => (
                      <TableCell key={col.id} align={col.align || 'left'}>
                        {col.render(row, rowIndex)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
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
