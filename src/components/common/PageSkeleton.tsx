'use client';

import React from 'react';
import { CircularProgress } from '@mui/material';

/**
 * Waiting, said once.
 *
 * The same centred `CircularProgress` block was pasted into fifteen screens,
 * each with its own padding, so the page jumped by a different amount on every
 * one of them the moment the data landed. One component, one height.
 *
 * `rows` renders grey bars in the shape of a list instead of a spinner, which
 * is worth using wherever the answer is a table — a person reads the shape of
 * the page before they read anything in it.
 */
export default function PageSkeleton({ rows, label }: { rows?: number; label?: string }) {
  if (rows) {
    return (
      <div className="space-y-2 py-2" role="status" aria-label={label || 'Loading'}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-14 rounded-2xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24" role="status" aria-label={label || 'Loading'}>
      <CircularProgress size={28} />
      {label && <p className="text-sm font-semibold text-slate-400">{label}</p>}
    </div>
  );
}
