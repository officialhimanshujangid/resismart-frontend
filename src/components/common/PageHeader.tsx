'use client';

import React, { ReactNode } from 'react';

/**
 * The top of every screen.
 *
 * Each page had grown its own heading — different sizes, some with a subtitle
 * explaining what the screen is for and most without, the action button
 * sometimes left, sometimes right, sometimes below the fold. The review's
 * blunt version of this: a person opens a page and cannot tell what it does.
 *
 * One heading, one sentence saying what this screen is FOR in plain words, and
 * the actions where the eye already expects them.
 */
export default function PageHeader({
  title, subtitle, actions, icon, breadcrumb,
}: {
  title: string;
  /** Plain language, for a committee member — not a restatement of the title. */
  subtitle?: string;
  actions?: ReactNode;
  icon?: ReactNode;
  /** e.g. "Operations · Gate" — where this sits, when the sidebar is collapsed. */
  breadcrumb?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        {breadcrumb && (
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">{breadcrumb}</p>
        )}
        <div className="flex items-center gap-2.5">
          {icon && (
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
              {icon}
            </div>
          )}
          <h1 className="text-xl font-black text-slate-900 tracking-tight">{title}</h1>
        </div>
        {subtitle && <p className="text-sm text-slate-600 mt-1.5 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>}
    </div>
  );
}
