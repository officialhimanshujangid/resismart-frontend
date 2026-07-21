'use client';

import React, { ReactNode } from 'react';

/**
 * The label above a group of things on a long page.
 *
 * Every screen that needed one wrote the same eight Tailwind classes by hand,
 * so the tracking and the grey drifted apart page by page. It is a small thing
 * and it is exactly the sort of small thing that reads as "unfinished".
 */
export default function SectionHeading({
  children, hint, actions,
}: {
  children: ReactNode;
  /** One sentence under the label, when the group needs explaining. */
  hint?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{children}</p>
        {hint && <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">{hint}</p>}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  );
}
