'use client';

import React, { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { CircularProgress, TextField, Alert, Chip } from '@mui/material';
import {
  BarChart3, DoorOpen, MessageSquare, Users, Wrench, Star, AlertTriangle,
} from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import StatCard from '@/components/common/StatCard';
import EmptyState from '@/components/common/EmptyState';
import { DataTable, ColumnDef } from '@/components/common/DataTable';
import { useToastConfirm } from '@/context/ToastConfirmContext';

/**
 * How the gate and the complaints desk actually did, over a period.
 *
 * `GET /gate/report` shipped complete and no screen ever called it — the whole
 * report existed and was unreachable. It answers the questions a committee
 * asks at a monthly meeting and previously had to guess at: how many people
 * came in, how much of the exit log was a guess rather than a record, whether
 * the promised response times were met, who is carrying the work, and which
 * single machine keeps breaking.
 */

interface Report {
  from: string; to: string;
  gate: {
    entries: number;
    byCategory: { category: string; count: number }[];
    exitsRecorded: number;
    autoClosedGuesses: number;
    exitAccuracy: number | null;
  };
  complaints: {
    raised: number; resolved: number; stillOpen: number; reopened: number;
    avgFirstResponseMinutes: number | null;
    avgResolutionMinutes: number | null;
    firstResponseSlaMet: number | null; firstResponseMeasuredOn: number;
    slaMet: number | null; slaMeasuredOn: number;
    avgRating: number | null;
    byCategory: { category: string; raised: number; resolved: number; reopened: number }[];
    byStaff: { name: string; assigned: number; resolved: number; reopened: number }[];
    worstAssets: { assetId: string; faults: number; name: string; where?: string }[];
  };
  staffOnBooks: number;
}

const CATEGORY_LABEL: Record<string, string> = {
  GUEST: 'Guest', DELIVERY: 'Delivery', CAB: 'Cab', HOUSEHOLD_STAFF: 'Daily help',
  CONTRACTOR: 'Contractor', OTHER: 'Other', RESIDENT: 'Resident',
};

const duration = (mins: number | null) => {
  if (mins === null || mins === undefined) return '—';
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ${Math.round(mins % 60)}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function OperationsReportPage() {
  const { showToast } = useToastConfirm();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Report | null>(null);

  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  const [from, setFrom] = useState(iso(firstOfMonth));
  const [to, setTo] = useState(iso(new Date()));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/gate/report?from=${from}&to=${to}`);
      setData(res.data?.data || null);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not build that report', 'error');
    } finally { setLoading(false); }
  }, [from, to, showToast]);

  useEffect(() => { load(); }, [load]);

  const categoryColumns: ColumnDef<Report['complaints']['byCategory'][number]>[] = [
    { id: 'category', label: 'Kind', sortValue: r => r.category, exportValue: r => r.category,
      render: r => <span className="font-semibold text-slate-700 text-sm">{r.category}</span> },
    { id: 'raised', label: 'Raised', align: 'right', sortValue: r => r.raised, exportValue: r => r.raised,
      render: r => <span className="tabular-nums text-sm">{r.raised}</span> },
    { id: 'resolved', label: 'Resolved', align: 'right', sortValue: r => r.resolved, exportValue: r => r.resolved,
      render: r => <span className="tabular-nums text-sm text-emerald-700">{r.resolved}</span> },
    { id: 'reopened', label: 'Came back', align: 'right', sortValue: r => r.reopened, exportValue: r => r.reopened,
      render: r => <span className={`tabular-nums text-sm ${r.reopened ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>{r.reopened}</span> },
  ];

  const staffColumns: ColumnDef<Report['complaints']['byStaff'][number]>[] = [
    { id: 'name', label: 'Who', sortValue: r => r.name, exportValue: r => r.name,
      render: r => <span className="font-semibold text-slate-700 text-sm">{r.name}</span> },
    { id: 'assigned', label: 'Given', align: 'right', sortValue: r => r.assigned, exportValue: r => r.assigned,
      render: r => <span className="tabular-nums text-sm">{r.assigned}</span> },
    { id: 'resolved', label: 'Finished', align: 'right', sortValue: r => r.resolved, exportValue: r => r.resolved,
      render: r => <span className="tabular-nums text-sm text-emerald-700">{r.resolved}</span> },
    {
      id: 'reopened', label: 'Came back', align: 'right',
      // The number that matters more than "finished": work marked done that the
      // resident rejected. A high count here with a high finished count is
      // somebody closing tickets rather than fixing things.
      sortValue: r => r.reopened, exportValue: r => r.reopened,
      render: r => <span className={`tabular-nums text-sm ${r.reopened ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>{r.reopened}</span>,
    },
  ];

  const assetColumns: ColumnDef<Report['complaints']['worstAssets'][number]>[] = [
    {
      id: 'name', label: 'Equipment', sortValue: r => r.name, exportValue: r => r.name,
      render: r => (
        <div className="min-w-0">
          <p className="font-semibold text-slate-700 text-sm truncate">{r.name}</p>
          {r.where && <p className="text-[11px] text-slate-400">{r.where}</p>}
        </div>
      ),
    },
    { id: 'faults', label: 'Faults', align: 'right', sortValue: r => r.faults, exportValue: r => r.faults,
      render: r => <span className="tabular-nums text-sm font-bold text-slate-800">{r.faults}</span> },
  ];

  return (
    <div className="space-y-4 pb-24">
      <PageHeader
        breadcrumb="Operations"
        title="How things went"
        icon={<BarChart3 className="w-4.5 h-4.5" />}
        subtitle="The gate and the complaints desk over a period — the figures a committee is asked for at the monthly meeting."
        actions={
          <div className="flex items-center gap-2">
            <TextField size="small" type="date" label="From" value={from}
              onChange={e => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField size="small" type="date" label="To" value={to}
              onChange={e => setTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center py-24"><CircularProgress /></div>
      ) : !data ? (
        <EmptyState title="Nothing to report" message="No gate entries or complaints in that period." />
      ) : (
        <>
          {/* --------------------------------------------------------- gate */}
          <div className="space-y-3">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">The gate</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="People in" value={data.gate.entries} icon={<DoorOpen className="w-5 h-5" />} tone="blue" />
              <StatCard label="Exits recorded" value={data.gate.exitsRecorded} icon={<DoorOpen className="w-5 h-5" />} tone="violet" />
              <StatCard label="Closed off by guess" value={data.gate.autoClosedGuesses}
                icon={<AlertTriangle className="w-5 h-5" />}
                tone={data.gate.autoClosedGuesses ? 'amber' : 'slate'}
                sub="never marked out by anyone" />
              <StatCard label="Exit log accuracy"
                value={data.gate.exitAccuracy === null ? '—' : `${data.gate.exitAccuracy}%`}
                icon={<DoorOpen className="w-5 h-5" />}
                tone={(data.gate.exitAccuracy ?? 100) < 70 ? 'rose' : 'emerald'}
                sub="genuinely recorded, not assumed" />
            </div>

            {data.gate.exitAccuracy !== null && data.gate.exitAccuracy < 70 && (
              <Alert severity="warning" className="!rounded-2xl !text-sm">
                Under a third of departures were actually recorded — the rest were closed off at
                the end of the day as a guess. &ldquo;Who is inside&rdquo; cannot be trusted at
                that rate. Either the guard needs a reminder, or the society should switch to
                arrivals-only in Operations Settings and stop pretending to know.
              </Alert>
            )}

            {data.gate.byCategory.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {data.gate.byCategory.map(c => (
                  <Chip key={c.category} size="small"
                    label={`${CATEGORY_LABEL[c.category] || c.category} · ${c.count}`}
                    className="!bg-slate-100 !text-slate-600 !font-semibold !text-[11px]" />
                ))}
              </div>
            )}
          </div>

          {/* --------------------------------------------------- complaints */}
          <div className="space-y-3 pt-2">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Complaints</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Raised" value={data.complaints.raised} icon={<MessageSquare className="w-5 h-5" />} tone="blue" />
              <StatCard label="Resolved" value={data.complaints.resolved} icon={<MessageSquare className="w-5 h-5" />} tone="emerald" />
              <StatCard label="Still open" value={data.complaints.stillOpen} icon={<MessageSquare className="w-5 h-5" />}
                tone={data.complaints.stillOpen ? 'amber' : 'slate'} />
              <StatCard label="Came back" value={data.complaints.reopened} icon={<AlertTriangle className="w-5 h-5" />}
                tone={data.complaints.reopened ? 'rose' : 'slate'}
                sub="marked done, rejected" />
            </div>

            {/* Two promises, measured separately on purpose — the complaint
                everybody remembers is the one nobody replied to; the one that
                costs money is the one answered fast and never fixed. */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="First reply, on time"
                value={data.complaints.firstResponseSlaMet === null ? '—' : `${data.complaints.firstResponseSlaMet}%`}
                icon={<MessageSquare className="w-5 h-5" />}
                tone={(data.complaints.firstResponseSlaMet ?? 100) < 80 ? 'amber' : 'emerald'}
                sub={`measured on ${data.complaints.firstResponseMeasuredOn}`} />
              <StatCard label="Fixed on time"
                value={data.complaints.slaMet === null ? '—' : `${data.complaints.slaMet}%`}
                icon={<MessageSquare className="w-5 h-5" />}
                tone={(data.complaints.slaMet ?? 100) < 80 ? 'amber' : 'emerald'}
                sub={`measured on ${data.complaints.slaMeasuredOn}`} />
              <StatCard label="Average first reply" value={duration(data.complaints.avgFirstResponseMinutes)}
                icon={<MessageSquare className="w-5 h-5" />} tone="slate" />
              <StatCard label="Average fix" value={duration(data.complaints.avgResolutionMinutes)}
                icon={<Wrench className="w-5 h-5" />} tone="slate" />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="What people scored it"
                value={data.complaints.avgRating === null ? '—' : `${data.complaints.avgRating}/5`}
                icon={<Star className="w-5 h-5" />}
                tone={(data.complaints.avgRating ?? 5) < 3 ? 'rose' : 'emerald'} />
              <StatCard label="On the staff roll" value={data.staffOnBooks}
                icon={<Users className="w-5 h-5" />} tone="slate" />
            </div>
          </div>

          {data.complaints.byCategory.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">By kind of work</p>
              <DataTable columns={categoryColumns} data={data.complaints.byCategory}
                keyExtractor={r => r.category} exportFileName="complaints-by-category" />
            </div>
          )}

          {data.complaints.byStaff.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Who did the work</p>
              <DataTable columns={staffColumns} data={data.complaints.byStaff}
                keyExtractor={r => r.name} exportFileName="complaints-by-staff" />
            </div>
          )}

          {data.complaints.worstAssets.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                What keeps breaking
              </p>
              <DataTable columns={assetColumns} data={data.complaints.worstAssets}
                keyExtractor={r => r.assetId} exportFileName="equipment-faults" />
              <p className="text-[11px] text-slate-400">
                One machine with five faults in a month is the sentence worth reading out at the
                AMC renewal.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
