'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  Paper, TextField, FormControl, Select, MenuItem, IconButton,
} from '@mui/material';
import { Search, AlertTriangle, ShieldCheck, ScrollText, X } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { DataTable, ColumnDef } from '@/components/common/DataTable';
import PageHeader from '@/components/common/PageHeader';
import StatusChip from '@/components/common/StatusChip';
import useUrlState from '@/lib/use-url-state';

/**
 * Who came and went.
 *
 * Serves two very different readers from one screen and one endpoint: a
 * committee member seeing everything, and a resident seeing only their own
 * flat. The clamp is applied server-side — this page does not decide, it just
 * renders whatever it is allowed to have.
 */

interface Row {
  _id: string;
  entryCode: string;
  category: string;
  visitorName: string;
  visitorPhone?: string;
  flatLabel?: string;
  vehicleNumber?: string;
  status: string;
  enteredAt: string;
  exitedAt?: string;
  exitSource?: string;
  isEstimated: boolean;
  guardName: string;
}

interface Reconciliation {
  date: string;
  entries: number;
  exitsRecorded: number;
  estimated: number;
  accuracy: number | null;
}

const CATEGORY_LABEL: Record<string, string> = {
  GUEST: 'Guest', DELIVERY: 'Delivery', CAB: 'Cab',
  HOUSEHOLD_STAFF: 'Daily help', CONTRACTOR: 'Contractor', OTHER: 'Other',
};

const when = (iso?: string) => iso
  ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '—';

const DEFAULTS = { page: '1', pageSize: '25', q: '', category: '' };

function VisitorLog() {
  const { showToast } = useToastConfirm();
  const url = useUrlState(DEFAULTS);

  // Everything the reader can change lives in the URL, so a filtered view
  // survives a reload and can be pasted to somebody else.
  const page = Math.max(0, parseInt(url.get('page'), 10) - 1);
  const pageSize = parseInt(url.get('pageSize'), 10);
  const appliedQ = url.get('q');
  const category = url.get('category');

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [recon, setRecon] = useState<Reconciliation | null>(null);

  // What is in the box right now, which is not yet what is being searched for.
  const [draftQ, setDraftQ] = useState(appliedQ);

  /**
   * Debounced, because it was not.
   *
   * Typing "Ramesh" fired six requests, each one a full paginated query, and
   * the answers could arrive out of order — so the list sometimes settled on
   * the results for "Rame". The gate desk already did this correctly for its
   * plate lookup; this is the same 250-300ms wait.
   */
  useEffect(() => {
    if (draftQ === appliedQ) return;
    const t = setTimeout(() => url.set({ q: draftQ, page: '1' }), 300);
    return () => clearTimeout(t);
  }, [draftQ, appliedQ, url]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page + 1), pageSize: String(pageSize) });
      if (appliedQ.trim()) params.set('q', appliedQ.trim());
      if (category) params.set('category', category);
      const res = await api.get(`/visitors/entries?${params}`);
      setRows(res.data?.rows || []);
      setTotal(res.data?.pagination?.total || 0);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not load the visitor log', 'error');
    } finally { setLoading(false); }
  }, [page, pageSize, appliedQ, category, showToast]);

  useEffect(() => { load(); }, [load]);

  // Committee-only; a resident's request 403s and the card simply does not show.
  useEffect(() => {
    api.get('/visitors/reconciliation')
      .then(r => setRecon(r.data?.data))
      .catch(() => setRecon(null));
  }, []);

  const columns: ColumnDef<Row>[] = [
    {
      id: 'code', label: '#', alwaysVisible: true,
      sortValue: r => r.entryCode, exportValue: r => r.entryCode,
      render: r => <span className="text-xs text-slate-400">{r.entryCode}</span>,
    },
    {
      id: 'visitor', label: 'Visitor', alwaysVisible: true,
      sortValue: r => r.visitorName, exportValue: r => r.visitorName,
      render: r => (
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{r.visitorName}</p>
          {r.vehicleNumber && <p className="text-[11px] text-slate-400 font-mono">{r.vehicleNumber}</p>}
        </div>
      ),
    },
    {
      id: 'category', label: 'Kind',
      sortValue: r => CATEGORY_LABEL[r.category] || r.category,
      exportValue: r => CATEGORY_LABEL[r.category] || r.category,
      render: r => <span className="text-xs text-slate-600">{CATEGORY_LABEL[r.category] || r.category}</span>,
    },
    {
      id: 'flat', label: 'Going to',
      sortValue: r => r.flatLabel || '', exportValue: r => r.flatLabel || '',
      render: r => <span className="text-xs text-slate-600">{r.flatLabel || '—'}</span>,
    },
    {
      id: 'in', label: 'In',
      sortValue: r => r.enteredAt, exportValue: r => when(r.enteredAt),
      render: r => <span className="text-xs text-slate-600">{when(r.enteredAt)}</span>,
    },
    {
      id: 'out', label: 'Out',
      sortValue: r => r.exitedAt || '', exportValue: r => r.exitedAt ? when(r.exitedAt) : 'still inside',
      render: r => r.status === 'INSIDE'
        ? <StatusChip status="INSIDE" />
        : (
          <span className="text-xs text-slate-600">
            {when(r.exitedAt)}
            {r.isEstimated && (
              <span className="ml-1.5 inline-block align-middle">
                <StatusChip status="ASSUMED" label="assumed" tone="warn"
                  title="Nobody marked this visitor as gone; the day was closed off automatically." />
              </span>
            )}
          </span>
        ),
    },
    {
      id: 'guard', label: 'Logged by', defaultHidden: true,
      sortValue: r => r.guardName, exportValue: r => r.guardName,
      render: r => <span className="text-xs text-slate-500">{r.guardName}</span>,
    },
  ];

  return (
    <div className="space-y-4 pb-24">
      <PageHeader
        breadcrumb="Visitor Management"
        title="Visitor log"
        icon={<ScrollText className="w-4.5 h-4.5" />}
        subtitle="Who came, who went, and who nobody saw leave."
      />

      {/* --------------------------------------------------- yesterday's truth */}
      {recon && recon.accuracy !== null && (
        <Paper elevation={0} className={`rounded-2xl border p-4 ${recon.accuracy >= 90 ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-300 bg-amber-50/60'}`}>
          <div className="flex items-start gap-3">
            {recon.accuracy >= 90
              ? <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              : <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />}
            <div className="flex-1">
              <p className="font-bold text-slate-800 text-sm">
                {new Date(recon.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
                {' — '}{recon.entries} entries, {recon.exitsRecorded} departures recorded ({recon.accuracy}%)
              </p>
              {recon.estimated > 0 && (
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  <strong>{recon.estimated}</strong> were closed off automatically at the end of the day because
                  nobody marked them as gone. Those are shown below as <em>assumed</em> — the record is honest
                  about not knowing, which is what makes this figure worth acting on.
                </p>
              )}
            </div>
          </div>
        </Paper>
      )}

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        keyExtractor={r => r._id}
        exportFileName="visitor-log"
        columnToggle
        emptyTitle="Nothing here yet"
        emptyText="Once the gate desk logs an arrival it appears here, and stays for as long as your society keeps records."
        pagination={{
          page,
          pageSize,
          total,
          onPageChange: p => url.set({ page: String(p + 1) }),
          onPageSizeChange: s => url.set({ pageSize: String(s), page: '1' }),
        }}
        toolbar={
          <>
            <TextField
              placeholder="Name, phone, flat, vehicle…" value={draftQ}
              onChange={e => setDraftQ(e.target.value)} className="flex-1 min-w-56"
              slotProps={{
                input: {
                  startAdornment: <Search className="w-4 h-4 text-slate-400 mr-2" />,
                  endAdornment: draftQ ? (
                    <IconButton size="small" onClick={() => setDraftQ('')} aria-label="Clear search">
                      <X className="w-4 h-4 text-slate-400" />
                    </IconButton>
                  ) : undefined,
                },
              }}
            />
            <FormControl className="min-w-40">
              <Select displayEmpty value={category}
                onChange={e => url.set({ category: e.target.value, page: '1' })}>
                <MenuItem value="">All kinds</MenuItem>
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
              </Select>
            </FormControl>
          </>
        }
      />
    </div>
  );
}

// `useSearchParams` needs a boundary above it or the production build refuses
// to prerender the route. See node_modules/next/dist/docs — use-search-params.
export default function GateLogPage() {
  return (
    <Suspense fallback={<div className="py-24" />}>
      <VisitorLog />
    </Suspense>
  );
}
