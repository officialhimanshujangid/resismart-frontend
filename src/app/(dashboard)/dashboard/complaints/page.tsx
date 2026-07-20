'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
  pausedAt?: string; pauseReason?: string; reopenCount: number;
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

  const load = useCallback(async () => {
    try {
      const p = new URLSearchParams();
      if (openOnly) p.set('open', 'true');
      if (q.trim()) p.set('q', q.trim());
      const [l, o] = await Promise.all([
        api.get(`/complaints?${p}`),
        api.get('/complaints/options'),
      ]);
      setRows(l.data?.rows || []);
      setOptions(o.data?.data || null);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not load complaints', 'error');
    } finally { setLoading(false); }
  }, [openOnly, q, showToast]);

  useEffect(() => { load(); }, [load]);

  // Arriving from a scanned sticker: open the form with the equipment already
  // chosen, which is the entire point of putting a QR code on a lift.
  useEffect(() => {
    const asset = params.get('asset');
    const category = params.get('category');
    if (asset) {
      setForm((f: any) => ({ ...f, assetId: asset, categoryId: category || f.categoryId }));
      setRaiseOpen(true);
    }
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

  if (loading) return <div className="flex justify-center py-24"><CircularProgress /></div>;

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">Complaints</h1>
          <p className="text-sm text-slate-600 mt-1">Report a problem, and see who is on it.</p>
        </div>
        <Button variant="contained" startIcon={<Plus className="w-4 h-4" />}
          onClick={() => setRaiseOpen(true)} className="!rounded-xl !normal-case !font-bold shrink-0">
          Report a problem
        </Button>
      </div>

      {s && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Open', value: s.open, tone: '' },
            { label: 'Overdue', value: s.overdue, tone: s.overdue ? 'text-amber-700' : '' },
            { label: 'Nobody assigned', value: s.unassigned, tone: s.unassigned ? 'text-red-600' : '' },
            { label: 'Reopened', value: `${s.reopenRate}%`, tone: s.reopenRate > 20 ? 'text-amber-700' : '' },
          ].map(k => (
            <Paper key={k.label} elevation={0} className="rounded-2xl border border-slate-200/70 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{k.label}</p>
              <p className={`text-xl font-black mt-0.5 ${k.tone || 'text-slate-800'}`}>{k.value}</p>
            </Paper>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-center flex-wrap">
        <TextField size="small" placeholder="Search…" value={q} onChange={e => setQ(e.target.value)}
          className="flex-1 min-w-52"
          slotProps={{ input: { className: '!rounded-xl', startAdornment: <Search className="w-4 h-4 text-slate-400 mr-2" /> } }} />
        <ToggleButtonGroup exclusive size="small" value={openOnly ? 'open' : 'all'}
          onChange={(_, v) => v && setOpenOnly(v === 'open')}>
          <ToggleButton value="open" className="!rounded-l-xl !normal-case !text-xs !font-bold !px-3">Open</ToggleButton>
          <ToggleButton value="all" className="!rounded-r-xl !normal-case !text-xs !font-bold !px-3">All</ToggleButton>
        </ToggleButtonGroup>
      </div>

      {rows.length === 0 ? (
        <Paper elevation={0} className="rounded-2xl border border-slate-200/70 p-10 text-center">
          <Check className="w-8 h-8 text-emerald-300 mx-auto" />
          <p className="mt-3 font-bold text-slate-700">Nothing outstanding</p>
        </Paper>
      ) : (
        <div className="grid gap-2">
          {rows.map(x => (
            <Paper key={x._id} elevation={0} onClick={() => openDetail(x._id)}
              className={`rounded-2xl border p-3 cursor-pointer hover:border-slate-300 ${overdue(x) ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200/70'}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
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
                  <p className="text-xs text-slate-500 mt-0.5">
                    {x.ticketCode} · {x.category}{x.subCategory && ` — ${x.subCategory}`}
                    {x.flatLabel && ` · ${x.flatLabel}`}
                    {x.assetName && ` · ${x.assetName}`}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Chip size="small" label={pretty(x.status)}
                      className={`!font-bold !text-[10px] !h-5 ${STATUS_STYLE[x.status] || ''}`} />
                    {x.pausedAt && (
                      <span className="text-[11px] text-amber-700 font-semibold">
                        {PAUSE_LABEL[x.pauseReason || ''] || 'On hold'}
                      </span>
                    )}
                    {x.assigneeName || x.assigneeVendorName ? (
                      <span className="text-[11px] text-slate-500">
                        with {x.assigneeName || x.assigneeVendorName}
                      </span>
                    ) : (
                      <span className="text-[11px] text-red-600 font-semibold">nobody assigned</span>
                    )}
                    {x.meTooUserIds?.length > 0 && (
                      <span className="text-[11px] text-slate-500 flex items-center gap-0.5">
                        <Users className="w-3 h-3" />{x.meTooUserIds.length + 1}
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400">{ago(x.createdAt)}</span>
                  </div>
                </div>
              </div>
            </Paper>
          ))}
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
