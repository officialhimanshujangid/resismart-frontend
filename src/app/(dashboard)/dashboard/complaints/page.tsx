'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import {
  Paper, Button, TextField, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogActions, Select, MenuItem, FormControl, InputLabel, Chip, ToggleButton,
  ToggleButtonGroup, Rating,
} from '@mui/material';
import {
  Plus, Search, AlertTriangle, Clock, PauseCircle, PlayCircle, Check, Users,
  MessageSquare, ShieldAlert, RefreshCw, Wrench, Info,
} from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { DataTable, ColumnDef } from '@/components/common/DataTable';
import PageHeader from '@/components/common/PageHeader';
import StatCard from '@/components/common/StatCard';

/**
 * Complaints.
 *
 * One screen serves a resident, a technician, a manager and a committee member,
 * because the server already decides what each of them may see. The page never
 * asks "who am I?" to filter — it renders what it was given, which means there
 * is exactly one place the privacy rule lives.
 */

interface Complaint {
  _id: string; ticketCode: string; kind: string; title: string; description?: string;
  category: string; subCategory?: string; status: string; priority: string;
  flatLabel?: string; blockName?: string; assetName?: string;
  assigneeName?: string; assigneeVendorName?: string; routedVia?: string;
  raisedByName: string; createdAt: string;
  firstResponseDueAt?: string; resolutionDueAt?: string; firstRespondedAt?: string;
  pausedAt?: string; pauseReason?: string; reopenCount: number; escalationLevel?: number;
  meTooUserIds: string[]; visibility: string; rating?: number;
}
interface EventRow { _id: string; type: string; note?: string; byName: string; createdAt: string; isInternal: boolean }
interface Options {
  categories: { _id: string; category: string; subCategory?: string; firstResponseMinutes: number; resolutionMinutes: number; isEmergency: boolean }[];
  staff: { _id: string; person: { name: string }; designation: string }[];
  blocks: { _id: string; name: string }[];
  assets: { _id: string; name: string; location?: string }[];
  pauseReasons: string[];
  stats?: { open: number; overdue: number; awaitingConfirmation: number; unassigned: number; reopenRate: number; medianResolutionMinutes: number | null };
}

const STATUS_STYLE: Record<string, string> = {
  NEW: 'bg-sky-50 text-sky-700',
  ASSIGNED: 'bg-indigo-50 text-indigo-700',
  IN_PROGRESS: 'bg-indigo-50 text-indigo-700',
  ON_HOLD: 'bg-amber-50 text-amber-700',
  WORK_DONE: 'bg-violet-50 text-violet-700',
  RESOLVED: 'bg-emerald-50 text-emerald-700',
  CLOSED: 'bg-slate-100 text-slate-500',
  REOPENED: 'bg-red-50 text-red-700',
  REJECTED: 'bg-slate-100 text-slate-500',
};
/**
 * The escalation ladder, worded for a person rather than as a number.
 *
 * Mirrors `ESCALATION_LADDER` in complaint.service — kept in step by hand
 * because the backend does not publish it, and a mismatch here would only ever
 * mislabel a button rather than change what the server does.
 */
const ESCALATION_RUNG: Record<number, string> = {
  1: 'Raise to the person doing the work',
  2: 'Raise to the manager',
  3: 'Raise to the committee',
  4: 'Registrar-level',
};

const PAUSE_LABEL: Record<string, string> = {
  AWAITING_ACCESS: 'Nobody was home',
  AWAITING_PARTS: 'Waiting for parts',
  AWAITING_VENDOR: 'Waiting for the vendor',
  AWAITING_APPROVAL: 'Waiting for approval',
};
const pretty = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase());
const ago = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
};

export default function ComplaintsPage() {
  const { showToast, confirm } = useToastConfirm();
  const params = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Complaint[]>([]);
  const [options, setOptions] = useState<Options | null>(null);
  const [q, setQ] = useState('');
  const [openOnly, setOpenOnly] = useState(true);

  const [raiseOpen, setRaiseOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({ title: '', description: '', categoryId: '', kind: 'SERVICE' });

  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ complaint: Complaint; events: EventRow[] } | null>(null);
  const [note, setNote] = useState('');

  // Total pages the server reports, and the current one, so "show more" knows
  // when to stop and how much has been loaded.
  const [totalPages, setTotalPages] = useState(1);
  const [loadedPage, setLoadedPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  /**
   * `page` is passed through, and rows are APPENDED when it grows.
   *
   * Before this the page read only `data.rows` and never sent `page`, so a
   * society silently only ever saw its 25 most recent complaints — the 26th
   * and everything older simply did not exist as far as the screen was
   * concerned. Now the count is honest and older ones are reachable.
   */
  const load = useCallback(async (page = 1) => {
    try {
      const p = new URLSearchParams();
      if (openOnly) p.set('open', 'true');
      if (q.trim()) p.set('q', q.trim());
      p.set('page', String(page));
      const [l, o] = await Promise.all([
        api.get(`/complaints?${p}`),
        page === 1 ? api.get('/complaints/options') : Promise.resolve(null),
      ]);
      const newRows = l.data?.rows || [];
      setRows(prev => page === 1 ? newRows : [...prev, ...newRows]);
      setTotalPages(l.data?.pagination?.pages || 1);
      setLoadedPage(page);
      if (o) setOptions(o.data?.data || null);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not load complaints', 'error');
    } finally { setLoading(false); }
  }, [openOnly, q, showToast]);

  useEffect(() => { load(1); }, [load]);

  // Arriving from a scanned sticker: open the form with the equipment already
  // chosen, which is the entire point of putting a QR code on a lift.
  // Arriving from a notification: open that complaint's detail directly — every
  // COMPLAINT_* notification links with ?id=, and the page used to ignore it,
  // so tapping any of them landed on the list and opened nothing.
  useEffect(() => {
    const asset = params.get('asset');
    const category = params.get('category');
    if (asset) {
      setForm((f: any) => ({ ...f, assetId: asset, categoryId: category || f.categoryId }));
      setRaiseOpen(true);
    }
    const id = params.get('id');
    if (id) openDetail(id);
    // openDetail is stable enough for this one-shot deep-link open.
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [params]);

  const openDetail = async (id: string) => {
    setOpenId(id); setDetail(null); setNote('');
    try {
      const res = await api.get(`/complaints/${id}`);
      setDetail(res.data?.data);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not open that', 'error');
      setOpenId(null);
    }
  };

  const doRaise = async () => {
    setSaving(true);
    try {
      const res = await api.post('/complaints', form);
      showToast(res.data?.message || 'Raised', 'success');
      setRaiseOpen(false);
      setForm({ title: '', description: '', categoryId: '', kind: 'SERVICE' });
      await load();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not raise that', 'error');
    } finally { setSaving(false); }
  };

  const action = async (path: string, body: any = {}, msg = 'Done') => {
    if (!openId) return;
    try {
      await api.post(`/complaints/${openId}/${path}`, body);
      showToast(msg, 'success');
      await openDetail(openId);
      await load();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not do that', 'error');
    }
  };

  const c = detail?.complaint;
  const overdue = (x: Complaint) =>
    x.resolutionDueAt && new Date(x.resolutionDueAt) < new Date() && !['RESOLVED', 'CLOSED', 'ON_HOLD'].includes(x.status);

  const s = options?.stats;

  const complaintColumns: ColumnDef<Complaint>[] = [
    {
      id: 'title', label: 'Problem', alwaysVisible: true,
      sortValue: x => x.title,
      exportValue: x => x.title,
      render: x => (
        <div className="min-w-0 max-w-[26rem]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-bold text-slate-800 truncate">{x.title}</p>
            {x.kind === 'CONDUCT' && (
              <Chip size="small" icon={<ShieldAlert className="w-3 h-3" />} label="Conduct"
                className="!bg-red-50 !text-red-700 !font-bold !text-[10px] !h-5" />
            )}
            {x.priority === 'EMERGENCY' && (
              <Chip size="small" label="Emergency" className="!bg-red-600 !text-white !font-bold !text-[10px] !h-5" />
            )}
            {x.reopenCount > 0 && (
              <Chip size="small" icon={<RefreshCw className="w-3 h-3" />} label={`reopened ${x.reopenCount}×`}
                className="!bg-red-50 !text-red-700 !font-bold !text-[10px] !h-5" />
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
            {x.ticketCode} · {x.category}{x.subCategory && ` — ${x.subCategory}`}
          </p>
        </div>
      ),
    },
    {
      id: 'where', label: 'Where',
      sortValue: x => x.flatLabel || x.blockName || '',
      exportValue: x => [x.flatLabel || x.blockName, x.assetName].filter(Boolean).join(' · '),
      render: x => (
        <div className="min-w-0">
          <p className="text-sm text-slate-600 truncate">{x.flatLabel || x.blockName || 'Common area'}</p>
          {x.assetName && <p className="text-[11px] text-slate-400 truncate">{x.assetName}</p>}
        </div>
      ),
    },
    {
      id: 'status', label: 'Status',
      sortValue: x => pretty(x.status),
      exportValue: x => pretty(x.status),
      render: x => (
        <div className="min-w-0">
          <Chip size="small" label={pretty(x.status)}
            className={`!font-bold !text-[10px] !h-5 ${STATUS_STYLE[x.status] || ''}`} />
          {x.pausedAt && (
            <p className="text-[11px] text-amber-700 font-semibold mt-0.5">
              {PAUSE_LABEL[x.pauseReason || ''] || 'On hold'}
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'with', label: 'With',
      // Unassigned sorts to the top of an ascending sort on purpose: an empty
      // string beats every name, and "who has nobody" is the question this
      // column is actually asked.
      sortValue: x => x.assigneeName || x.assigneeVendorName || '',
      exportValue: x => x.assigneeName || x.assigneeVendorName || 'nobody',
      render: x => x.assigneeName || x.assigneeVendorName
        ? <span className="text-sm text-slate-600">{x.assigneeName || x.assigneeVendorName}</span>
        : <span className="text-[11px] text-red-600 font-bold">nobody assigned</span>,
    },
    {
      id: 'due', label: 'Due',
      // The SLA clock, sortable — the whole reason a manager opens this screen,
      // and something a list of cards could never answer at a glance.
      sortValue: x => x.resolutionDueAt || '',
      exportValue: x => x.resolutionDueAt ? new Date(x.resolutionDueAt).toLocaleString('en-IN') : '',
      render: x => {
        if (!x.resolutionDueAt) return <span className="text-slate-300">—</span>;
        const late = overdue(x);
        return (
          <span className={`text-[11px] font-semibold ${late ? 'text-amber-700' : 'text-slate-500'}`}>
            {late && <AlertTriangle className="w-3 h-3 inline mr-0.5 -mt-0.5" />}
            {new Date(x.resolutionDueAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </span>
        );
      },
    },
    {
      id: 'metoo', label: 'Affected', align: 'center', defaultHidden: true,
      sortValue: x => (x.meTooUserIds?.length || 0) + 1,
      exportValue: x => (x.meTooUserIds?.length || 0) + 1,
      render: x => (
        <span className="text-[11px] text-slate-500 flex items-center justify-center gap-0.5">
          <Users className="w-3 h-3" />{(x.meTooUserIds?.length || 0) + 1}
        </span>
      ),
    },
    {
      id: 'raised', label: 'Raised', align: 'right',
      sortValue: x => x.createdAt,
      exportValue: x => new Date(x.createdAt).toLocaleString('en-IN'),
      render: x => <span className="text-[11px] text-slate-400 whitespace-nowrap">{ago(x.createdAt)}</span>,
    },
  ];

  if (loading) return <div className="flex justify-center py-24"><CircularProgress /></div>;

  return (
    <div className="space-y-4 pb-24">
      <PageHeader
        breadcrumb="Operations"
        title="Complaints"
        icon={<MessageSquare className="w-4.5 h-4.5" />}
        subtitle="Report a problem, and see who is on it. Everyone lands on this same screen — the server decides what each person may see, so a resident sees their flat's and a plumber sees their queue."
        actions={
          <>
            {/* Categories are a manage-side concern; the button only appears for
                someone who was handed the staff options (categories + stats). */}
            {options?.categories && options.categories.length > 0 && options.stats && (
              <Button component={Link} href="/dashboard/complaints/categories"
                variant="outlined" className="!rounded-xl !normal-case !font-bold">
                Categories
              </Button>
            )}
            <Button variant="contained" startIcon={<Plus className="w-4 h-4" />}
              onClick={() => setRaiseOpen(true)} className="!rounded-xl !normal-case !font-bold">
              Report a problem
            </Button>
          </>
        }
      />

      {s && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Open" value={s.open} icon={<MessageSquare className="w-5 h-5" />} tone="blue" />
          <StatCard label="Overdue" value={s.overdue} icon={<AlertTriangle className="w-5 h-5" />}
            tone={s.overdue ? 'amber' : 'slate'} />
          <StatCard label="Nobody assigned" value={s.unassigned} icon={<Users className="w-5 h-5" />}
            tone={s.unassigned ? 'rose' : 'slate'}
            sub={s.unassigned ? 'these reach nobody' : undefined} />
          <StatCard label="Reopened" value={`${s.reopenRate}%`} icon={<RefreshCw className="w-5 h-5" />}
            tone={s.reopenRate > 20 ? 'amber' : 'slate'}
            sub={s.reopenRate > 20 ? 'work is not sticking' : undefined} />
        </div>
      )}

      <DataTable
        columns={complaintColumns}
        data={rows}
        keyExtractor={x => x._id}
        onRowClick={x => openDetail(x._id)}
        exportFileName="complaints"
        columnToggle
        emptyTitle="Nothing outstanding"
        emptyText="Nothing is waiting on anybody. Report a problem with the button above when something needs fixing."
        emptyIcon={<Check className="w-6 h-6 text-emerald-400" />}
        toolbar={
          <>
            <TextField size="small" placeholder="Search…" value={q} onChange={e => setQ(e.target.value)}
              className="min-w-[220px]"
              slotProps={{ input: { className: '!rounded-xl', startAdornment: <Search className="w-4 h-4 text-slate-400 mr-2" /> } }} />
            <ToggleButtonGroup exclusive size="small" value={openOnly ? 'open' : 'all'}
              onChange={(_, v) => v && setOpenOnly(v === 'open')}>
              <ToggleButton value="open" className="!rounded-l-xl !normal-case !text-xs !font-bold !px-3">Open</ToggleButton>
              <ToggleButton value="all" className="!rounded-r-xl !normal-case !text-xs !font-bold !px-3">All</ToggleButton>
            </ToggleButtonGroup>
          </>
        }
      />

      {rows.length > 0 && (
        <div className="grid gap-2">
          {loadedPage < totalPages && (
            <Button variant="outlined" disabled={loadingMore}
              onClick={async () => { setLoadingMore(true); try { await load(loadedPage + 1); } finally { setLoadingMore(false); } }}
              className="!rounded-2xl !normal-case !font-bold !mt-1">
              {loadingMore ? 'Loading…' : 'Show older complaints'}
            </Button>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------ raise */}
      <Dialog open={raiseOpen} onClose={() => setRaiseOpen(false)} fullWidth maxWidth="xs"
        slotProps={{ paper: { className: '!rounded-2xl' } }}>
        <DialogTitle className="!font-black !text-slate-900">Report a problem</DialogTitle>
        <DialogContent dividers className="space-y-3">
          <ToggleButtonGroup exclusive size="small" fullWidth value={form.kind}
            onChange={(_, v) => v && setForm({ ...form, kind: v })}>
            <ToggleButton value="SERVICE" className="!rounded-l-xl !normal-case !text-xs !font-bold">Something is broken</ToggleButton>
            <ToggleButton value="CONDUCT" className="!rounded-r-xl !normal-case !text-xs !font-bold">Somebody&apos;s behaviour</ToggleButton>
          </ToggleButtonGroup>

          {form.kind === 'CONDUCT' && (
            <div className="rounded-xl bg-slate-100 border border-slate-200 p-3 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-600 leading-relaxed">
                This goes only to the committee member who handles conduct — not to
                the person it is about, and not into anyone&apos;s work queue.
              </p>
            </div>
          )}

          <TextField autoFocus fullWidth size="small" label="What is wrong?" value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })} />

          {form.kind === 'SERVICE' && (
            <FormControl fullWidth size="small">
              <InputLabel>Kind of problem</InputLabel>
              <Select label="Kind of problem" value={form.categoryId || ''}
                onChange={e => setForm({ ...form, categoryId: e.target.value })}>
                {options?.categories.map(cat => (
                  <MenuItem key={cat._id} value={cat._id}>
                    {cat.category}{cat.subCategory && ` — ${cat.subCategory}`}
                    {cat.isEmergency && ' ⚡'}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <TextField fullWidth size="small" multiline minRows={2} label="Anything else (optional)"
            value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />

          {form.assetId && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 flex items-center gap-2">
              <Wrench className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs text-emerald-900 font-semibold">
                {options?.assets.find(a => a._id === form.assetId)?.name || 'Equipment'} — picked up from the sticker
              </span>
            </div>
          )}
        </DialogContent>
        <DialogActions className="!px-6 !py-3">
          <Button onClick={() => setRaiseOpen(false)} className="!normal-case !font-bold">Cancel</Button>
          <Button variant="contained" onClick={doRaise} disabled={saving || !form.title}
            className="!rounded-xl !normal-case !font-bold">
            {saving ? 'Sending…' : 'Report it'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ----------------------------------------------------------- detail */}
      <Dialog open={!!openId} onClose={() => setOpenId(null)} fullWidth maxWidth="sm"
        slotProps={{ paper: { className: '!rounded-2xl' } }}>
        {!detail ? (
          <div className="flex justify-center py-16"><CircularProgress size={28} /></div>
        ) : (
          <>
            <DialogTitle className="!font-black !text-slate-900 !pb-1">
              {c!.title}
              <span className="block text-xs font-normal text-slate-500 mt-0.5">
                {c!.ticketCode} · {c!.category} · raised by {c!.raisedByName} {ago(c!.createdAt)}
              </span>
            </DialogTitle>
            <DialogContent dividers className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Chip size="small" label={pretty(c!.status)} className={`!font-bold !text-[11px] ${STATUS_STYLE[c!.status] || ''}`} />
                {c!.pausedAt && (
                  <Chip size="small" icon={<PauseCircle className="w-3 h-3" />}
                    label={PAUSE_LABEL[c!.pauseReason || ''] || 'On hold'}
                    className="!bg-amber-50 !text-amber-700 !font-bold !text-[11px]" />
                )}
                {(c!.assigneeName || c!.assigneeVendorName) && (
                  <span className="text-xs text-slate-500">with {c!.assigneeName || c!.assigneeVendorName}</span>
                )}
              </div>

              {c!.description && <p className="text-sm text-slate-700 leading-relaxed">{c!.description}</p>}

              {c!.resolutionDueAt && !['RESOLVED', 'CLOSED'].includes(c!.status) && (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-xs text-slate-600">
                    Due {new Date(c!.resolutionDueAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {c!.pausedAt && ' — the clock is stopped while this is on hold'}
                  </span>
                </div>
              )}

              {/* --------------------------------------------------- history */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">What has happened</p>
                <div className="space-y-2">
                  {detail.events.map(e => (
                    <div key={e._id} className="flex gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-slate-700">
                          <span className="font-semibold">{pretty(e.type)}</span>
                          {e.note && <span className="text-slate-600"> — {e.note}</span>}
                        </p>
                        <p className="text-[10px] text-slate-400">{e.byName} · {ago(e.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* --------------------------------------------------- actions */}
              {!['CLOSED', 'REJECTED'].includes(c!.status) && (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2">
                  <TextField fullWidth size="small" multiline minRows={2} placeholder="Add a note…"
                    value={note} onChange={e => setNote(e.target.value)}
                    slotProps={{ input: { className: '!rounded-xl !bg-white' } }} />
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="small" variant="outlined" startIcon={<MessageSquare className="w-3.5 h-3.5" />}
                      disabled={!note.trim()}
                      onClick={() => { action('respond', { note }, 'Reply recorded'); setNote(''); }}
                      className="!rounded-xl !normal-case !font-bold !text-xs">Reply</Button>

                    {c!.pausedAt ? (
                      <Button size="small" variant="outlined" startIcon={<PlayCircle className="w-3.5 h-3.5" />}
                        onClick={() => action('resume', {}, 'Back on')}
                        className="!rounded-xl !normal-case !font-bold !text-xs">Take off hold</Button>
                    ) : (
                      <FormControl size="small" className="w-48">
                        <Select displayEmpty value="" className="!rounded-xl !bg-white !text-xs"
                          onChange={e => action('pause', { reason: e.target.value }, 'On hold')}>
                          <MenuItem value="" disabled><em className="text-slate-400 text-xs">Put on hold…</em></MenuItem>
                          {options?.pauseReasons.map(r => (
                            <MenuItem key={r} value={r} className="!text-xs">{PAUSE_LABEL[r] || pretty(r)}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}

                    {!['WORK_DONE', 'RESOLVED'].includes(c!.status) && (
                      <Button size="small" variant="outlined" startIcon={<Wrench className="w-3.5 h-3.5" />}
                        onClick={() => { action('work-done', { note }, 'Marked as done'); setNote(''); }}
                        className="!rounded-xl !normal-case !font-bold !text-xs">Work is done</Button>
                    )}

                    {c!.status === 'WORK_DONE' && (
                      <Button size="small" variant="contained" startIcon={<Check className="w-3.5 h-3.5" />}
                        onClick={() => action('resolve', {}, 'Confirmed')}
                        className="!rounded-xl !normal-case !font-bold !text-xs">Yes, it is fixed</Button>
                    )}

                    {c!.visibility === 'COMMUNITY' && (
                      <Button size="small" variant="outlined" startIcon={<Users className="w-3.5 h-3.5" />}
                        onClick={() => action('me-too', {}, 'Added you')}
                        className="!rounded-xl !normal-case !font-bold !text-xs">Me too</Button>
                    )}
                  </div>

                  {/* ------------------------------------------ the manager's side
                    *
                    * Assign, escalate and close are `COMPLAINTS_MANAGE` routes that
                    * shipped complete and had no caller anywhere in the frontend —
                    * so a society could route work automatically but never move a
                    * ticket by hand, never push a stuck one up, and never close one.
                    *
                    * `options.staff` is only sent to somebody who holds the manage
                    * permission, so its presence is the honest test for whether to
                    * show any of this. The routes refuse anyway.
                    */}
                  {options?.staff && options.staff.length > 0 && (
                    <div className="border-t border-slate-200 pt-2.5 mt-1 space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                        Managing this
                      </p>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <FormControl size="small" className="w-56">
                          <Select displayEmpty value={c!.assigneeName ? 'x' : ''}
                            className="!rounded-xl !bg-white !text-xs"
                            renderValue={() => c!.assigneeName
                              ? <span className="text-xs">With {c!.assigneeName}</span>
                              : <em className="text-slate-400 text-xs">Give it to someone…</em>}
                            onChange={e => action('assign', { staffId: e.target.value || null },
                              e.target.value ? 'Assigned' : 'Taken off them')}>
                            {options.staff.map(st => (
                              <MenuItem key={st._id} value={st._id} className="!text-xs">
                                {st.person.name} · {pretty(st.designation)}
                              </MenuItem>
                            ))}
                            {c!.assigneeName && (
                              <MenuItem value="" className="!text-xs !text-slate-500">
                                Take it off them
                              </MenuItem>
                            )}
                          </Select>
                        </FormControl>

                        {/* One rung at a time — the ladder is ordered and skipping
                            straight to the Registrar is not a thing a manager
                            should be able to do with one tap. Level 4 is the top. */}
                        {(c!.escalationLevel ?? 0) < 4 && (
                          <Button size="small" variant="outlined" color="warning"
                            startIcon={<AlertTriangle className="w-3.5 h-3.5" />}
                            onClick={() => action('escalate', { level: (c!.escalationLevel ?? 0) + 1 },
                              ESCALATION_RUNG[(c!.escalationLevel ?? 0) + 1] || 'Escalated')}
                            className="!rounded-xl !normal-case !font-bold !text-xs">
                            {ESCALATION_RUNG[(c!.escalationLevel ?? 0) + 1] || 'Escalate'}
                          </Button>
                        )}

                        {/* Only a RESOLVED complaint can be closed — the service
                            refuses otherwise, and offering the button anyway would
                            teach people to expect an error. */}
                        {c!.status === 'RESOLVED' && (
                          <Button size="small" variant="contained"
                            startIcon={<Check className="w-3.5 h-3.5" />}
                            onClick={() => action('close', {}, 'Closed')}
                            className="!rounded-xl !normal-case !font-bold !text-xs">
                            Close it
                          </Button>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {(c!.escalationLevel ?? 0) > 0 && (
                          <>Currently at <strong>{ESCALATION_RUNG[c!.escalationLevel ?? 0] || `level ${c!.escalationLevel}`}</strong>. </>
                        )}
                        Escalating notifies the committee. Closing is final and only possible
                        once the resident has confirmed it is fixed.
                      </p>
                    </div>
                  )}
                  {c!.status === 'WORK_DONE' && (
                    <p className="text-[11px] text-slate-500">
                      Only you can say it is actually fixed — whoever did the work cannot close it.
                    </p>
                  )}
                </div>
              )}

              {['RESOLVED', 'CLOSED'].includes(c!.status) && (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2">
                  <p className="text-xs font-bold text-slate-600">Was it sorted properly?</p>
                  <Rating value={c!.rating || 0} onChange={(_, v) => v && action('rate', { rating: v }, 'Thank you')} />
                  <Button size="small" variant="outlined" startIcon={<RefreshCw className="w-3.5 h-3.5" />}
                    onClick={async () => {
                      const yes = await confirm({
                        title: 'Not actually fixed?',
                        message: 'This reopens the complaint and is counted, so the committee can see how often work comes back.',
                        confirmText: 'Reopen',
                      });
                      if (yes) action('reopen', { reason: note || 'Still not fixed' }, 'Reopened');
                    }}
                    className="!rounded-xl !normal-case !font-bold !text-xs">
                    It is still not fixed
                  </Button>
                </div>
              )}
            </DialogContent>
            <DialogActions className="!px-6 !py-3">
              <Button onClick={() => setOpenId(null)} className="!normal-case !font-bold">Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </div>
  );
}
