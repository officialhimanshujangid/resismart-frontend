'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  Paper, Button, TextField, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, FormControl, Select, MenuItem, Zoom,
} from '@mui/material';
import { Plus, Landmark, PiggyBank, Briefcase, TrendingUp, X, RefreshCw } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

interface Fund { _id: string; name: string; category: string; description?: string; currentBalancePaise: number; targetAmountPaise?: number; ledgerAccountId?: string; }

const rupees = (p?: number) => `₹${((p || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
// Categories that are ledger-backed (auto-reconcile from the general ledger).
const LEDGER_BACKED = ['CORPUS', 'SINKING', 'REPAIR'];
const CATEGORIES = [
  { v: 'CORPUS', l: 'Corpus Fund' }, { v: 'SINKING', l: 'Sinking / Reserve Fund' },
  { v: 'REPAIR', l: 'Repair & Maintenance Fund' }, { v: 'SPECIAL', l: 'Special Purpose Fund' }, { v: 'GENERAL', l: 'General Fund' },
];

export default function FundsPage() {
  const { showToast } = useToastConfirm();
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'CORPUS', description: '', target: '' });

  const load = async () => {
    try { setLoading(true); const res = await api.get('/finance/society/funds'); setFunds(res.data); }
    catch (e: any) { showToast(e.response?.data?.error || 'Failed to load funds', 'error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const reconcile = async () => {
    setReconciling(true);
    try { const res = await api.post('/finance/society/funds/reconcile'); setFunds(res.data.funds); showToast(`Reconciled ${res.data.reconciled} fund(s) from the ledger`, 'success'); }
    catch (e: any) { showToast(e.response?.data?.error || 'Reconcile failed', 'error'); }
    finally { setReconciling(false); }
  };

  const create = async () => {
    setCreating(true);
    try {
      await api.post('/finance/society/funds', { name: form.name, category: form.category, description: form.description || undefined, targetAmountPaise: form.target ? Math.round(parseFloat(form.target) * 100) : 0 });
      showToast('Fund created', 'success'); setCreateOpen(false); setForm({ name: '', category: 'CORPUS', description: '', target: '' }); load();
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to create fund', 'error'); }
    finally { setCreating(false); }
  };

  const total = funds.reduce((s, f) => s + (f.currentBalancePaise || 0), 0);
  const icon = (c: string) => c === 'CORPUS' ? <Briefcase className="w-5 h-5 text-indigo-500" /> : c === 'SINKING' ? <PiggyBank className="w-5 h-5 text-emerald-500" /> : <Landmark className="w-5 h-5 text-blue-500" />;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-black text-slate-800 tracking-tight">Funds Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Corpus, sinking and reserve funds — balances flow from the ledger</p></div>
        <div className="flex gap-2">
          <Button onClick={reconcile} disabled={reconciling} variant="outlined" startIcon={reconciling ? <CircularProgress size={16} /> : <RefreshCw className="w-4 h-4" />}>Reconcile</Button>
          <Button onClick={() => setCreateOpen(true)} variant="contained" startIcon={<Plus className="w-4 h-4" />}>Create Fund</Button>
        </div>
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
                <div><p className="font-bold text-slate-800">{f.name}</p><p className="text-xs text-slate-500 mt-0.5">{f.category}{LEDGER_BACKED.includes(f.category) ? ' · ledger-backed' : ' · manual'}</p></div>
                {icon(f.category)}
              </div>
              <div className="p-4 space-y-3">
                <div><p className="text-xs text-slate-500 mb-1">Current Balance</p><p className="text-2xl font-black text-slate-800">{rupees(f.currentBalancePaise)}</p></div>
                {!!f.targetAmountPaise && f.targetAmountPaise > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs"><span className="text-slate-500">Target: {rupees(f.targetAmountPaise)}</span><span className="font-semibold text-slate-700">{Math.min(100, Math.round((f.currentBalancePaise / f.targetAmountPaise) * 100))}%</span></div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, (f.currentBalancePaise / f.targetAmountPaise) * 100)}%` }} /></div>
                  </div>
                )}
                {!LEDGER_BACKED.includes(f.category) && <div className="text-[11px] text-amber-600 flex items-center gap-1"><TrendingUp className="w-3 h-3" />Balance updated via manual ledger entries</div>}
              </div>
            </Paper>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} slots={{ transition: Zoom }} maxWidth="xs" fullWidth>
        <DialogTitle className="flex justify-between items-center pr-3"><span>Create Fund</span><IconButton onClick={() => setCreateOpen(false)} size="small"><X className="w-5 h-5" /></IconButton></DialogTitle>
        <DialogContent className="space-y-4">
          <div className="space-y-1"><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Fund name *</span>
            <TextField hiddenLabel fullWidth size="small" placeholder="e.g. Building Painting Fund" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="space-y-1"><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Category</span>
            <FormControl fullWidth size="small"><Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{CATEGORIES.map(c => <MenuItem key={c.v} value={c.v}>{c.l}</MenuItem>)}</Select></FormControl>
            {LEDGER_BACKED.includes(form.category) && <p className="text-[11px] text-emerald-600 mt-1">This fund auto-reconciles from its ledger account.</p>}
          </div>
          <div className="space-y-1"><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Target amount (₹, optional)</span>
            <TextField hiddenLabel fullWidth size="small" type="number" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} /></div>
          <div className="space-y-1"><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Description</span>
            <TextField hiddenLabel fullWidth size="small" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
        </DialogContent>
        <DialogActions className="p-5 pt-0 gap-2">
          <Button onClick={() => setCreateOpen(false)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
          <Button onClick={create} disabled={creating || !form.name} variant="contained" fullWidth className="py-2.5 font-bold">{creating ? <CircularProgress size={18} color="inherit" /> : 'Create'}</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
