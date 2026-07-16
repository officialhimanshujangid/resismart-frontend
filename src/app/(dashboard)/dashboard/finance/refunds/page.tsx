'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import {
  Paper, Button, TextField, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, FormControl, Select, MenuItem, Zoom, Autocomplete, Table, TableHead, TableBody,
  TableRow, TableCell, TableContainer, TablePagination,
} from '@mui/material';
import { Plus, X, Info, Check, Ban } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

interface Flat { _id: string; number: string; blockName: string }
interface Refund {
  _id: string; blockName: string; flatNumber: string; amountPaise: number;
  mode: string; reason: string; status: 'PENDING_APPROVAL' | 'PAID' | 'REJECTED';
  requestedByName: string; approvedByName?: string; rejectionReason?: string;
  createdAt: string; paidOn?: string;
}

const rupees = (p?: number) => `₹${((p || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const shortDate = (d?: string) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—');
const STATUS: Record<string, string> = {
  PENDING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-100',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  REJECTED: 'bg-red-50 text-red-700 border-red-100',
};

export default function RefundsPage() {
  const { showToast } = useToastConfirm();
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [rejectOf, setRejectOf] = useState<Refund | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(25);

  const [form, setForm] = useState({ flatId: '', amount: '', mode: 'BANK', reason: '' });
  const [advance, setAdvance] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [r, f] = await Promise.all([
        api.get('/finance/society/refunds'),
        api.get('/societies/flats'),
      ]);
      setRefunds(r.data || []);
      setFlats(f.data.flats || []);
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to load refunds', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);
  useEffect(() => { load(); }, [load]);

  /** Show what the flat actually holds — a refund can only ever be of advance credit. */
  const pickFlat = async (flatId: string) => {
    setForm(f => ({ ...f, flatId }));
    setAdvance(null);
    if (!flatId) return;
    try {
      const res = await api.get(`/finance/society/collections/flat/${flatId}/outstanding`);
      setAdvance(res.data.advanceBalancePaise ?? 0);
    } catch { /* the server re-checks on submit anyway */ }
  };

  const request = async () => {
    setSaving(true);
    try {
      const res = await api.post('/finance/society/refunds', {
        flatId: form.flatId,
        amountPaise: Math.round(parseFloat(form.amount || '0') * 100),
        mode: form.mode,
        reason: form.reason.trim(),
      });
      showToast(res.data.status === 'PAID' ? 'Refund paid' : 'Refund requested — it needs a second person to approve it', 'success');
      setOpen(false); setForm({ flatId: '', amount: '', mode: 'BANK', reason: '' }); setAdvance(null); load();
    } catch (e: any) { showToast(e.response?.data?.error || 'Could not request this refund', 'error'); }
    finally { setSaving(false); }
  };

  const pay = async (r: Refund) => {
    try { await api.post(`/finance/society/refunds/${r._id}/pay`); showToast('Refund approved and paid', 'success'); load(); }
    catch (e: any) { showToast(e.response?.data?.error || 'Could not pay this refund', 'error'); }
  };

  const doReject = async () => {
    if (!rejectOf) return;
    setSaving(true);
    try {
      await api.post(`/finance/society/refunds/${rejectOf._id}/reject`, { rejectionReason: rejectReason.trim() });
      showToast('Refund rejected', 'success');
      setRejectOf(null); setRejectReason(''); load();
    } catch (e: any) { showToast(e.response?.data?.error || 'Could not reject this refund', 'error'); }
    finally { setSaving(false); }
  };

  const rows = refunds.slice(page * rpp, page * rpp + rpp);
  const pending = refunds.filter(r => r.status === 'PENDING_APPROVAL').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Refunds</h1>
          <p className="text-sm text-slate-500 mt-0.5">Advance credit going back to a member</p>
        </div>
        <Button onClick={() => setOpen(true)} variant="contained" startIcon={<Plus className="w-4 h-4" />}>Request Refund</Button>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-800 flex gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          A refund can only ever return <b>advance credit</b> the society is holding — money paid ahead, or an overpayment.
          If your settings require approval, a refund waits for someone other than the person who asked for it: money
          leaving on one person&apos;s say-so is exactly what that rule exists to prevent.
        </span>
      </div>

      {pending > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-800 font-semibold">
          {pending} refund{pending === 1 ? '' : 's'} waiting for approval.
        </div>
      )}

      <TableContainer component={Paper} elevation={1} className="rounded-2xl border border-slate-200/60 shadow-sm overflow-x-auto">
        {loading ? <div className="flex justify-center py-16"><CircularProgress size={30} /></div>
          : refunds.length === 0 ? <div className="text-center py-16 text-slate-400 font-semibold text-sm">No refunds yet.</div>
          : (
            <Table sx={{ minWidth: 820 }}>
              <TableHead><TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Flat</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Amount</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Reason</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Requested by</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right"></TableCell>
              </TableRow></TableHead>
              <TableBody className="bg-white">
                {rows.map(r => (
                  <TableRow key={r._id}>
                    <TableCell className="font-semibold text-slate-700">{r.blockName} {r.flatNumber}</TableCell>
                    <TableCell align="right" className="font-black text-slate-800">{rupees(r.amountPaise)}</TableCell>
                    <TableCell className="text-slate-600 text-sm max-w-xs truncate">{r.reason}</TableCell>
                    <TableCell className="text-slate-500 text-xs">
                      {r.requestedByName}
                      <span className="block text-slate-400">{shortDate(r.createdAt)}</span>
                    </TableCell>
                    <TableCell>
                      <span className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-black border ${STATUS[r.status]}`}>{r.status.replace(/_/g, ' ')}</span>
                      {r.approvedByName && r.status === 'PAID' && <p className="text-[11px] text-slate-400 mt-0.5">by {r.approvedByName}</p>}
                      {r.rejectionReason && <p className="text-[11px] text-slate-400 mt-0.5">{r.rejectionReason}</p>}
                    </TableCell>
                    <TableCell align="right">
                      {r.status === 'PENDING_APPROVAL' && (
                        <>
                          <Button size="small" startIcon={<Check className="w-3.5 h-3.5" />} onClick={() => pay(r)} className="font-bold">Approve & pay</Button>
                          <Button size="small" color="error" startIcon={<Ban className="w-3.5 h-3.5" />} onClick={() => setRejectOf(r)} className="font-bold">Reject</Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        {!loading && refunds.length > 0 && (
          <TablePagination component="div" count={refunds.length} page={page} rowsPerPage={rpp}
            onPageChange={(_, p) => setPage(p)}
            onRowsPerPageChange={e => { setRpp(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[25, 50, 100]} />
        )}
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} slots={{ transition: Zoom }} maxWidth="xs" fullWidth>
        <DialogTitle className="flex justify-between items-center pr-3"><span>Request a refund</span><IconButton onClick={() => setOpen(false)} size="small"><X className="w-5 h-5" /></IconButton></DialogTitle>
        <DialogContent className="space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Flat *</span>
            <Autocomplete size="small" options={flats} getOptionLabel={f => `${f.blockName} ${f.number}`.trim()}
              value={flats.find(f => f._id === form.flatId) || null}
              onChange={(_, v) => pickFlat(v?._id || '')}
              renderInput={params => <TextField {...params} hiddenLabel placeholder="Select flat" />} />
            {advance !== null && (
              <p className={`text-[11px] mt-1 font-semibold ${advance > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {advance > 0 ? `${rupees(advance)} of advance credit available` : 'This flat holds no advance credit — there is nothing to refund'}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Amount (₹)</span>
              <TextField hiddenLabel fullWidth size="small" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Pay from</span>
              <FormControl fullWidth size="small">
                <Select value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value }))}>
                  <MenuItem value="BANK">Bank</MenuItem><MenuItem value="CASH">Cash</MenuItem>
                </Select>
              </FormControl>
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Reason *</span>
            <TextField hiddenLabel fullWidth size="small" multiline minRows={2} placeholder="Why is this being refunded?" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
          </div>
        </DialogContent>
        <DialogActions className="p-5 pt-0 gap-2">
          <Button onClick={() => setOpen(false)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
          <Button onClick={request} disabled={saving || !form.flatId || !form.amount || !form.reason.trim()} variant="contained" fullWidth className="py-2.5 font-bold">
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Request'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!rejectOf} onClose={() => setRejectOf(null)} slots={{ transition: Zoom }} maxWidth="xs" fullWidth>
        <DialogTitle className="flex justify-between items-center pr-3"><span>Reject refund</span><IconButton onClick={() => setRejectOf(null)} size="small"><X className="w-5 h-5" /></IconButton></DialogTitle>
        <DialogContent className="space-y-3">
          <p className="text-sm text-slate-600">{rejectOf?.blockName} {rejectOf?.flatNumber} · {rupees(rejectOf?.amountPaise)}</p>
          <TextField hiddenLabel fullWidth size="small" multiline minRows={2} placeholder="Why is this being rejected?" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
        </DialogContent>
        <DialogActions className="p-5 pt-0 gap-2">
          <Button onClick={() => setRejectOf(null)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
          <Button onClick={doReject} disabled={saving || !rejectReason.trim()} variant="contained" color="error" fullWidth className="py-2.5 font-bold">
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
