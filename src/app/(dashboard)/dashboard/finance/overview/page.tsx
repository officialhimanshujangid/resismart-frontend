'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Paper, CircularProgress, Button } from '@mui/material';
import { Landmark, PiggyBank, TrendingUp, AlertTriangle, ArrowRight, Inbox, CheckCircle2, Circle } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

const rupees = (p?: number) => `₹${((p || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

interface Dash {
  financialYear: string;
  cashAndBankPaise: number;
  fundsPaise: number;
  outstandingPaise: number;
  aging: { current: number; d31_60: number; d61_90: number; d90plus: number };
  billedPaise: number;
  collectedPaise: number;
  collectionEfficiencyPercent: number | null;
  thisMonth: { billedPaise: number; collectedPaise: number };
  pending: { receipts: number; expenses: number };
  topDefaulters: { flat: string; ownerName?: string; outstandingPaise: number; over90Paise: number }[];
  setup: { chargeHeads: number; funds: number; openingPosted: boolean; invoicesGenerated: number; paymentsConfigured: boolean; modules: string[] };
}

const Tile = ({ icon, label, value, tone = 'text-slate-800' }: { icon: React.ReactNode; label: string; value: string; tone?: string }) => (
  <Paper elevation={0} className="p-4 rounded-2xl border border-slate-200/60 flex items-center gap-3">
    <div className="p-2.5 rounded-xl bg-slate-50">{icon}</div>
    <div className="min-w-0">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-lg font-black truncate ${tone}`}>{value}</p>
    </div>
  </Paper>
);

export default function FinanceOverviewPage() {
  const { showToast } = useToastConfirm();
  const [d, setD] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { const res = await api.get('/finance/society/dashboard'); setD(res.data); }
      catch (e: any) { showToast(e.response?.data?.error || 'Failed to load the finance overview', 'error'); }
      finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="flex justify-center p-12"><CircularProgress size={32} /></div>;
  if (!d) return <div className="text-center py-16 text-slate-400 font-semibold text-sm">Finance overview is unavailable right now.</div>;

  // Only steps that apply. A society that keeps no funds and starts fresh should
  // reach "all done", not be nagged forever about work it chose not to do.
  const uses = (m: string) => d.setup.modules?.includes(m);
  const steps = [
    { label: 'Set your billing rules', hint: 'Financial year, due days, interest on late payment', href: '/dashboard/finance/settings', done: true, show: true },
    { label: 'Create your charge heads', hint: 'The things you bill for — maintenance, water, parking', href: '/dashboard/finance/charge-heads', done: d.setup.chargeHeads > 0, show: true },
    { label: 'Set up your funds', hint: 'Corpus, sinking, repair — then point a charge head at each to collect into it', href: '/dashboard/finance/funds', done: d.setup.funds > 0, show: uses('FUNDS') },
    { label: 'Enter your opening balances', hint: 'What the society already held and was owed on day one', href: '/dashboard/finance/opening-balances', done: d.setup.openingPosted, show: uses('ACCOUNTING') },
    { label: 'Choose how members pay you', hint: 'UPI ID, or a payment gateway', href: '/dashboard/finance/settlement', done: d.setup.paymentsConfigured, show: true },
    { label: 'Raise your first bills', hint: 'Preview first — nothing is posted until you confirm', href: '/dashboard/finance/invoices', done: d.setup.invoicesGenerated > 0, show: true },
  ].filter(s => s.show);

  const eff = d.collectionEfficiencyPercent;
  const effTone = eff === null ? 'text-slate-400' : eff >= 90 ? 'text-emerald-600' : eff >= 70 ? 'text-amber-600' : 'text-red-600';
  const agingTotal = d.aging.current + d.aging.d31_60 + d.aging.d61_90 + d.aging.d90plus;
  const pct = (v: number) => (agingTotal > 0 ? (v / agingTotal) * 100 : 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Finance Overview</h1>
        <p className="text-sm text-slate-500 mt-0.5">Where the society stands in FY {d.financialYear}</p>
      </div>

      {/* Shown until the society is actually set up. A checklist rather than a
          wizard: onboarding happens in fits and starts, and someone who abandons
          a wizard halfway has no way back into it. */}
      {steps.filter(s => !s.done).length > 0 && (
        <Paper elevation={0} className="p-5 rounded-2xl border border-blue-200 bg-blue-50/40">
          <p className="font-black text-blue-900 text-sm">Finish setting up your finances</p>
          <p className="text-xs text-blue-800/80 mt-0.5 mb-3">
            {steps.filter(s => s.done).length} of {steps.length} done — work through these in order and billing will run itself.
          </p>
          <div className="space-y-2">
            {steps.map(s => (
              <Link key={s.label} href={s.href} className="flex items-start gap-2.5 group">
                {s.done
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  : <Circle className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />}
                <div className="min-w-0">
                  <p className={`text-sm font-bold ${s.done ? 'text-slate-400 line-through' : 'text-blue-900 group-hover:underline'}`}>{s.label}</p>
                  {!s.done && <p className="text-xs text-blue-800/70">{s.hint}</p>}
                </div>
              </Link>
            ))}
          </div>
        </Paper>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile icon={<Landmark className="w-5 h-5 text-blue-600" />} label="Cash & bank" value={rupees(d.cashAndBankPaise)} />
        <Tile icon={<AlertTriangle className="w-5 h-5 text-amber-600" />} label="Outstanding dues" value={rupees(d.outstandingPaise)} tone="text-amber-700" />
        <Tile icon={<PiggyBank className="w-5 h-5 text-emerald-600" />} label="Reserves in funds" value={rupees(d.fundsPaise)} />
        <Tile icon={<TrendingUp className={`w-5 h-5 ${effTone}`} />} label="Collected this year"
          value={eff === null ? 'Nothing billed yet' : `${eff}%`} tone={effTone} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* The one number a committee asks about every month. */}
        <Paper elevation={0} className="p-5 rounded-2xl border border-slate-200/60">
          <p className="font-black text-slate-800 text-sm">Billed vs collected</p>
          <p className="text-xs text-slate-500 mt-0.5 mb-4">FY {d.financialYear} to date</p>
          <div className="space-y-3">
            {([['Billed', d.billedPaise, 'bg-slate-300'], ['Collected', d.collectedPaise, 'bg-emerald-500']] as const).map(([l, v, c]) => (
              <div key={l}>
                <div className="flex justify-between text-xs mb-1"><span className="text-slate-500 font-semibold">{l}</span><span className="font-black text-slate-800">{rupees(v)}</span></div>
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${c} rounded-full`} style={{ width: `${d.billedPaise > 0 ? Math.min(100, (v / d.billedPaise) * 100) : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-slate-500">Billed this month</p><p className="font-black text-slate-800">{rupees(d.thisMonth.billedPaise)}</p></div>
            <div><p className="text-xs text-slate-500">Collected this month</p><p className="font-black text-emerald-700">{rupees(d.thisMonth.collectedPaise)}</p></div>
          </div>
        </Paper>

        <Paper elevation={0} className="p-5 rounded-2xl border border-slate-200/60">
          <p className="font-black text-slate-800 text-sm">How old the dues are</p>
          <p className="text-xs text-slate-500 mt-0.5 mb-4">Anything past 90 days is where recovery starts</p>
          {agingTotal === 0 ? (
            <div className="text-center py-8 text-emerald-600 font-bold text-sm">Nothing outstanding — every bill is paid.</div>
          ) : (<>
            <div className="flex h-3 w-full rounded-full overflow-hidden mb-4">
              <div className="bg-slate-300" style={{ width: `${pct(d.aging.current)}%` }} />
              <div className="bg-amber-400" style={{ width: `${pct(d.aging.d31_60)}%` }} />
              <div className="bg-orange-500" style={{ width: `${pct(d.aging.d61_90)}%` }} />
              <div className="bg-red-500" style={{ width: `${pct(d.aging.d90plus)}%` }} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {([['Not due / ≤30 days', d.aging.current, 'bg-slate-300'], ['31–60 days', d.aging.d31_60, 'bg-amber-400'],
                ['61–90 days', d.aging.d61_90, 'bg-orange-500'], ['Over 90 days', d.aging.d90plus, 'bg-red-500']] as const).map(([l, v, c]) => (
                <div key={l} className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${c} shrink-0`} />
                  <span className="text-slate-500">{l}</span>
                  <span className="font-bold text-slate-700 ml-auto">{rupees(v)}</span>
                </div>
              ))}
            </div>
          </>)}
          <Link href="/dashboard/finance/reports"><Button size="small" endIcon={<ArrowRight className="w-4 h-4" />} className="mt-4 font-bold">Open the defaulter register</Button></Link>
        </Paper>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {(d.pending.receipts > 0 || d.pending.expenses > 0) && (
          <Paper elevation={0} className="p-5 rounded-2xl border border-amber-200 bg-amber-50/40">
            <div className="flex items-center gap-2 mb-3"><Inbox className="w-4 h-4 text-amber-600" /><p className="font-black text-amber-800 text-sm">Waiting on you</p></div>
            <div className="space-y-2">
              {d.pending.receipts > 0 && (
                <Link href="/dashboard/finance/confirmations" className="flex items-center justify-between text-sm hover:underline">
                  <span className="text-amber-900">{d.pending.receipts} payment{d.pending.receipts === 1 ? '' : 's'} reported by residents, awaiting confirmation</span>
                  <ArrowRight className="w-4 h-4 text-amber-600 shrink-0" />
                </Link>
              )}
              {d.pending.expenses > 0 && (
                <Link href="/dashboard/finance/expenses" className="flex items-center justify-between text-sm hover:underline">
                  <span className="text-amber-900">{d.pending.expenses} expense{d.pending.expenses === 1 ? '' : 's'} awaiting approval</span>
                  <ArrowRight className="w-4 h-4 text-amber-600 shrink-0" />
                </Link>
              )}
            </div>
          </Paper>
        )}

        <Paper elevation={0} className="p-5 rounded-2xl border border-slate-200/60">
          <p className="font-black text-slate-800 text-sm mb-3">Largest outstanding</p>
          {d.topDefaulters.length === 0 ? (
            <p className="text-sm text-slate-400 font-semibold py-4 text-center">Nobody owes anything.</p>
          ) : (
            <div className="space-y-2">
              {d.topDefaulters.map(t => (
                <div key={t.flat} className="flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-700 truncate">{t.flat}</p>
                    {t.ownerName && <p className="text-xs text-slate-400 truncate">{t.ownerName}</p>}
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="font-black text-slate-800">{rupees(t.outstandingPaise)}</p>
                    {t.over90Paise > 0 && <p className="text-[11px] font-bold text-red-600">{rupees(t.over90Paise)} over 90 days</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Paper>
      </div>
    </div>
  );
}
