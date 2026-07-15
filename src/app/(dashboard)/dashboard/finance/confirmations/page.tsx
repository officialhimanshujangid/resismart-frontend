'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  Button, TableContainer, Table, TableHead, TableBody, TableRow, TableCell, Paper,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, Zoom,
} from '@mui/material';
import { CheckCircle2, XCircle, X, Clock } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

interface Receipt {
  _id: string; receiptNumber: string; flatNumber: string; blockName: string;
  mode: string; amountPaise: number; referenceNote?: string; receiptDate: string;
  recordedByName: string; instrument?: { chequeNo?: string; bankName?: string };
}

const rupees = (p?: number) => `₹${((p || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function ConfirmationsPage() {
  const { showToast } = useToastConfirm();
  const [rows, setRows] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Receipt | null>(null);
  const [reason, setReason] = useState('');

  const load = async () => {
    try { setLoading(true); const res = await api.get('/finance/society/collections/pending'); setRows(res.data); }
    catch (e: any) { showToast(e.response?.data?.error || 'Failed to load', 'error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const confirm = async (r: Receipt) => {
    setBusy(r._id);
    try { await api.post(`/finance/society/collections/receipts/${r._id}/confirm`); showToast('Payment confirmed & applied', 'success'); load(); }
    catch (e: any) { showToast(e.response?.data?.error || 'Failed to confirm', 'error'); }
    finally { setBusy(null); }
  };

  const doReject = async () => {
    if (!rejectTarget || !reason.trim()) return;
    setBusy(rejectTarget._id);
    try { await api.post(`/finance/society/collections/receipts/${rejectTarget._id}/reject`, { rejectionReason: reason }); showToast('Payment rejected', 'success'); setRejectTarget(null); setReason(''); load(); }
    catch (e: any) { showToast(e.response?.data?.error || 'Failed to reject', 'error'); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Payment Confirmations</h1>
        <p className="text-sm text-slate-500 mt-0.5">Review and approve resident-reported offline payments</p>
      </div>

      <TableContainer component={Paper} elevation={1} className="rounded-2xl border border-slate-200/60 shadow-sm overflow-x-auto">
        {loading ? <div className="flex justify-center py-20 bg-white"><CircularProgress size={32} /></div>
          : rows.length === 0 ? (
            <div className="text-center py-20 text-slate-400 font-semibold text-sm bg-white">
              <Clock className="w-10 h-10 mx-auto text-slate-300 mb-3" />No payments awaiting confirmation.
            </div>
          ) : (
            <Table sx={{ minWidth: 800 }}>
              <TableHead><TableRow>
                <TableCell>Receipt #</TableCell><TableCell>Flat</TableCell><TableCell>Mode</TableCell>
                <TableCell align="right">Amount</TableCell><TableCell>Reference</TableCell><TableCell>Reported by</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow></TableHead>
              <TableBody className="bg-white">
                {rows.map(r => (
                  <TableRow key={r._id}>
                    <TableCell className="font-mono text-xs font-bold text-slate-700">{r.receiptNumber}</TableCell>
                    <TableCell className="font-bold text-slate-800">{r.flatNumber}<span className="text-slate-400 font-normal text-xs"> · {r.blockName}</span></TableCell>
                    <TableCell className="text-slate-600">{r.mode}</TableCell>
                    <TableCell align="right" className="font-bold text-slate-800">{rupees(r.amountPaise)}</TableCell>
                    <TableCell className="text-xs text-slate-500">{r.instrument?.chequeNo || r.referenceNote || '—'}</TableCell>
                    <TableCell className="text-slate-600">{r.recordedByName}</TableCell>
                    <TableCell align="right">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="small" variant="contained" disabled={busy === r._id} onClick={() => confirm(r)} startIcon={<CheckCircle2 className="w-4 h-4" />} sx={{ bgcolor: '#059669', '&:hover': { bgcolor: '#047857' } }}>Confirm</Button>
                        <Button size="small" variant="outlined" color="error" disabled={busy === r._id} onClick={() => { setRejectTarget(r); setReason(''); }} startIcon={<XCircle className="w-4 h-4" />}>Reject</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
      </TableContainer>

      <Dialog open={!!rejectTarget} onClose={() => setRejectTarget(null)} slots={{ transition: Zoom }} maxWidth="xs" fullWidth>
        <DialogTitle className="flex justify-between items-center pr-3"><span>Reject payment</span><IconButton onClick={() => setRejectTarget(null)} size="small"><X className="w-5 h-5" /></IconButton></DialogTitle>
        <DialogContent className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Reason *</span>
          <TextField hiddenLabel fullWidth multiline rows={3} placeholder="Why is this payment being rejected?" value={reason} onChange={e => setReason(e.target.value)} />
        </DialogContent>
        <DialogActions className="p-5 pt-0 gap-2">
          <Button onClick={() => setRejectTarget(null)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
          <Button onClick={doReject} disabled={!reason.trim() || !!busy} variant="contained" color="error" fullWidth className="py-2.5 font-bold">Reject</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
