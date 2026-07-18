'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  Paper, Button, TextField, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, FormControl, Select, MenuItem, Zoom,
} from '@mui/material';
import { Plus, Landmark, PiggyBank, Briefcase, TrendingUp, X, Info, Pencil } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

interface Fund {
  _id: string; name: string; category: string; description?: string;
  currentBalancePaise: number; targetAmountPaise?: number;
  ledgerAccountId?: string; ledgerAccountCode?: string;
  raisedPaise?: number; spentPaise?: number; collectedPaise?: number;
  remainingToRaisePaise?: number; overRaisedPaise?: number;
}
interface ChargeHead { _id: string; name: string; fundId?: string; }

const rupees = (p?: number) => `₹${((p || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/**
 * Progress toward the target, measured against what has been DEMANDED — not the
 * balance. A fund that raised its target and then paid the contractor has a
 * small balance and is still fully raised; the old bar read that as 7% done and
 * would have had the society chase members who owe nothing.
 *
 * The bar is no longer clamped at 100 either: it used to render 250% exactly
 * like 100%, so over-collection was structurally impossible to see.
 */
const raisedPct = (f: Fund) =>
  Math.max(0, Math.round(((f.raisedPaise || 0) / (f.targetAmountPaise || 1)) * 100));
const CATEGORIES = [
  { v: 'CORPUS', l: 'Corpus Fund' }, { v: 'SINKING', l: 'Sinking / Reserve Fund' },
  { v: 'REPAIR', l: 'Repair & Maintenance Fund' }, { v: 'SPECIAL', l: 'Special Purpose Fund' }, { v: 'GENERAL', l: 'General Fund' },
];

export default function FundsPage() {
  const { showToast } = useToastConfirm();
  const [funds, setFunds] = useState<Fund[]>([]);
  const [heads, setHeads] = useState<ChargeHead[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'CORPUS', description: '', target: '' });
  const [editing, setEditing] = useState<Fund | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const [f, h] = await Promise.all([
        api.get('/finance/society/funds'),
        api.get('/finance/society/charge-heads'),
      ]);
      setFunds(f.data);
      setHeads(h.data || []);
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to load funds', 'error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  /** Charge heads that collect into a given fund — the answer to "how do I fund this?" */
  const feedersFor = (fundId: string) => heads.filter(h => h.fundId === fundId);

  const openEdit = (f: Fund) => {
    setEditing(f);
    setForm({ name: f.name, category: f.category, description: f.description || '', target: f.targetAmountPaise ? String(f.targetAmountPaise / 100) : '' });
    setCreateOpen(true);
  };

  const create = async () => {
    setCreating(true);
    const targetAmountPaise = form.target ? Math.round(parseFloat(form.target) * 100) : 0;
    try {
      if (editing) {
        // Category is not editable: it decided which ledger account this fund
        // adopted, and changing it after money has moved would strand the balance.
        await api.patch(`/finance/society/funds/${editing._id}`, { name: form.name, description: form.description || undefined, targetAmountPaise });
        showToast('Fund updated', 'success');
      } else {
        await api.post('/finance/society/funds', { name: form.name, category: form.category, description: form.description || undefined, targetAmountPaise });
        showToast('Fund created', 'success');
      }
      setCreateOpen(false); setEditing(null); setForm({ name: '', category: 'CORPUS', description: '', target: '' }); load();
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to save fund', 'error'); }
    finally { setCreating(false); }
  };

  const total = funds.reduce((s, f) => s + (f.currentBalancePaise || 0), 0);
  const icon = (c: string) => c === 'CORPUS' ? <Briefcase className="w-5 h-5 text-indigo-500" /> : c === 'SINKING' ? <PiggyBank className="w-5 h-5 text-emerald-500" /> : <Landmark className="w-5 h-5 text-blue-500" />;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-black text-slate-800 tracking-tight">Funds Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Corpus, sinking and reserve funds — every balance is calculated from the ledger</p></div>
        <div className="flex gap-2">
          <Button onClick={() => { setEditing(null); setForm({ name: '', category: 'CORPUS', description: '', target: '' }); setCreateOpen(true); }} variant="contained" startIcon={<Plus className="w-4 h-4" />}>Create Fund</Button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-800 flex gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          <b>How a fund collects money:</b> create the fund, then go to <b>Charge Heads</b> and set that head’s
          “Collects into fund”. What residents pay under that head lands here instead of in ordinary income.
          Spending: add an <b>Expense</b> line tagged with the fund to draw it back down.
        </span>
      </div>

      <Paper elevation={0} className="p-6 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex justify-between items-center">
        <div><p className="text-blue-100 font-medium">Total Society Reserves</p><p className="text-4xl font-black mt-1">{rupees(total)}</p>
          <p className="text-sm text-blue-100 mt-2 opacity-90">Across {funds.length} fund(s)</p></div>
        <div className="p-3 bg-white/20 rounded-full"><Landmark className="w-6 h-6" /></div>
      </Paper>

      {loading ? <div className="flex justify-center py-16"><CircularProgress size={30} /></div> : funds.length === 0 ? (
        <div className="text-center py-16 text-slate-400 border-2 border-dashed rounded-2xl bg-slate-50/50">
          <PiggyBank className="w-12 h-12 mx-auto text-slate-300 mb-3" /><p className="font-semibold">No funds yet.</p>
          <p className="text-sm mt-1">Create a Corpus or Sinking fund to start tracking reserves.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {funds.map(f => (
            <Paper key={f._id} elevation={0} className="rounded-2xl border border-slate-200/60 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-start">
                <div>
                  <p className="font-bold text-slate-800">{f.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{f.category}{f.ledgerAccountCode ? ` · ledger a/c ${f.ledgerAccountCode}` : ''}</p>
                </div>
                <div className="flex items-center gap-1">
                  <IconButton size="small" onClick={() => openEdit(f)} title="Edit fund"><Pencil className="w-4 h-4 text-slate-400" /></IconButton>
                  {icon(f.category)}
                </div>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Current Balance</p>
                  <p className={`text-2xl font-black ${f.currentBalancePaise < 0 ? 'text-red-600' : 'text-slate-800'}`}>{rupees(f.currentBalancePaise)}</p>
                </div>
                {f.currentBalancePaise < 0 && (
                  <div className="text-[11px] text-red-600 flex items-start gap-1">
                    <Info className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>Overspent — more has been drawn from this fund than it holds.</span>
                  </div>
                )}
                {!!f.targetAmountPaise && f.targetAmountPaise > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Target: {rupees(f.targetAmountPaise)}</span>
                      <span className={`font-bold ${(f.overRaisedPaise || 0) > 0 ? 'text-red-600' : 'text-slate-700'}`}>{raisedPct(f)}% raised</span>
                    </div>
                    {/* The bar can now exceed its track, because a fund billed past
                        its target should look wrong at a glance. */}
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${(f.overRaisedPaise || 0) > 0 ? 'bg-red-500' : 'bg-blue-500'}`}
                        style={{ width: `${Math.min(100, raisedPct(f))}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center pt-1">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Billed</p>
                        <p className="text-xs font-bold text-slate-700 font-mono">{rupees(f.raisedPaise)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Received</p>
                        <p className="text-xs font-bold text-emerald-700 font-mono">{rupees(f.collectedPaise)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Spent</p>
                        <p className="text-xs font-bold text-slate-700 font-mono">{rupees(f.spentPaise)}</p>
                      </div>
                    </div>

                    {(f.overRaisedPaise || 0) > 0 && (
                      <div className="text-[11px] text-red-700 bg-red-50 border border-red-100 rounded-lg px-2 py-1.5 flex items-start gap-1">
                        <Info className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>{rupees(f.overRaisedPaise)} more has been billed than this fund needs.</span>
                      </div>
                    )}
                    {(f.remainingToRaisePaise || 0) > 0 && (
                      <p className="text-[11px] text-amber-700">{rupees(f.remainingToRaisePaise)} still to be billed to reach the target.</p>
                    )}
                    {(f.raisedPaise || 0) > (f.collectedPaise || 0) && (
                      <p className="text-[11px] text-slate-400">
                        {rupees((f.raisedPaise || 0) - (f.collectedPaise || 0))} billed but not yet received.
                      </p>
                    )}
                  </div>
                )}
                {/* Name the heads that feed this fund, so an empty fund explains itself. */}
                {feedersFor(f._id).length > 0 ? (
                  <div className="text-[11px] text-emerald-700 flex items-start gap-1">
                    <TrendingUp className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>Collected by: {feedersFor(f._id).map(h => h.name).join(', ')}</span>
                  </div>
                ) : (
                  <div className="text-[11px] text-amber-600 flex items-start gap-1">
                    <Info className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>No charge head collects into this fund yet — it will stay at ₹0. Set one up in Charge Heads.</span>
                  </div>
                )}
              </div>
            </Paper>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} slots={{ transition: Zoom }} maxWidth="xs" fullWidth>
        <DialogTitle className="flex justify-between items-center pr-3"><span>{editing ? `Edit ${editing.name}` : 'Create Fund'}</span><IconButton onClick={() => setCreateOpen(false)} size="small"><X className="w-5 h-5" /></IconButton></DialogTitle>
        <DialogContent className="space-y-4">
          <div className="space-y-1"><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Fund name *</span>
            <TextField hiddenLabel fullWidth size="small" placeholder="e.g. Building Painting Fund" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="space-y-1"><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Category</span>
            <FormControl fullWidth size="small"><Select disabled={!!editing} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{CATEGORIES.map(c => <MenuItem key={c.v} value={c.v}>{c.l}</MenuItem>)}</Select></FormControl>
            <p className="text-[11px] text-slate-500 mt-1">Every fund gets its own ledger account, whatever the category. Next step: point a charge head at it.</p>
          </div>
          <div className="space-y-1"><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Target amount (₹, optional)</span>
            <TextField hiddenLabel fullWidth size="small" type="number" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} /></div>
          <div className="space-y-1"><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Description</span>
            <TextField hiddenLabel fullWidth size="small" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
        </DialogContent>
        <DialogActions className="p-5 pt-0 gap-2">
          <Button onClick={() => setCreateOpen(false)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
          <Button onClick={create} disabled={creating || !form.name} variant="contained" fullWidth className="py-2.5 font-bold">{creating ? <CircularProgress size={18} color="inherit" /> : editing ? 'Save' : 'Create'}</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
