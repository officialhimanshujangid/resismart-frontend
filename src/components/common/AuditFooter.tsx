'use client';

import React from 'react';
import { Clock, UserRound } from 'lucide-react';

/**
 * Who made this record, and who touched it last.
 *
 * Every model in this system carries createdBy/createdByName/updatedBy/
 * updatedByName alongside the timestamps, and until now almost none of that
 * reached a screen. In a housing society that matters more than it does in most
 * software: the committee changes every year, decisions are questioned at the
 * AGM, and "who added this charge / retired this gate / closed this complaint"
 * is a question somebody WILL ask. The data was always there; this is the view.
 *
 * Drop it at the bottom of any detail dialog or drawer.
 */

export interface AuditFields {
  createdByName?: string;
  updatedByName?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

const when = (v?: string | Date) => {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

export default function AuditFooter({ record, className = '' }: { record?: AuditFields | null; className?: string }) {
  if (!record) return null;
  const created = when(record.createdAt);
  const updated = when(record.updatedAt);
  if (!created && !updated && !record.createdByName) return null;

  // Only show "last changed" when it is genuinely a later change. Mongoose sets
  // updatedAt equal to createdAt on insert, and repeating the same line twice
  // reads like the record was edited when it never was.
  const changed = updated && created && updated !== created;

  return (
    <div className={`border-t border-slate-100 pt-2.5 mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-400 ${className}`}>
      {created && (
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Added {created}
          {record.createdByName && <> by <span className="font-semibold text-slate-500">{record.createdByName}</span></>}
        </span>
      )}
      {changed && (
        <span className="flex items-center gap-1">
          <UserRound className="w-3 h-3" />
          Last changed {updated}
          {record.updatedByName && <> by <span className="font-semibold text-slate-500">{record.updatedByName}</span></>}
        </span>
      )}
    </div>
  );
}
