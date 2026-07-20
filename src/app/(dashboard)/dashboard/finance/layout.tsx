'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Button, CircularProgress } from '@mui/material';
import { Lock, ArrowRight } from 'lucide-react';

/**
 * Holds the finance screens shut until the society has said where its books
 * start — and, more importantly, says why.
 *
 * A blur with a padlock and no explanation is worse than no gate at all: the
 * treasurer cannot tell a missing permission from a broken page from a
 * deliberate step, so they file a bug. The copy below names the reason and the
 * consequence, and the button goes straight to the one screen that fixes it.
 *
 * Reads are not blocked server-side (see `finance-setup.middleware`), so this
 * is a signpost rather than the security boundary. The boundary is the API.
 */

/**
 * Reachable while setup is unanswered.
 *
 * `vendors` is here because the setup screen tells you to add vendors before
 * you can enter what you owe them — without it that button lands on a locked
 * page whose only way out is back to setup. A closed loop.
 *
 * `my-bills` is the RESIDENT's own bills page, which happens to live under this
 * segment. A resident is not admin or committee, so the status call 403s and
 * the catch below lets them through — but relying on an error path to keep
 * residents out of a lockout is not a design, it is a coincidence.
 */
const OPEN_PATHS = [
  '/dashboard/finance/setup',
  '/dashboard/finance/settings',
  '/dashboard/finance/bulk-import',
  '/dashboard/finance/vendors',
  '/dashboard/finance/chart-of-accounts',
  '/dashboard/finance/my-bills',
];

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<{ complete: boolean } | null>(null);

  // Once per mount, not per navigation. Whether a society has stated its
  // opening position changes at most once in its life; re-asking on every click
  // between finance screens costs a five-query round trip to learn nothing.
  // The layout instance survives navigation within the segment, and the setup
  // page pushes to /overview on success, which remounts this.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get('/finance/society/setup');
        if (alive) setState({ complete: Boolean(res.data?.data?.complete) });
      } catch {
        // Never let a failed status check become a lockout — the API is the
        // real gate and it will refuse writes on its own if setup is pending.
        if (alive) setState({ complete: true });
      }
    })();
    return () => { alive = false; };
  }, []);

  if (!state) {
    return (
      <div className="flex items-center justify-center py-24">
        <CircularProgress size={28} />
      </div>
    );
  }

  const isOpenPath = OPEN_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`));
  if (state.complete || isOpenPath) return <>{children}</>;

  return (
    <div className="relative">
      {/* A dimmed placeholder, NOT the real page.
          Rendering the live children would run every locked screen's data
          fetches behind the blur — requests the API then 403s, and any error
          toast those pages raise pops over this card, producing exactly the
          "is it broken or deliberate?" confusion this gate exists to prevent.

          `inert` rather than `aria-hidden`: pointer-events-none does not remove
          anything from the tab order, so a keyboard user would tab off the
          button below into invisible controls inside a hidden subtree. */}
      <div className="select-none blur-sm opacity-30 space-y-4 p-4" inert>
        <div className="h-8 w-1/3 rounded-lg bg-slate-200" />
        <div className="h-32 rounded-2xl bg-slate-200" />
        <div className="h-64 rounded-2xl bg-slate-200" />
      </div>

      <div className="absolute inset-0 flex items-start justify-center pt-16 px-4">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white shadow-xl p-6 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
            <Lock className="w-5 h-5 text-amber-600" />
          </div>
          <h2 className="mt-4 font-bold text-slate-900">Opening balances are not set yet</h2>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            Until the society says what it already owned, owed and held, nothing can be billed
            or recorded — otherwise the balance sheet is wrong from the first day.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            If the society is starting fresh, this takes one click.
          </p>
          <Button
            variant="contained"
            endIcon={<ArrowRight className="w-4 h-4" />}
            className="!mt-5 !rounded-xl !normal-case !font-bold"
            onClick={() => router.push('/dashboard/finance/setup')}
          >
            Complete finance setup
          </Button>
        </div>
      </div>
    </div>
  );
}
