'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import {
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  CircularProgress, TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  Paper, Zoom, FormControl, Select, MenuItem, Checkbox, FormControlLabel,
} from '@mui/material';
import { X, Download, Gavel, Send, CheckCircle2 } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

type Stage = 'FIRST' | 'SECOND' | 'FINAL' | 'RECOVERY_101';
type Channel = 'EMAIL' | 'HAND' | 'POST';

interface Buckets { current: number; d31_60: number; d61_90: number; d90plus: number }
interface DefaulterRow {
  flatId: string; flatNumber: string; blockName: string; ownerName?: string;
  invoices: number; outstandingPaise: number; oldestDue: string; buckets: Buckets;
}
interface Notice {
  _id: string; flatId: string; flat: string; memberName: string;
  stage: Stage; stageLabel: string; outstandingPaise: number; currentOutstandingPaise: number;
  issuedOn: string; dueByOn: string; deliveredVia: Channel[]; recoveryRef?: string;
  resolvedOn?: string; issuedByName: string;
}
interface FlatStatus { noticeCount: number; lastStage?: Stage; lastIssuedOn?: string; nextStage: Stage }

const rupees = (p?: number) => `₹${((p || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const shortDate = (d?: string) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—');

const STAGE_LABEL: Record<Stage, string> = {
  FIRST: 'First Reminder',
  SECOND: 'Second Reminder',
  FINAL: 'Final Notice',
  RECOVERY_101: 'Recovery Filed',
};
const STAGE_STYLE: Record<Stage, string> = {
  FIRST: 'bg-blue-50 text-blue-700 border-blue-100',
  SECOND: 'bg-amber-50 text-amber-700 border-amber-100',
  FINAL: 'bg-orange-50 text-orange-700 border-orange-100',
  RECOVERY_101: 'bg-red-50 text-red-700 border-red-100',
};
const CHANNELS: { key: Channel; label: string }[] = [
  { key: 'EMAIL', label: 'Email' }, { key: 'HAND', label: 'By hand' }, { key: 'POST', label: 'Post' },
];

export default function NoticesPage() {
  const { showToast } = useToastConfirm();
  const [tab, setTab] = useState<'defaulters' | 'notices'>('defaulters');
  const [rows, setRows] = useState<DefaulterRow[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [byFlat, setByFlat] = useState<Record<string, FlatStatus>>({});
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState('');

  const [target, setTarget] = useState<DefaulterRow | null>(null);
  const [form, setForm] = useState<{ deliveredVia: Channel[]; notes: string; recoveryRef: string }>({ deliveredVia: ['EMAIL'], notes: '', recoveryRef: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (stageFilter) params.append('stage', stageFilter);
      const [d, n] = await Promise.all([
        api.get('/finance/society/reports/defaulters'),
        api.get(`/finance/society/notices?${params.toString()}`),
      ]);
      setRows(d.data.rows || []);
      setNotices(n.data.rows || []);
      setByFlat(n.data.byFlat || {});
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to load defaulters', 'error'); }
    finally { setLoading(false); }
  }, [stageFilter, showToast]);
  useEffect(() => { load(); }, [load]);

  // The stage is the server's decision — it enforces the escalation order, and a
  // second opinion here would only drift out of step with it.
  const nextStageOf = (flatId: string): Stage => byFlat[flatId]?.nextStage || 'FIRST';

  const openIssue = (r: DefaulterRow) => {
    setTarget(r);
    setForm({ deliveredVia: ['EMAIL'], notes: '', recoveryRef: '' });
  };

  const submitIssue = async () => {
    if (!target) return;
    setSaving(true);
    try {
      await api.post('/finance/society/notices', {
        flatId: target.flatId,
        deliveredVia: form.deliveredVia,
        notes: form.notes || undefined,
        recoveryRef: form.recoveryRef || undefined,
      });
      showToast('Notice issued', 'success');
      setTarget(null);
      load();
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to issue notice', 'error'); }
    finally { setSaving(false); }
  };

  const resolve = async (n: Notice) => {
    try { await api.post(`/finance/society/notices/${n._id}/resolve`, {}); showToast('Notice resolved', 'success'); load(); }
    catch (e: any) { showToast(e.response?.data?.error || 'Failed to resolve', 'error'); }
  };

  const pdf = async (n: Notice) => {
    try {
      const res = await api.get(`/finance/society/notices/${n._id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
      // Revoke once the tab has had a chance to take it; an immediate revoke
      // races the open and hands the user a blank tab.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to download notice', 'error'); }
  };

  const toggleChannel = (c: Channel) => setForm(f => ({
    ...f,
    deliveredVia: f.deliveredVia.includes(c) ? f.deliveredVia.filter(x => x !== c) : [...f.deliveredVia, c],
  }));

  const totalOutstanding = rows.reduce((s, r) => s + r.outstandingPaise, 0);
  const total90 = rows.reduce((s, r) => s + r.buckets.d90plus, 0);
  const nextStage = target ? nextStageOf(target.flatId) : 'FIRST';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Defaulter Notices</h1>
          <p className="text-sm text-slate-500 mt-0.5">Demand dues in writing, and keep the trail recovery depends on</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200/60 rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Total outstanding</p>
          <p className="text-xl font-black text-slate-800 mt-1">{rupees(totalOutstanding)}</p>
        </div>
        <div className="bg-white border border-slate-200/60 rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Over 90 days</p>
          <p className="text-xl font-black text-red-600 mt-1">{rupees(total90)}</p>
        </div>
        <div className="bg-white border border-slate-200/60 rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Notices open</p>
          <p className="text-xl font-black text-slate-800 mt-1">{notices.filter(n => !n.resolvedOn).length}</p>
        </div>
      </div>

      <div className="flex gap-2 items-center">
        {(['defaulters', 'notices'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`text-xs font-black uppercase tracking-wider px-4 py-2 rounded-xl border transition ${tab === t ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
            {t === 'defaulters' ? 'Who owes' : 'Notices issued'}
          </button>
        ))}
        {tab === 'notices' && (
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <Select displayEmpty value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
              <MenuItem value="">All stages</MenuItem>
              {(Object.keys(STAGE_LABEL) as Stage[]).map(s => <MenuItem key={s} value={s}>{STAGE_LABEL[s]}</MenuItem>)}
            </Select>
          </FormControl>
        )}
      </div>

      <TableContainer component={Paper} elevation={1} className="rounded-2xl border border-slate-200/60 shadow-sm overflow-x-auto">
        {loading ? <div className="flex justify-center py-20 bg-white"><CircularProgress size={32} /></div>
          : tab === 'defaulters' ? (
            rows.length === 0 ? <div className="text-center py-20 text-slate-400 font-semibold text-sm bg-white">Nobody owes anything. Nothing to demand.</div>
            : (
              <Table sx={{ minWidth: 980 }}>
                <TableHead><TableRow>
                  <TableCell>Flat</TableCell><TableCell>Member</TableCell>
                  <TableCell align="right">Outstanding</TableCell>
                  <TableCell align="right">Current</TableCell><TableCell align="right">31–60d</TableCell>
                  <TableCell align="right">61–90d</TableCell><TableCell align="right">90d+</TableCell>
                  <TableCell>Notices</TableCell><TableCell align="right">Action</TableCell>
                </TableRow></TableHead>
                <TableBody className="bg-white">
                  {rows.map(r => {
                    const st = byFlat[r.flatId];
                    return (
                      <TableRow key={r.flatId}>
                        <TableCell className="font-bold text-slate-800">{r.flatNumber}<span className="text-slate-400 font-normal text-xs"> · {r.blockName}</span></TableCell>
                        <TableCell className="text-slate-600 text-sm">{r.ownerName || '—'}</TableCell>
                        <TableCell align="right" className="font-bold text-slate-800">{rupees(r.outstandingPaise)}</TableCell>
                        <TableCell align="right" className="text-xs text-slate-500">{r.buckets.current ? rupees(r.buckets.current) : '—'}</TableCell>
                        <TableCell align="right" className="text-xs text-amber-600 font-semibold">{r.buckets.d31_60 ? rupees(r.buckets.d31_60) : '—'}</TableCell>
                        <TableCell align="right" className="text-xs text-orange-600 font-semibold">{r.buckets.d61_90 ? rupees(r.buckets.d61_90) : '—'}</TableCell>
                        <TableCell align="right" className="text-xs text-red-600 font-black">{r.buckets.d90plus ? rupees(r.buckets.d90plus) : '—'}</TableCell>
                        <TableCell>
                          {st?.lastStage
                            ? <span className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-black border ${STAGE_STYLE[st.lastStage]}`}>{STAGE_LABEL[st.lastStage]}</span>
                            : <span className="text-xs text-slate-400">None yet</span>}
                          {!!st?.lastIssuedOn && <span className="text-[10px] text-slate-400 block mt-0.5">{shortDate(st.lastIssuedOn)}</span>}
                        </TableCell>
                        <TableCell align="right">
                          <Button onClick={() => openIssue(r)} size="small" variant="outlined" startIcon={<Send className="w-3.5 h-3.5" />} sx={{ whiteSpace: 'nowrap' }}>
                            {STAGE_LABEL[nextStageOf(r.flatId)]}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )
          ) : (
            notices.length === 0 ? <div className="text-center py-20 text-slate-400 font-semibold text-sm bg-white">No notices issued yet.</div>
            : (
              <Table sx={{ minWidth: 980 }}>
                <TableHead><TableRow>
                  <TableCell>Flat</TableCell><TableCell>Member</TableCell><TableCell>Stage</TableCell>
                  <TableCell align="right">Demanded</TableCell><TableCell align="right">Owed now</TableCell>
                  <TableCell>Issued</TableCell><TableCell>Pay by</TableCell><TableCell>Served</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow></TableHead>
                <TableBody className="bg-white">
                  {notices.map(n => (
                    <TableRow key={n._id} className={n.resolvedOn ? 'opacity-60' : ''}>
                      <TableCell className="font-bold text-slate-800">{n.flat}</TableCell>
                      <TableCell className="text-slate-600 text-sm">{n.memberName}</TableCell>
                      <TableCell>
                        <span className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-black border ${STAGE_STYLE[n.stage]}`}>{STAGE_LABEL[n.stage]}</span>
                        {n.recoveryRef && <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">{n.recoveryRef}</span>}
                      </TableCell>
                      {/* What the notice demanded is frozen; what is owed today is not. */}
                      <TableCell align="right" className="font-bold text-slate-800">{rupees(n.outstandingPaise)}</TableCell>
                      <TableCell align="right" className={`text-sm font-semibold ${n.currentOutstandingPaise === 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                        {n.currentOutstandingPaise === 0 ? 'Cleared' : rupees(n.currentOutstandingPaise)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">{shortDate(n.issuedOn)}</TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">{shortDate(n.dueByOn)}</TableCell>
                      <TableCell className="text-[10px] text-slate-400 uppercase">{n.deliveredVia.join(', ') || '—'}</TableCell>
                      <TableCell align="right">
                        <div className="flex items-center justify-end gap-1">
                          {!n.resolvedOn && (
                            <IconButton title="Mark resolved" onClick={() => resolve(n)} size="small" className="bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 text-slate-500 rounded-xl p-2"><CheckCircle2 className="w-4 h-4" /></IconButton>
                          )}
                          <IconButton title="Download notice" onClick={() => pdf(n)} size="small" className="bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-500 rounded-xl p-2"><Download className="w-4 h-4" /></IconButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          )}
      </TableContainer>

      {/* Issue notice */}
      <Dialog open={!!target} onClose={() => setTarget(null)} slots={{ transition: Zoom }} maxWidth="xs" fullWidth>
        <DialogTitle className="flex justify-between items-center pr-3">
          <span className="flex items-center gap-2"><Gavel className="w-5 h-5 text-amber-600" />Issue notice</span>
          <IconButton onClick={() => setTarget(null)} size="small"><X className="w-5 h-5" /></IconButton>
        </DialogTitle>
        <DialogContent className="space-y-4">
          {target && (
            <>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
                <p className="text-sm font-bold text-slate-800">{target.flatNumber} · {target.blockName}</p>
                <p className="text-xs text-slate-500">{target.ownerName || 'The Member'}</p>
                <p className="text-lg font-black text-slate-800 pt-1">{rupees(target.outstandingPaise)}</p>
                <p className="text-[11px] text-slate-500">
                  This amount is frozen onto the notice as it stands today. Later bills will not change what this notice demanded.
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">Stage</p>
                <p className="text-sm font-bold text-amber-900 mt-0.5">{STAGE_LABEL[nextStage]}</p>
                <p className="text-[11px] text-amber-800 mt-1">
                  {nextStage === 'FIRST' && 'The first written demand. The ladder starts here.'}
                  {nextStage === 'SECOND' && 'A first reminder is already on record for this flat.'}
                  {nextStage === 'FINAL' && 'The last demand before the society can file for recovery.'}
                  {nextStage === 'RECOVERY_101' && 'Records that a recovery application has been filed. Its reference is required.'}
                </p>
              </div>

              {nextStage === 'RECOVERY_101' && (
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Application / certificate reference *</span>
                  <TextField hiddenLabel fullWidth size="small" placeholder="e.g. REC/2026/17"
                    value={form.recoveryRef} onChange={e => setForm(f => ({ ...f, recoveryRef: e.target.value }))} />
                </div>
              )}

              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Served by</span>
                <div className="flex gap-2 flex-wrap">
                  {CHANNELS.map(c => (
                    <FormControlLabel key={c.key} label={<span className="text-xs font-semibold text-slate-600">{c.label}</span>}
                      control={<Checkbox size="small" checked={form.deliveredVia.includes(c.key)} onChange={() => toggleChannel(c.key)} />} />
                  ))}
                </div>
              </div>

              <TextField hiddenLabel fullWidth size="small" multiline rows={2} placeholder="Notes (optional)"
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                slotProps={{ htmlInput: { maxLength: 1000 } }} />
            </>
          )}
        </DialogContent>
        <DialogActions className="p-5 pt-0 gap-2">
          <Button onClick={() => setTarget(null)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
          <Button onClick={submitIssue} disabled={saving || (nextStage === 'RECOVERY_101' && !form.recoveryRef.trim())} variant="contained" fullWidth className="py-2.5 font-bold">
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Issue'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}