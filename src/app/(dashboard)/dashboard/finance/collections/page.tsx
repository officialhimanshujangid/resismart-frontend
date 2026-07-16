'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import {
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  CircularProgress, TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  TablePagination, Paper, Zoom, FormControl, Select, MenuItem, Autocomplete,
} from '@mui/material';
import { Plus, X, Download, CheckCircle2, XCircle, RotateCcw, Banknote } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

interface Receipt {
  _id: string; receiptNumber: string; flatNumber: string; blockName: string;
  mode: string; amountPaise: number; advanceCreatedPaise: number; status: string;
  receiptDate: string; allocations: { invoiceNumber: string; appliedPaise: number }[];
  instrument?: { chequeNo?: string }; referenceNote?: string;
}
interface FlatOpt { _id: string; number: string; blockName: string; }

const rupees = (p?: number) => `₹${((p || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const STATUS: Record<string, string> = {
  CLEARED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  PENDING_CONFIRMATION: 'bg-amber-50 text-amber-700 border-amber-100',
  BOUNCED: 'bg-red-50 text-red-700 border-red-100',
  REJECTED: 'bg-slate-100 text-slate-500 border-slate-200',
  REVERSED: 'bg-slate-100 text-slate-500 border-slate-200',
  INITIATED: 'bg-blue-50 text-blue-700 border-blue-100',
};

export default function CollectionsPage() {
  const { showToast } = useToastConfirm();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [reasonTarget, setReasonTarget] = useState<{ receipt: Receipt; action: 'reject' | 'bounce' } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const [recOpen, setRecOpen] = useState(false);
  const [flats, setFlats] = useState<FlatOpt[]>([]);
  const [flat, setFlat] = useState<FlatOpt | null>(null);
  const [outstanding, setOutstanding] = useState<number | null>(null);
  const [rec, setRec] = useState({ mode: 'CASH', amount: '', referenceNote: '', chequeNo: '', bankName: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page + 1), pageSize: String(pageSize) });
      if (status) params.append('status', status);
      const res = await api.get(`/finance/society/collections/receipts?${params.toString()}`);
      setReceipts(res.data.receipts);
      setTotal(res.data.pagination?.total ?? 0);
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to load receipts', 'error'); }
    finally { setLoading(false); }
  }, [page, pageSize, status, showToast]);
  useEffect(() => { load(); }, [load]);

  const openRecord = async () => {
    setRec({ mode: 'CASH', amount: '', referenceNote: '', chequeNo: '', bankName: '' });
    setFlat(null); setOutstanding(null); setRecOpen(true);
    try { const res = await api.get('/societies/flats'); setFlats(res.data.flats || []); } catch { /* ignore */ }
  };

  const pickFlat = async (f: FlatOpt | null) => {
    setFlat(f); setOutstanding(null);
    if (!f) return;
    try { const res = await api.get(`/finance/society/collections/flat/${f._id}/outstanding`); setOutstanding(res.data.totalOutstandingPaise); }
    catch { setOutstanding(null); }
  };

  const submitRecord = async () => {
    if (!flat) { showToast('Select a flat', 'error'); return; }
    setSaving(true);
    try {
      await api.post('/finance/society/collections/record', {
        flatId: flat._id, mode: rec.mode, amountPaise: Math.round(parseFloat(rec.amount || '0') * 100),
        referenceNote: rec.referenceNote || undefined,
        instrument: rec.mode === 'CHEQUE' ? { chequeNo: rec.chequeNo, bankName: rec.bankName } : undefined,
      });
      showToast('Payment recorded', 'success'); setRecOpen(false); setPage(0); load();
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to record payment', 'error'); }
    finally { setSaving(false); }
  };

  const DONE: Record<string, string> = {
    confirm: 'Receipt confirmed', reject: 'Receipt rejected',
    bounce: 'Receipt bounced', deposit: 'Cheque deposited to bank',
  };

  const post = async (r: Receipt, action: 'confirm' | 'reject' | 'bounce' | 'deposit', body: any = {}) => {
    try { await api.post(`/finance/society/collections/receipts/${r._id}/${action}`, body); showToast(DONE[action], 'success'); load(); return true; }
    catch (e: any) { showToast(e.response?.data?.error || `Failed to ${action}`, 'error'); return false; }
  };

  const act = (r: Receipt, action: 'confirm' | 'reject' | 'bounce' | 'deposit') => {
    // Reject and bounce both need a written reason — collect it in the dialog below.
    if (action === 'reject' || action === 'bounce') { setReasonTarget({ receipt: r, action }); setReason(''); return; }
    post(r, action);
  };

  const submitReason = async () => {
    if (!reasonTarget || !reason.trim()) return;
    const { receipt, action } = reasonTarget;
    setBusy(true);
    // The two endpoints name the field differently: reject wants `rejectionReason`, bounce wants `reason`.
    const ok = await post(receipt, action, action === 'reject' ? { rejectionReason: reason } : { reason });
    setBusy(false);
    if (ok) { setReasonTarget(null); setReason(''); }
  };

  const pdf = async (r: Receipt) => {
    try { const res = await api.get(`/finance/society/collections/receipts/${r._id}/pdf`); if (res.data?.url) window.open(res.data.url, '_blank'); }
    catch (e: any) { showToast(e.response?.data?.error || 'Failed to get PDF', 'error'); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Collections</h1>
          <p className="text-sm text-slate-500 mt-0.5">Record payments and manage receipts</p>
        </div>
        <Button onClick={openRecord} variant="contained" startIcon={<Plus className="w-4 h-4" />} sx={{ whiteSpace: 'nowrap' }}>Record Payment</Button>
      </div>

      <div className="flex gap-2">
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <Select displayEmpty value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}>
            <MenuItem value="">All statuses</MenuItem>
            {['CLEARED', 'PENDING_CONFIRMATION', 'BOUNCED', 'REJECTED', 'INITIATED'].map(s => <MenuItem key={s} value={s}>{s.replace(/_/g, ' ')}</MenuItem>)}
          </Select>
        </FormControl>
      </div>

      <TableContainer component={Paper} elevation={1} className="rounded-2xl border border-slate-200/60 shadow-sm overflow-x-auto">
        {loading ? <div className="flex justify-center py-20 bg-white"><CircularProgress size={32} /></div>
          : receipts.length === 0 ? <div className="text-center py-20 text-slate-400 font-semibold text-sm bg-white">No receipts yet.</div>
          : (
            <Table sx={{ minWidth: 900 }}>
              <TableHead><TableRow>
                <TableCell>Receipt #</TableCell><TableCell>Flat</TableCell><TableCell>Mode</TableCell>
                <TableCell align="right">Amount</TableCell><TableCell>Applied</TableCell><TableCell>Date</TableCell>
                <TableCell>Status</TableCell><TableCell align="right">Actions</TableCell>
              </TableRow></TableHead>
              <TableBody className="bg-white">
                {receipts.map(r => (
                  <TableRow key={r._id}>
                    <TableCell className="font-mono text-xs font-bold text-slate-700">{r.receiptNumber}</TableCell>
                    <TableCell className="font-bold text-slate-800">{r.flatNumber}<span className="text-slate-400 font-normal text-xs"> · {r.blockName}</span></TableCell>
                    <TableCell className="text-slate-600">{r.mode}</TableCell>
                    <TableCell align="right" className="font-bold text-slate-800">{rupees(r.amountPaise)}</TableCell>
                    <TableCell className="text-xs text-slate-500">{r.allocations?.length || 0} inv{r.advanceCreatedPaise > 0 ? ` +adv ${rupees(r.advanceCreatedPaise)}` : ''}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{new Date(r.receiptDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</TableCell>
                    <TableCell><span className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-black border ${STATUS[r.status]}`}>{r.status.replace(/_/g, ' ')}</span></TableCell>
                    <TableCell align="right">
                      <div className="flex items-center justify-end gap-1">
                        {r.status === 'PENDING_CONFIRMATION' && <>
                          <IconButton onClick={() => act(r, 'confirm')} size="small" className="bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 text-slate-500 rounded-xl p-2"><CheckCircle2 className="w-4 h-4" /></IconButton>
                          <IconButton onClick={() => act(r, 'reject')} size="small" className="bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-500 rounded-xl p-2"><XCircle className="w-4 h-4" /></IconButton>
                        </>}
                        {r.status === 'CLEARED' && <>
                          {r.mode === 'CHEQUE' && <IconButton title="Deposit cheque to bank" onClick={() => act(r, 'deposit')} size="small" className="bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-500 rounded-xl p-2"><Banknote className="w-4 h-4" /></IconButton>}
                          <IconButton title="Bounce / reverse" onClick={() => act(r, 'bounce')} size="small" className="bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-500 rounded-xl p-2"><RotateCcw className="w-4 h-4" /></IconButton>
                          <IconButton onClick={() => pdf(r)} size="small" className="bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-500 rounded-xl p-2"><Download className="w-4 h-4" /></IconButton>
                        </>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={pageSize} onRowsPerPageChange={e => { setPageSize(parseInt(e.target.value, 10)); setPage(0); }} rowsPerPageOptions={[10, 20, 50]} />
      </TableContainer>

      {/* Record payment dialog */}
      <Dialog open={recOpen} onClose={() => setRecOpen(false)} slots={{ transition: Zoom }} maxWidth="xs" fullWidth>
        <DialogTitle className="flex justify-between items-center pr-3">
          <span className="flex items-center gap-2"><Banknote className="w-5 h-5 text-emerald-600" />Record Payment</span>
          <IconButton onClick={() => setRecOpen(false)} size="small"><X className="w-5 h-5" /></IconButton>
        </DialogTitle>
        <DialogContent className="space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Flat *</span>
            <Autocomplete size="small" options={flats} value={flat} onChange={(_, v) => pickFlat(v)}
              getOptionLabel={(o) => `${o.number} · ${o.blockName}`} isOptionEqualToValue={(a, b) => a._id === b._id}
              renderInput={(p) => <TextField {...p} hiddenLabel placeholder="Select flat" />} />
            {outstanding !== null && <p className="text-xs text-amber-600 font-semibold mt-1">Outstanding dues: {rupees(outstanding)}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Mode</span>
              <FormControl fullWidth size="small"><Select value={rec.mode} onChange={e => setRec(r => ({ ...r, mode: e.target.value }))}>{['CASH', 'CHEQUE', 'UPI', 'BANK_TRANSFER', 'OTHER'].map(m => <MenuItem key={m} value={m}>{m.replace(/_/g, ' ')}</MenuItem>)}</Select></FormControl>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Amount (₹)</span>
              <TextField hiddenLabel fullWidth size="small" type="number" value={rec.amount} onChange={e => setRec(r => ({ ...r, amount: e.target.value }))} />
            </div>
          </div>
          {rec.mode === 'CHEQUE' && (
            <div className="grid grid-cols-2 gap-3">
              <TextField hiddenLabel size="small" placeholder="Cheque no." value={rec.chequeNo} onChange={e => setRec(r => ({ ...r, chequeNo: e.target.value }))} />
              <TextField hiddenLabel size="small" placeholder="Bank" value={rec.bankName} onChange={e => setRec(r => ({ ...r, bankName: e.target.value }))} />
            </div>
          )}
          <TextField hiddenLabel fullWidth size="small" placeholder="Reference / note (UTR, etc.)" value={rec.referenceNote} onChange={e => setRec(r => ({ ...r, referenceNote: e.target.value }))} />
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800">The amount is applied to the oldest outstanding invoices first; any surplus becomes advance credit.</div>
        </DialogContent>
        <DialogActions className="p-5 pt-0 gap-2">
          <Button onClick={() => setRecOpen(false)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
          <Button onClick={submitRecord} disabled={saving} variant="contained" fullWidth className="py-2.5 font-bold">{saving ? <CircularProgress size={18} color="inherit" /> : 'Record'}</Button>
        </DialogActions>
      </Dialog>

      {/* Reject / bounce reason */}
      <Dialog open={!!reasonTarget} onClose={() => setReasonTarget(null)} slots={{ transition: Zoom }} maxWidth="xs" fullWidth>
        <DialogTitle className="flex justify-between items-center pr-3">
          <span>{reasonTarget?.action === 'bounce' ? 'Bounce / reverse receipt' : 'Reject payment'}</span>
          <IconButton onClick={() => setReasonTarget(null)} size="small"><X className="w-5 h-5" /></IconButton>
        </DialogTitle>
        <DialogContent className="space-y-2">
          {reasonTarget?.action === 'bounce' && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-800">
              Reversing {reasonTarget.receipt.receiptNumber} will reopen the invoices it paid.
            </div>
          )}
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Reason *</span>
          <TextField
            hiddenLabel fullWidth multiline rows={3}
            placeholder={reasonTarget?.action === 'bounce' ? 'Why is this receipt being reversed?' : 'Why is this payment being rejected?'}
            value={reason} onChange={e => setReason(e.target.value)}
            slotProps={reasonTarget?.action === 'bounce' ? { htmlInput: { maxLength: 300 } } : undefined}
          />
        </DialogContent>
        <DialogActions className="p-5 pt-0 gap-2">
          <Button onClick={() => setReasonTarget(null)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
          <Button onClick={submitReason} disabled={!reason.trim() || busy} variant="contained" color="error" fullWidth className="py-2.5 font-bold">
            {busy ? <CircularProgress size={18} color="inherit" /> : reasonTarget?.action === 'bounce' ? 'Reverse' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
