'use client';

import React, { ReactNode } from 'react';
import { Paper, Button } from '@mui/material';
import { Inbox } from 'lucide-react';

/**
 * Nothing here yet — said usefully.
 *
 * An empty screen is the first thing a new society sees on every single page,
 * and until now most of them said "No records found." That tells somebody
 * setting up a society precisely nothing about what to do next. An empty state
 * should name the thing, say why it is empty, and offer the one action that
 * fills it.
 */
export default function EmptyState({
  title, message, icon, action, compact,
}: {
  title: string;
  message?: string;
  icon?: ReactNode;
  action?: { label: string; onClick: () => void; icon?: ReactNode };
  compact?: boolean;
}) {
  return (
    <Paper elevation={0}
      className={`rounded-2xl border border-slate-200/70 text-center ${compact ? 'p-6' : 'p-12'}`}>
      <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-center text-slate-400 mx-auto">
        {icon || <Inbox className="w-6 h-6" />}
      </div>
      <p className="mt-3 font-bold text-slate-700">{title}</p>
      {message && <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">{message}</p>}
      {action && (
        <Button variant="contained" size="small" startIcon={action.icon} onClick={action.onClick}
          className="!rounded-xl !normal-case !font-bold !mt-4">
          {action.label}
        </Button>
      )}
    </Paper>
  );
}
