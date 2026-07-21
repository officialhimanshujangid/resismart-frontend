'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  Paper, Button, TextField, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, FormControl, Select, MenuItem, Zoom,
} from '@mui/material';
import { Plus, Landmark, PiggyBank, Briefcase, TrendingUp, X, Info, Pencil } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { DataTable, ColumnDef } from '@/components/common/DataTable';

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

  const money = (p?: number, tone = 'text-slate-700') =>
    <span className={`text-sm font-semibold font-mono tabular-nums ${tone}`}>{rupees(p)}</span>;

  const fundColumns: ColumnDef<Fund>[] = [
    {
      id: 'name', label: 'Fund', alwaysVisible: true,
      sortValue: f => f.name,
      exportValue: f => f.name,
      render: f => (
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="shrink-0">{icon(f.category)}</div>
          <div className="min-w-0">
            <p className="font-bold text-slate-800 truncate">{f.name}</p>
            <p className="text-[11px] text-slate-400">
              {CATEGORIES.find(c => c.v === f.category)?.l || f.category}
              {f.ledgerAccountCode && ` · a/c ${f.ledgerAccountCode}`}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'balance', label: 'Balance', align: 'right', alwaysVisible: true,
      sortValue: f => f.currentBalancePaise,
      exportValue: f => (f.currentBalancePaise || 0) / 100,
      render: f => (
        <div>
          {money(f.currentBalancePaise, f.currentBalancePaise < 0 ? 'text-red-600' : 'text-slate-800')}
          {f.currentBalancePaise < 0 && (
            <p className="text-[10px] text-red-600 font-semibold">overspent</p>
          )}
        </div>
      ),
    },
    {
      id: 'target', label: 'Target', align: 'right',
      sortValue: f => f.targetAmountPaise || 0,
      exportValue: f => (f.targetAmountPaise || 0) / 100,
      render: f => f.targetAmountPaise
        ? money(f.targetAmountPaise, 'text-slate-500')
        : <span className="text-[11px] text-slate-300">none</span>,
    },
    {
      id: 'progress', label: 'Raised',
      // Against what has been DEMANDED, not the balance. A fund that raised its
      // target and then paid the contractor has a small balance and is still
      // fully raised — reading the balance instead would have the society chase
      // members who owe nothing.
      sortValue: f => (f.targetAmountPaise ? raisedPct(f) : -1),
      exportValue: f => (f.targetAmountPaise ? `${raisedPct(f)}%` : ''),
      render: f => {
        if (!f.targetAmountPaise) return <span className="text-[11px] text-slate-300">—</span>;
        const over = (f.overRaisedPaise || 0) > 0;
        return (
          <div className="min-w-[7rem]">
            <div className="flex justify-between text-[11px] mb-1">
              <span className={`font-bold ${over ? 'text-red-600' : 'text-slate-600'}`}>{raisedPct(f)}%</span>
              {(f.remainingToRaisePaise || 0) > 0 && (
                <span className="text-amber-700">{rupees(f.remainingToRaisePaise)} to go</span>
              )}
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ width: `${Math.min(100, raisedPct(f))}%` }} />
            </div>
            {over && (
              <p className="text-[10px] text-red-700 mt-1">{rupees(f.overRaisedPaise)} over-billed</p>
            )}
          </div>
        );
      },
    },
    {
      id: 'billed', label: 'Billed', align: 'right', defaultHidden: true,
      sortValue: f => f.raisedPaise || 0,
      exportValue: f => (f.raisedPaise || 0) / 100,
      render: f => money(f.raisedPaise),
    },
    {
      id: 'received', label: 'Received', align: 'right',
      sortValue: f => f.collectedPaise || 0,
      exportValue: f => (f.collectedPaise || 0) / 100,
      render: f => (
        <div>
          {money(f.collectedPaise, 'text-emerald-700')}
          {(f.raisedPaise || 0) > (f.collectedPaise || 0) && (
            <p className="text-[10px] text-slate-400">
              {rupees((f.raisedPaise || 0) - (f.collectedPaise || 0))} unpaid
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'spent', label: 'Spent', align: 'right',
      sortValue: f => f.spentPaise || 0,
      exportValue: f => (f.spentPaise || 0) / 100,
      render: f => money(f.spentPaise),
    },
    {
      id: 'fedby', label: 'Collected by',
      exportValue: f => feedersFor(f._id).map(h => h.name).join('; '),
      render: f => {
        const heads = feedersFor(f._id);
        return heads.length
          ? <span className="text-[11px] text-emerald-700 flex items-start gap-1">
              <TrendingUp className="w-3 h-3 mt-px shrink-0" />{heads.map(h => h.name).join(', ')}
            </span>
          : <span className="text-[11px] text-amber-600 font-semibold">nothing feeds it</span>;
      },
    },
    {
      id: 'act', label: '', align: 'right', alwaysVisible: true,
      render: f => (
        <IconButton size="small" onClick={() => openEdit(f)} title="Edit fund">
          <Pencil className="w-4 h-4 text-slate-400" />
        </IconButton>
      ),
    },
  ];

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

      <DataTable
        columns={fundColumns}
        data={funds}
        loading={loading}
        keyExtractor={f => f._id}
        exportFileName="funds"
        columnToggle
        emptyTitle="No funds yet"
        emptyText="Create a Corpus or Sinking fund to start tracking reserves."
        emptyIcon={<PiggyBank className="w-6 h-6" />}
      />

      {/* The funds that nothing feeds. Said once, above the table, rather than
          repeated inside every row — an empty fund reads as a mistake, and the
          reason (no charge head points at it) belongs where it can be acted on. */}
      {!loading && funds.some(f => feedersFor(f._id).length === 0) && (
        <div className="rounded-xl bg-amber-50 border border-amber-200/70 p-3 flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 leading-relaxed">
            <strong>{funds.filter(f => feedersFor(f._id).length === 0).map(f => f.name).join(', ')}</strong>{' '}
            {funds.filter(f => feedersFor(f._id).length === 0).length === 1 ? 'has' : 'have'} no charge head
            collecting into {funds.filter(f => feedersFor(f._id).length === 0).length === 1 ? 'it' : 'them'} —
            so {funds.filter(f => feedersFor(f._id).length === 0).length === 1 ? 'it' : 'they'} will stay at ₹0
            forever. Set one up in <strong>Charge Heads</strong>.
          </p>
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
