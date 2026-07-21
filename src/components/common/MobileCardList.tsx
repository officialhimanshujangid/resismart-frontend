'use client';

import React, { ReactNode } from 'react';
import { Paper, Skeleton, Checkbox } from '@mui/material';
import type { ColumnDef } from './DataTable';

/**
 * The same rows, on a phone.
 *
 * `DataTable` has one layout: a table. Below `sm` that means a fourteen-column
 * grid squeezed into 360px, so every screen in the product answers a phone by
 * side-scrolling — the reader drags left and right and loses which row they
 * were on, because the one column that identifies the row (the name, the flat)
 * scrolls away with everything else.
 *
 * A card fixes exactly that and nothing else: the identifying column becomes
 * the heading and stays put, and the rest of the row becomes label/value pairs
 * underneath. No horizontal scrolling, no lost context.
 *
 * Two deliberate constraints:
 *
 * 1. **It takes the SAME `ColumnDef`s the table takes.** A second column
 *    definition per screen is a second thing to forget to update — the gate
 *    pages already proved that shape goes stale (three layers restyling one
 *    header). One definition, two layouts.
 * 2. **The caller passes rows that are already sorted, filtered and paged.**
 *    This component decides nothing about the data; `DataTable` stays the one
 *    place where sorting, selection and paging live, so a card list can never
 *    disagree with the table it replaces.
 */

export interface MobileCardListProps<T> {
  /**
   * Visible columns, in order, already narrowed by the columns menu — so
   * hiding a column on a laptop and then picking the phone up hides it there
   * too, rather than the two views showing different things.
   */
  columns: ColumnDef<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  loading?: boolean;
  /** Dims the list while a background refetch is in flight, as the table does. */
  refetching?: boolean;
  skeletonCount?: number;
  onRowClick?: (row: T) => void;
  /**
   * Which column is the card's heading. Defaults to the first visible column,
   * which is the identifying one on every screen in this product.
   */
  titleColumn?: string;
  /** Optional second line under the heading — a flat number, a date. */
  subtitleColumn?: string;
  /** Checkboxes, driven by `DataTable`'s selection so the two never diverge. */
  selection?: {
    selected: Set<string>;
    onToggle: (key: string) => void;
  };
  /** Rendered when there is nothing — the caller passes its own empty block. */
  empty?: ReactNode;
}

export default function MobileCardList<T>({
  columns,
  data,
  keyExtractor,
  loading = false,
  refetching = false,
  skeletonCount = 4,
  onRowClick,
  titleColumn,
  subtitleColumn,
  selection,
  empty,
}: MobileCardListProps<T>) {
  const title = columns.find(c => c.id === titleColumn) || columns[0];
  const subtitle = subtitleColumn ? columns.find(c => c.id === subtitleColumn) : undefined;
  // Everything that is not already the heading or the subtitle becomes a
  // labelled line. Without this filter the flat number would appear twice on
  // every card, which reads as a bug.
  const rest = columns.filter(c => c.id !== title?.id && c.id !== subtitle?.id);

  if (loading) {
    return (
      <div className="space-y-2" role="status" aria-label="Loading">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <Paper key={`sk-${i}`} elevation={0} className="rounded-2xl border border-slate-200/60 p-4 space-y-2">
            <Skeleton variant="rounded" height={18} width="55%" sx={{ borderRadius: 1, bgcolor: 'rgba(15,23,42,0.06)' }} />
            <Skeleton variant="rounded" height={14} sx={{ borderRadius: 1, bgcolor: 'rgba(15,23,42,0.06)' }} />
            <Skeleton variant="rounded" height={14} width="80%" sx={{ borderRadius: 1, bgcolor: 'rgba(15,23,42,0.06)' }} />
          </Paper>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return <>{empty}</>;
  }

  return (
    <div
      className="space-y-2"
      // Same treatment the table body gets while refetching: visibly stale and
      // not clickable, rather than silently swapping under a thumb.
      style={refetching ? { opacity: 0.55, pointerEvents: 'none', transition: 'opacity 150ms ease' } : { transition: 'opacity 150ms ease' }}
    >
      {data.map((row, index) => {
        const key = keyExtractor(row);
        const picked = selection?.selected.has(key) ?? false;
        return (
          <Paper
            key={key}
            elevation={0}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            // A card that does nothing when tapped should not look tappable;
            // a card that does should be reachable from a keyboard too.
            role={onRowClick ? 'button' : undefined}
            tabIndex={onRowClick ? 0 : undefined}
            onKeyDown={onRowClick ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row); }
            } : undefined}
            className={`rounded-2xl border p-4 transition-colors ${
              picked ? 'border-slate-300 bg-slate-50' : 'border-slate-200/60 bg-white'
            } ${onRowClick ? 'cursor-pointer active:bg-slate-50' : ''}`}
          >
            <div className="flex items-start gap-3">
              {selection && (
                <div
                  // Ticking the box must not also open the row — picking twenty
                  // of them would otherwise open twenty screens.
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="-mt-1.5 -ml-1.5"
                >
                  <Checkbox size="small" checked={picked} onChange={() => selection.onToggle(key)} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                {title && (
                  <div className="text-sm font-bold text-slate-800 break-words">{title.render(row, index)}</div>
                )}
                {subtitle && (
                  <div className="text-xs text-slate-500 mt-0.5 break-words">{subtitle.render(row, index)}</div>
                )}
              </div>
            </div>

            {rest.length > 0 && (
              <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                {rest.map((col) => (
                  <div key={col.id} className="flex items-start justify-between gap-3">
                    {/* The label travels with the value. On a table the header
                        is metres away at the top of a scrolled page; here a
                        person can always tell what they are looking at. */}
                    <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400 shrink-0 pt-0.5">
                      {col.label}
                    </dt>
                    <dd className="text-sm text-slate-700 text-right min-w-0 break-words">
                      {col.render(row, index)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </Paper>
        );
      })}
    </div>
  );
}
