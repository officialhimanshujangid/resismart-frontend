'use client';

import React, { ReactNode } from 'react';
import { Paper, Button } from '@mui/material';
import { TriangleAlert, RotateCcw } from 'lucide-react';

/**
 * When the screen could not load.
 *
 * Three pages used to `return null` here, which renders a blank white page —
 * indistinguishable from a screen that has nothing on it, so the reader waits,
 * reloads, and eventually decides the software is broken. It is, but they
 * should not have to guess that.
 *
 * Per Appendix A rule 3, an error says what to do next. `onRetry` is the usual
 * next thing; `hint` is for the times it is not (no permission, ask the office).
 */
export default function ErrorState({
  title = 'This screen could not load',
  message,
  hint,
  onRetry,
  icon,
}: {
  title?: string;
  message?: string;
  /** What to do when retrying will not help — who to ask, what to switch on. */
  hint?: ReactNode;
  onRetry?: () => void;
  icon?: ReactNode;
}) {
  return (
    <Paper elevation={0} className="rounded-2xl border border-amber-200 bg-amber-50/50 p-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white border border-amber-200 flex items-center justify-center text-amber-600 mx-auto">
        {icon || <TriangleAlert className="w-6 h-6" />}
      </div>
      <p className="mt-3 font-bold text-slate-800">{title}</p>
      {message && <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto leading-relaxed">{message}</p>}
      {hint && <p className="text-xs text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">{hint}</p>}
      {onRetry && (
        <Button variant="contained" size="small" onClick={onRetry}
          startIcon={<RotateCcw className="w-3.5 h-3.5" />} className="mt-4">
          Try again
        </Button>
      )}
    </Paper>
  );
}
