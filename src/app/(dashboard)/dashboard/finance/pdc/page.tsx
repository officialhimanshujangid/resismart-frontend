'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import {
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  CircularProgress, TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  Paper, Zoom, FormControl, Select, MenuItem, Autocomplete,
} from '@mui/material';
import { Plus, X, Banknote, CheckCircle2, RotateCcw, Undo2 } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

type PdcStatus = 'HELD' | 'DEPOSITED' | 'CLEARED' | 'BOUNCED' | 'RETURNED';

interface Pdc {
  _id: string; flatId?: string; flat?: string; payerName: string;
  chequeNo: string; bankName: string; chequeDate: string; amountPaise: number;
  status: PdcStatus; receiptId?: string; notes?: string;
  dueThisWeek: boolean; overdue: boolean;
}
interface FlatOpt { _id: string; number: string; blockName: string }

const rupees = (p?: number) => `₹${((p || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const shortDate = (d?: string) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—');

const STATUS: Record<PdcStatus, string> = {
  HELD: 'bg-blue-50 text-blue-700 border-blue-100',
  DEPOSITED: 'bg-amber-50 text-amber-700 border-amber-100',
  CLEARED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  BOUNCED: 'bg-red-50 text-red-700 border-red-100',
  RETURNED: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function PdcPage() {
  const { showToast } = useToastConfirm();
  const [rows, setRows] = useState<Pdc[]>([]);
  const [summary, setSummary] = useState({ heldPaise: 0, heldCount: 0, dueThisWeekPaise: 0, dueThisWeekCount: 0, overdueCount: 0 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  const [open, setOpen] = useState(false);
  const [flats, setFlats] = useState<FlatOpt[]>([]);
  const [flat, setFlat] = useState<FlatOpt | null>(null);
  const [form, setForm] = useState({ payerName: '', chequeNo: '', bankName: '', chequeDate: '', amount: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      const res = await api.get(`/finance/society/pdc?${params.toString()}`);
      setRows(res.data.rows || []);
      setSummary({
        heldPaise: res.data.heldPaise || 0, heldCount: res.data.heldCount || 0,
        dueThisWeekPaise: res.data.dueThisWeekPaise || 0, dueThisWeekCount: res.data.dueThisWeekCount || 0,
        overdueCount: res.data.overdueCount || 0,
      });
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to load the register', 'error'); }
    finally { setLoading(false); }
  }, [status, showToast]);
  useEffect(() => { load(); }, [load]);

  const openAdd = async () => {
    setForm({ payerName: '', chequeNo: '', bankName: '', chequeDate: '', amount: '', notes: '' });
    setFlat(null); setOpen(true);
    try { const res = await api.get('/societies/flats'); setFlats(res.data.flats || []); } catch { /* ignore */ }
  };

  const submit = async () => {
    setSaving(true);
    try {
      await api.post('/finance/society/pdc', {
        flatId: flat?._id,
        payerName: form.payerName,
        chequeNo: form.chequeNo,
        bankName: form.bankName,
        chequeDate: form.chequeDate,
        amountPaise: Math.round(parseFloat(form.amount || '0') * 100),
        notes: form.notes || undefined,
      });
      showToast('Cheque added to the register', 'success');
      setOpen(false); load();
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to register the cheque', 'error'); }
    finally { setSaving(false); }
  };

  const deposit = async (p: Pdc) => {
    try { await api.post(`/finance/society/pdc/${p._id}/deposit`, {}); showToast('Cheque deposited — receipt raised', 'success'); load(); }
    catch (e: any) { showToast(e.response?.data?.error || 'Failed to deposit', 'error'); }
  };

  const setStatusOf = async (p: Pdc, next: PdcStatus) => {
    try { await api.post(`/finance/society/pdc/${p._id}/status`, { status: next }); showToast(`Cheque marked ${next.toLowerCase()}`, 'success'); load(); }
    catch (e: any) { showToast(e.response?.data?.error || 'Failed to update', 'error'); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Post-dated Cheques</h1>
          <p className="text-sm text-slate-500 mt-0.5">Cheques the society is holding for a future date</p>
        </div>
        <Button onClick={openAdd} variant="contained" startIcon={<Plus className="w-4 h-4" />} sx={{ whiteSpace: 'nowrap' }}>Add Cheque</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200/60 rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Held in the drawer</p>
          <p className="text-xl font-black text-slate-800 mt-1">{rupees(summary.heldPaise)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{summary.heldCount} cheque{summary.heldCount === 1 ? '' : 's'} · not on the books</p>
        </div>
        <div className="bg-white border border-amber-200 rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-amber-600">Due this week</p>
          <p className="text-xl font-black text-amber-700 mt-1">{rupees(summary.dueThisWeekPaise)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{summary.dueThisWeekCount} ready to bank</p>
        </div>
        <div className="bg-white border border-slate-200/60 rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Past their date</p>
          <p className={`text-xl font-black mt-1 ${summary.overdueCount ? 'text-red-600' : 'text-slate-800'}`}>{summary.overdueCount}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">bankable but still held</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800">
        A held cheque is a promise, not money — nothing reaches the ledger until you deposit it. Depositing raises a real receipt against the flat&apos;s dues.
      </div>

      <div className="flex gap-2">
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <Select displayEmpty value={status} onChange={e => setStatus(e.target.value)}>
            <MenuItem value="">All statuses</MenuItem>
            {(Object.keys(STATUS) as PdcStatus[]).map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FormControl>
      </div>

      <TableContainer component={Paper} elevation={1} className="rounded-2xl border border-slate-200/60 shadow-sm overflow-x-auto">
        {loading ? <div className="flex justify-center py-20 bg-white"><CircularProgress size={32} /></div>
          : rows.length === 0 ? <div className="text-center py-20 text-slate-400 font-semibold text-sm bg-white">No cheques in the register.</div>
          : (
            <Table sx={{ minWidth: 960 }}>
              <TableHead><TableRow>
                <TableCell>Cheque #</TableCell><TableCell>Bank</TableCell><TableCell>Payer</TableCell>
                <TableCell>Flat</TableCell><TableCell>Dated</TableCell>
                <TableCell align="right">Amount</TableCell><TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow></TableHead>
              <TableBody className="bg-white">
                {rows.map(p => (
                  <TableRow key={p._id} className={p.dueThisWeek ? 'bg-amber-50/60' : ''}>
                    <TableCell className="font-mono text-xs font-bold text-slate-700">{p.chequeNo}</TableCell>
                    <TableCell className="text-slate-600 text-sm">{p.bankName}</TableCell>
                    <TableCell className="text-slate-600 text-sm">{p.payerName}</TableCell>
                    <TableCell className="text-slate-500 text-xs">{p.flat || '—'}</TableCell>
                    <TableCell className="font-mono text-xs">
                      <span className={p.overdue ? 'text-red-600 font-bold' : p.dueThisWeek ? 'text-amber-700 font-bold' : 'text-slate-500'}>{shortDate(p.chequeDate)}</span>
                      {p.dueThisWeek && <span className="text-[9px] uppercase font-black text-amber-600 block">due this week</span>}
                      {p.overdue && <span className="text-[9px] uppercase font-black text-red-500 block">bankable now</span>}
                    </TableCell>
                    <TableCell align="right" className="font-bold text-slate-800">{rupees(p.amountPaise)}</TableCell>
                    <TableCell><span className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-black border ${STATUS[p.status]}`}>{p.status}</span></TableCell>
                    <TableCell align="right">
                      <div className="flex items-center justify-end gap-1">
                        {p.status === 'HELD' && <>
                          <IconButton title="Deposit — raises the receipt" onClick={() => deposit(p)} size="small" className="bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 text-slate-500 rounded-xl p-2"><Banknote className="w-4 h-4" /></IconButton>
                          <IconButton title="Hand back undeposited" onClick={() => setStatusOf(p, 'RETURNED')} size="small" className="bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl p-2"><Undo2 className="w-4 h-4" /></IconButton>
                        </>}
                        {p.status === 'DEPOSITED' && <>
                          <IconButton title="Bank cleared it" onClick={() => setStatusOf(p, 'CLEARED')} size="small" className="bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 text-slate-500 rounded-xl p-2"><CheckCircle2 className="w-4 h-4" /></IconButton>
                          <IconButton title="Bounced — reverses the receipt" onClick={() => setStatusOf(p, 'BOUNCED')} size="small" className="bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-500 rounded-xl p-2"><RotateCcw className="w-4 h-4" /></IconButton>
                        </>}
                        {p.status === 'CLEARED' && (
                          <IconButton title="Bounced — reverses the receipt" onClick={() => setStatusOf(p, 'BOUNCED')} size="small" className="bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-500 rounded-xl p-2"><RotateCcw className="w-4 h-4" /></IconButton>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
      </TableContainer>

      {/* Add cheque */}
      <Dialog open={open} onClose={() => setOpen(false)} slots={{ transition: Zoom }} maxWidth="xs" fullWidth>
        <DialogTitle className="flex justify-between items-center pr-3">
          <span className="flex items-center gap-2"><Banknote className="w-5 h-5 text-blue-600" />Add post-dated cheque</span>
          <IconButton onClick={() => setOpen(false)} size="small"><X className="w-5 h-5" /></IconButton>
        </DialogTitle>
        <DialogContent className="space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Flat</span>
            <Autocomplete size="small" options={flats} value={flat} onChange={(_, v) => setFlat(v)}
              getOptionLabel={(o) => `${o.number} · ${o.blockName}`} isOptionEqualToValue={(a, b) => a._id === b._id}
              renderInput={(p) => <TextField {...p} hiddenLabel placeholder="Select flat" />} />
            <p className="text-[11px] text-slate-400">Needed before the cheque can be deposited — the receipt is raised against this flat&apos;s dues.</p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Payer *</span>
            <TextField hiddenLabel fullWidth size="small" placeholder="Name on the cheque"
              value={form.payerName} onChange={e => setForm(f => ({ ...f, payerName: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Cheque no. *</span>
              <TextField hiddenLabel fullWidth size="small" value={form.chequeNo} onChange={e => setForm(f => ({ ...f, chequeNo: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Bank *</span>
              <TextField hiddenLabel fullWidth size="small" value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Cheque date *</span>
              <TextField hiddenLabel fullWidth size="small" type="date" value={form.chequeDate} onChange={e => setForm(f => ({ ...f, chequeDate: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Amount (₹) *</span>
              <TextField hiddenLabel fullWidth size="small" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
          </div>
          <TextField hiddenLabel fullWidth size="small" placeholder="Notes (optional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
            Adding a cheque records it only. It posts nothing to the ledger until you deposit it on or after its date.
          </div>
        </DialogContent>
        <DialogActions className="p-5 pt-0 gap-2">
          <Button onClick={() => setOpen(false)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
          <Button onClick={submit} disabled={saving || !form.payerName.trim() || !form.chequeNo.trim() || !form.bankName.trim() || !form.chequeDate || !form.amount}
            variant="contained" fullWidth className="py-2.5 font-bold">
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}