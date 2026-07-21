'use client';

import React, { ReactNode } from 'react';
import { Paper } from '@mui/material';

/**
 * A group of settings, and one setting inside it.
 *
 * Both of these were written inside `gate/settings/page.tsx` as local
 * `Card` / `Row` functions, so the only screen in the product with a decent
 * settings layout was also the only screen that could ever have it. Every other
 * settings page grew its own flex row with its own gap.
 *
 * The shape encodes the rule that matters: a setting is a SENTENCE plus a
 * control, never a bare label. `hint` is not optional decoration — a committee
 * member deciding whether to record residents' movements needs the sentence
 * more than they need the switch.
 */

export function SettingsCard({
  icon, title, description, children, footer,
}: {
  icon?: ReactNode;
  title: string;
  /** What this whole group is for, in one line. */
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Paper elevation={0} className="rounded-2xl border border-slate-200/70 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2.5">
        {icon && <div className="p-1.5 rounded-lg bg-white border border-slate-200">{icon}</div>}
        <p className="font-bold text-slate-800 text-sm">{title}</p>
      </div>
      {description && (
        <p className="px-4 pt-3 text-[11px] text-slate-500 leading-relaxed">{description}</p>
      )}
      <div className="px-4 py-2">{children}</div>
      {footer && <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/40">{footer}</div>}
    </Paper>
  );
}

export function SettingRow({
  title, hint, children, disabled,
}: {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
  /** Greys the words too, so a control that cannot be used does not look broken. */
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 py-2.5 border-b border-slate-100 last:border-0 ${disabled ? 'opacity-55' : ''}`}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-700">{title}</p>
        {hint && <p className="text-[11px] text-slate-500 leading-relaxed">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default SettingsCard;
