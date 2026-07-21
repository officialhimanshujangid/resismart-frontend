'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Paper, Chip } from '@mui/material';
import {
  ClipboardList, CalendarClock, ShieldCheck, ShieldAlert, Shield, Building2, Clock,
} from 'lucide-react';
import api from '@/lib/api';
import PageHeader from '@/components/common/PageHeader';
import PageSkeleton from '@/components/common/PageSkeleton';
import ErrorState from '@/components/common/ErrorState';
import EmptyState from '@/components/common/EmptyState';
import StatusChip from '@/components/common/StatusChip';

/**
 * A staff member's own screen.
 *
 * The failure this replaces: a `SOCIETY_EMPLOYEE` signing in landed on
 * `/dashboard`, which branches on `role.startsWith('SOCIETY_')` and therefore
 * gave a watchman the SOCIETY-ADMIN dashboard — subscription panel, billing
 * summary, plan card. Every one of those calls 403s for him, so the first thing
 * the product ever showed a guard was three empty boxes and nothing whatsoever
 * about his own work.
 *
 * So: what he is meant to be doing today, when he is meant to be here, and
 * whether his police verification is still good. Nothing else. There is no
 * salary here and no attendance — neither is this product's business — and no
 * link into anybody else's record, because he holds no permission to read one.
 */

interface Complaint {
  _id: string;
  ticketCode: string;
  title: string;
  status: string;
  priority?: string;
  flatLabel?: string;
  blockName?: string;
  resolutionDueAt?: string;
  firstResponseDueAt?: string;
}
interface MyWork {
  staff: { _id: string; staffCode: string; name: string; designation: string; joinedOn: string };
  complaints: Complaint[];
  assignments: { scope: string; blockName?: string; categories: string[]; rank: string }[];
  shifts: { weekday: number; from: string; to: string }[];
  awayToday: { kind: string; kindLabel: string; from: string; to: string } | null;
  onDutyNow: boolean;
  verification: { expiresOn?: string; state: 'NONE' | 'LAPSED' | 'EXPIRING' | 'VALID' };
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const pretty = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase());
const onDate = (s?: string) => (s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');

/**
 * How late, or how long left — in words rather than a timestamp.
 *
 * "Fix by 14/07/2026, 18:30" makes a reader do arithmetic. "2 days late" does
 * not, and the whole point of showing it is that somebody acts on it.
 */
const dueIn = (iso?: string): { text: string; late: boolean } | null => {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  const late = ms < 0;
  const hours = Math.round(Math.abs(ms) / 3_600_000);
  if (hours < 1) return { text: late ? 'just gone past' : 'within the hour', late };
  if (hours < 48) return { text: late ? `${hours} hours late` : `${hours} hours left`, late };
  const days = Math.round(hours / 24);
  return { text: late ? `${days} days late` : `${days} days left`, late };
};

export default function MyWorkPage() {
  const [data, setData] = useState<MyWork | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/staff/me/work');
      setData(res.data?.data || null);
    } catch (e: any) {
      // Never `return null` on a failure — a blank white page is
      // indistinguishable from a screen with nothing on it.
      setError(e.response?.data?.message || 'Your work could not be loaded just now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageSkeleton />;

  if (error || !data) {
    return (
      <div className="space-y-4 pb-24">
        <PageHeader
          breadcrumb="My work"
          title="My work"
          icon={<ClipboardList className="w-4.5 h-4.5" />}
        />
        <ErrorState
          message={error || 'Your work could not be loaded just now.'}
          hint="If you have just been added to the staff roll, ask the society office to confirm your record is active."
          onRetry={load}
        />
      </div>
    );
  }

  const today = new Date().getDay();
  const todayShifts = data.shifts.filter(s => s.weekday === today);
  const overdue = data.complaints.filter(c => c.resolutionDueAt && new Date(c.resolutionDueAt) < new Date());

  return (
    <div className="space-y-4 pb-24">
      <PageHeader
        breadcrumb="My work"
        title={`Hello, ${data.staff.name}`}
        icon={<ClipboardList className="w-4.5 h-4.5" />}
        subtitle={`${pretty(data.staff.designation)} · ${data.staff.staffCode}. Everything below is yours — the jobs waiting on you, the hours you are down for, and whether your police verification is still good.`}
      />

      {/* ------------------------------------------------- today, in one line */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Paper elevation={0} className="rounded-2xl border border-slate-200/70 p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Jobs with you</p>
          <p className="text-3xl font-black text-slate-800 mt-1 tabular-nums">{data.complaints.length}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            {overdue.length > 0 ? `${overdue.length} past the promised time` : 'None past the promised time'}
          </p>
        </Paper>

        <Paper elevation={0} className="rounded-2xl border border-slate-200/70 p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Right now</p>
          <p className="text-lg font-black text-slate-800 mt-2">
            {data.awayToday
              ? data.awayToday.kindLabel
              : data.onDutyNow ? 'On duty' : 'Off duty'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {data.awayToday
              ? `Recorded until ${onDate(data.awayToday.to)}`
              : data.shifts.length === 0
                ? 'No hours have been set for you, so work can reach you at any time.'
                : todayShifts.length
                  ? `Today: ${todayShifts.map(s => `${s.from}–${s.to}`).join(', ')}`
                  : 'You are not down for today.'}
          </p>
        </Paper>

        <VerificationCard state={data.verification.state} expiresOn={data.verification.expiresOn} />
      </div>

      {/* ------------------------------------------------------------- jobs */}
      <Paper elevation={0} className="rounded-2xl border border-slate-200/70 p-4">
        <div className="flex items-center gap-2 mb-3">
          <ClipboardList className="w-4 h-4 text-slate-500" />
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            Jobs waiting on you
          </span>
        </div>

        {data.complaints.length === 0 ? (
          <EmptyState
            compact
            title="Nothing is waiting on you"
            message="When a resident reports something in an area you look after, it appears here."
            icon={<ClipboardList className="w-6 h-6" />}
          />
        ) : (
          <div className="grid gap-2">
            {data.complaints.map(c => {
              const due = dueIn(c.resolutionDueAt);
              return (
                <div key={c._id} className="rounded-xl border border-slate-200 p-3 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-800 text-sm truncate">{c.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Complaint no. {c.ticketCode}
                      {c.flatLabel ? ` · ${c.flatLabel}` : c.blockName ? ` · ${c.blockName}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StatusChip status={c.status} />
                    {due && (
                      <span className={`text-[11px] font-semibold ${due.late ? 'text-rose-600' : 'text-slate-500'}`}>
                        {due.text}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Paper>

      {/* ------------------------------------------------------ where + when */}
      <div className="grid gap-3 md:grid-cols-2">
        <Paper elevation={0} className="rounded-2xl border border-slate-200/70 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-slate-500" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              What you look after
            </span>
          </div>
          {data.assignments.length === 0 ? (
            <p className="text-xs text-slate-500">
              Nothing has been given to you yet, so no complaint will be sent to you automatically.
              The society office sets this.
            </p>
          ) : (
            <div className="grid gap-1.5">
              {data.assignments.map((a, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl border border-slate-200 p-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 font-medium">
                      {a.scope === 'SOCIETY' ? 'Whole society' : a.blockName}
                      <Chip
                        size="small"
                        label={a.rank === 'PRIMARY' ? 'first call' : 'backup'}
                        sx={{
                          ml: 1, height: 18, fontSize: 10, fontWeight: 700,
                          ...(a.rank === 'PRIMARY'
                            ? { bgcolor: '#eef2ff', color: '#4338ca' }
                            : { bgcolor: '#f1f5f9', color: '#64748b' }),
                        }}
                      />
                    </p>
                    <p className="text-[11px] text-slate-500">{a.categories.map(pretty).join(', ')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Paper>

        <Paper elevation={0} className="rounded-2xl border border-slate-200/70 p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock className="w-4 h-4 text-slate-500" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Your hours
            </span>
          </div>
          {data.shifts.length === 0 ? (
            <p className="text-xs text-slate-500">
              No hours have been set for you. Work can reach you at any time until the office sets them.
            </p>
          ) : (
            <div className="grid gap-1">
              {DAYS.map((label, day) => {
                const mine = data.shifts.filter(s => s.weekday === day);
                return (
                  <div
                    key={day}
                    className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 ${day === today ? 'bg-slate-100' : ''}`}
                  >
                    <span className={`text-xs ${day === today ? 'font-bold text-slate-800' : 'text-slate-500'}`}>
                      {label}
                    </span>
                    <span className="text-xs text-slate-600 tabular-nums">
                      {mine.length
                        ? mine.map(s => `${s.from}–${s.to}`).join(', ')
                        : <span className="text-slate-300">—</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed flex items-start gap-1.5">
            <Clock className="w-3 h-3 shrink-0 mt-0.5" />
            These are the hours you are expected. Nothing here records whether you came in —
            this software keeps no attendance.
          </p>
        </Paper>
      </div>
    </div>
  );
}

/**
 * The police verification, said plainly.
 *
 * A lapsed check and a check that was never done are the same thing in
 * practice, and both are the person's own business to chase — so this is on
 * their screen, not only the committee's.
 */
function VerificationCard({ state, expiresOn }: { state: MyWork['verification']['state']; expiresOn?: string }) {
  const on = expiresOn ? new Date(expiresOn).toLocaleDateString('en-IN') : '';
  const look = {
    VALID: { icon: <ShieldCheck className="w-4 h-4" />, head: 'Police check is current', sub: `Good until ${on}.`, cls: 'text-emerald-700' },
    EXPIRING: { icon: <ShieldAlert className="w-4 h-4" />, head: 'Police check runs out soon', sub: `It ends on ${on}. Ask the office to start the renewal.`, cls: 'text-amber-700' },
    LAPSED: { icon: <ShieldAlert className="w-4 h-4" />, head: 'Police check has lapsed', sub: `It ended on ${on}. Ask the office to renew it.`, cls: 'text-rose-700' },
    NONE: { icon: <Shield className="w-4 h-4" />, head: 'No police check on file', sub: 'The society office has not recorded one for you.', cls: 'text-slate-500' },
  }[state];

  return (
    <Paper elevation={0} className="rounded-2xl border border-slate-200/70 p-4">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Police check</p>
      <p className={`text-sm font-black mt-2 flex items-center gap-1.5 ${look.cls}`}>
        {look.icon}{look.head}
      </p>
      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{look.sub}</p>
    </Paper>
  );
}
