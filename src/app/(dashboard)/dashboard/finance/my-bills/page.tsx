'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import {
  Button, Tabs, Tab, Paper, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, TextField, FormControl, Select, MenuItem, Table, TableHead, TableBody, TableRow,
  TableCell, TableContainer, Zoom,
} from '@mui/material';
import { IndianRupee, Download, X, Wallet, ExternalLink, Info } from 'lucide-react';
import UpiQrPanel from '@/components/finance/UpiQrPanel';
import { useToastConfirm } from '@/context/ToastConfirmContext';

interface Invoice { _id: string; invoiceNumber: string; billingPeriod: string; dueDate: string; grandTotalDuePaise: number; outstandingPaise: number; status: string; }
interface Receipt { _id: string; receiptNumber: string; mode: string; amountPaise: number; status: string; receiptDate: string; }
interface StatementRow { date: string; voucherNumber: string; voucherType: string; narration?: string; debitPaise: number; creditPaise: number; balancePaise: number; }
interface Outstanding { totalOutstandingPaise: number; advanceBalancePaise: number; onlineEnabled: boolean; upiId?: string; upiPayeeName?: string; flatLabel?: string; }

const rupees = (p?: number) => `₹${((p || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const STATUS: Record<string, string> = {
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  PARTIALLY_PAID: 'bg-blue-50 text-blue-700 border-blue-100',
  ISSUED: 'bg-amber-50 text-amber-700 border-amber-100',
  OVERDUE: 'bg-red-50 text-red-700 border-red-100',
  CLEARED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  PENDING_CONFIRMATION: 'bg-amber-50 text-amber-700 border-amber-100',
  BOUNCED: 'bg-red-50 text-red-700 border-red-100',
};

export default function MyBillsPage() {
  const { showToast } = useToastConfirm();
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Outstanding | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [statement, setStatement] = useState<StatementRow[]>([]);

  const [payOpen, setPayOpen] = useState(false);
  const [payTab, setPayTab] = useState<'ONLINE' | 'OFFLINE'>('ONLINE');
  // Shared by both tabs: a member can pay ahead online or offline, so the amount
  // is no longer an offline-only concern.
  const [payForm, setPayForm] = useState({ mode: 'UPI', amount: '', referenceNote: '', payAdvance: false });
  const [processing, setProcessing] = useState(false);

  const payAmountPaise = Math.max(0, Math.round(parseFloat(payForm.amount || '0') * 100) || 0);
  const duesPaise = summary?.totalOutstandingPaise ?? 0;
  /** Anything above the dues is held as credit against future bills. */
  const advancePaise = Math.max(0, payAmountPaise - duesPaise);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [o, inv, rec, st] = await Promise.all([
        api.get('/finance/resident/outstanding'),
        api.get('/finance/resident/invoices'),
        api.get('/finance/resident/receipts'),
        api.get('/finance/resident/statement'),
      ]);
      setSummary(o.data);
      setInvoices(inv.data);
      setReceipts(rec.data);
      setStatement(st.data.entries || []);
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to load your dues', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);
  useEffect(() => { load(); }, [load]);

  const openPay = () => {
    setPayTab(summary?.onlineEnabled ? 'ONLINE' : 'OFFLINE');
    setPayForm({ mode: 'UPI', amount: summary ? String(summary.totalOutstandingPaise / 100) : '', referenceNote: '', payAdvance: false });
    setPayOpen(true);
  };

  const pay = async () => {
    setProcessing(true);
    try {
      if (payTab === 'ONLINE') {
        // Send the amount explicitly — an empty body made the server bill exactly
        // the dues, so paying ahead was impossible however much you typed.
        const res = await api.post('/finance/resident/pay-online', { amountPaise: payAmountPaise });
        if (res.data?.paymentLinkUrl) window.location.href = res.data.paymentLinkUrl;
        else showToast('Could not start online payment', 'error');
      } else {
        await api.post('/finance/resident/report-offline', {
          mode: payForm.mode,
          amountPaise: payAmountPaise,
          referenceNote: payForm.referenceNote || undefined,
          payAdvance: advancePaise > 0 ? true : undefined,
        });
        showToast('Payment reported. Awaiting committee confirmation.', 'success');
        setPayOpen(false); load();
      }
    } catch (e: any) { showToast(e.response?.data?.error || 'Payment failed', 'error'); }
    finally { setProcessing(false); }
  };

  const pdf = async (kind: 'invoices' | 'receipts', id: string) => {
    try { const res = await api.get(`/finance/resident/${kind}/${id}/pdf`); if (res.data?.url) window.open(res.data.url, '_blank'); }
    catch (e: any) { showToast(e.response?.data?.error || 'Failed to get PDF', 'error'); }
  };

  if (loading) return <div className="flex justify-center p-12"><CircularProgress size={32} /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">My Maintenance</h1>
          <p className="text-sm text-slate-500 mt-0.5">View dues, pay bills and download receipts</p>
        </div>
      </div>

      {/* Summary hero */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Paper elevation={0} className="p-5 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white sm:col-span-2">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-100 text-sm font-semibold">Total Outstanding</p>
              <p className="text-4xl font-black mt-1">{rupees(summary?.totalOutstandingPaise)}</p>
              {summary && summary.advanceBalancePaise > 0 && <p className="text-blue-100 text-xs mt-2">Advance credit available: {rupees(summary.advanceBalancePaise)}</p>}
            </div>
            <Button onClick={openPay} disabled={!summary || summary.totalOutstandingPaise <= 0} variant="contained" startIcon={<IndianRupee className="w-4 h-4" />} sx={{ bgcolor: 'white', color: '#1d4ed8', '&:hover': { bgcolor: '#eff6ff' } }}>Pay Now</Button>
          </div>
        </Paper>
        <Paper elevation={0} className="p-5 rounded-2xl border border-slate-200/60 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50"><Wallet className="w-5 h-5 text-emerald-600" /></div>
          <div><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Advance Credit</p><p className="text-lg font-black text-slate-800">{rupees(summary?.advanceBalancePaise)}</p></div>
        </Paper>
      </div>

      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab label="Dues" /><Tab label="Payments" /><Tab label="Statement" />
      </Tabs>

      {tab === 0 && (
        <TableContainer component={Paper} elevation={1} className="rounded-2xl border border-slate-200/60 overflow-x-auto">
          {invoices.length === 0 ? <div className="text-center py-16 text-slate-400 font-semibold text-sm">No invoices yet.</div> : (
            <Table sx={{ minWidth: 700 }}>
              <TableHead><TableRow><TableCell>Invoice #</TableCell><TableCell>Period</TableCell><TableCell>Due</TableCell><TableCell align="right">Total</TableCell><TableCell align="right">Outstanding</TableCell><TableCell>Status</TableCell><TableCell align="right"></TableCell></TableRow></TableHead>
              <TableBody className="bg-white">
                {invoices.map(inv => (
                  <TableRow key={inv._id}>
                    <TableCell className="font-mono text-xs font-bold text-slate-700">{inv.invoiceNumber}</TableCell>
                    <TableCell className="font-semibold text-slate-600">{inv.billingPeriod}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{new Date(inv.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</TableCell>
                    <TableCell align="right" className="font-semibold text-slate-700">{rupees(inv.grandTotalDuePaise)}</TableCell>
                    <TableCell align="right" className={`font-bold ${inv.outstandingPaise > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{rupees(inv.outstandingPaise)}</TableCell>
                    <TableCell><span className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-black border ${STATUS[inv.status]}`}>{inv.status.replace(/_/g, ' ')}</span></TableCell>
                    <TableCell align="right"><IconButton onClick={() => pdf('invoices', inv._id)} size="small" className="bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-500 rounded-xl p-2"><Download className="w-4 h-4" /></IconButton></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableContainer>
      )}

      {tab === 1 && (
        <TableContainer component={Paper} elevation={1} className="rounded-2xl border border-slate-200/60 overflow-x-auto">
          {receipts.length === 0 ? <div className="text-center py-16 text-slate-400 font-semibold text-sm">No payments yet.</div> : (
            <Table sx={{ minWidth: 700 }}>
              <TableHead><TableRow><TableCell>Receipt #</TableCell><TableCell>Date</TableCell><TableCell>Mode</TableCell><TableCell align="right">Amount</TableCell><TableCell>Status</TableCell><TableCell align="right"></TableCell></TableRow></TableHead>
              <TableBody className="bg-white">
                {receipts.map(r => (
                  <TableRow key={r._id}>
                    <TableCell className="font-mono text-xs font-bold text-slate-700">{r.receiptNumber}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{new Date(r.receiptDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</TableCell>
                    <TableCell className="text-slate-600">{r.mode}</TableCell>
                    <TableCell align="right" className="font-bold text-slate-800">{rupees(r.amountPaise)}</TableCell>
                    <TableCell><span className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-black border ${STATUS[r.status]}`}>{r.status.replace(/_/g, ' ')}</span></TableCell>
                    <TableCell align="right">{r.status === 'CLEARED' && <IconButton onClick={() => pdf('receipts', r._id)} size="small" className="bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-500 rounded-xl p-2"><Download className="w-4 h-4" /></IconButton>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableContainer>
      )}

      {tab === 2 && (
        <TableContainer component={Paper} elevation={1} className="rounded-2xl border border-slate-200/60 overflow-x-auto">
          {statement.length === 0 ? <div className="text-center py-16 text-slate-400 font-semibold text-sm">No account activity yet.</div> : (
            <Table sx={{ minWidth: 700 }}>
              <TableHead><TableRow><TableCell>Date</TableCell><TableCell>Voucher</TableCell><TableCell>Particulars</TableCell><TableCell align="right">Debit</TableCell><TableCell align="right">Credit</TableCell><TableCell align="right">Balance</TableCell></TableRow></TableHead>
              <TableBody className="bg-white">
                {statement.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs text-slate-500">{new Date(s.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-600">{s.voucherNumber}</TableCell>
                    <TableCell className="text-slate-600 text-sm">{s.narration || s.voucherType}</TableCell>
                    <TableCell align="right" className="text-slate-700">{s.debitPaise ? rupees(s.debitPaise) : '—'}</TableCell>
                    <TableCell align="right" className="text-emerald-700">{s.creditPaise ? rupees(s.creditPaise) : '—'}</TableCell>
                    <TableCell align="right" className="font-bold text-slate-800">{rupees(s.balancePaise)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableContainer>
      )}

      {/* Pay dialog */}
      <Dialog open={payOpen} onClose={() => setPayOpen(false)} slots={{ transition: Zoom }} maxWidth="xs" fullWidth>
        <DialogTitle className="flex justify-between items-center pr-3"><span>Pay Dues — {rupees(summary?.totalOutstandingPaise)}</span><IconButton onClick={() => setPayOpen(false)} size="small"><X className="w-5 h-5" /></IconButton></DialogTitle>
        <DialogContent className="space-y-4">
          <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
            <button className={`flex-1 py-2 text-sm font-bold rounded-md ${payTab === 'ONLINE' ? 'bg-white shadow-sm' : 'text-slate-500'}`} onClick={() => setPayTab('ONLINE')} disabled={!summary?.onlineEnabled}>Pay Online</button>
            <button className={`flex-1 py-2 text-sm font-bold rounded-md ${payTab === 'OFFLINE' ? 'bg-white shadow-sm' : 'text-slate-500'}`} onClick={() => setPayTab('OFFLINE')}>Report Offline</button>
          </div>
          {payTab === 'ONLINE' && !summary?.onlineEnabled ? (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800 flex gap-2"><Info className="w-5 h-5 shrink-0" />Online payment isn't enabled by your society. Please report an offline payment.</div>
          ) : (
            <div className="space-y-3">
              {payTab === 'OFFLINE' && summary?.upiId && payForm.mode === 'UPI' && (
                <UpiQrPanel
                  upiId={summary.upiId}
                  payeeName={summary.upiPayeeName}
                  amountPaise={payAmountPaise}
                  note={summary.flatLabel ? `Maintenance ${summary.flatLabel}` : 'Maintenance'}
                />
              )}

              <div className="grid grid-cols-2 gap-3">
                {payTab === 'OFFLINE' && (
                  <div className="space-y-1"><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Mode</span>
                    <FormControl fullWidth size="small"><Select value={payForm.mode} onChange={e => setPayForm(o => ({ ...o, mode: e.target.value }))}>{['UPI', 'BANK_TRANSFER', 'CASH', 'CHEQUE'].map(m => <MenuItem key={m} value={m}>{m.replace(/_/g, ' ')}</MenuItem>)}</Select></FormControl>
                  </div>
                )}
                <div className={`space-y-1 ${payTab === 'ONLINE' ? 'col-span-2' : ''}`}>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Amount (₹)</span>
                  <TextField hiddenLabel fullWidth size="small" type="number" value={payForm.amount} onChange={e => setPayForm(o => ({ ...o, amount: e.target.value }))} />
                </div>
              </div>

              {/* What the money will actually do. Paying ahead is normal — going
                  abroad, or just settling the year — so it is shown plainly
                  rather than being refused as an error. */}
              {payAmountPaise > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-slate-500">Towards dues</span><span className="font-semibold text-slate-700">{rupees(Math.min(payAmountPaise, duesPaise))}</span></div>
                  {advancePaise > 0 && (
                    <div className="flex justify-between"><span className="text-emerald-700">Held as advance credit</span><span className="font-bold text-emerald-700">{rupees(advancePaise)}</span></div>
                  )}
                  {duesPaise > payAmountPaise && (
                    <div className="flex justify-between"><span className="text-amber-700">Still owing after this</span><span className="font-semibold text-amber-700">{rupees(duesPaise - payAmountPaise)}</span></div>
                  )}
                </div>
              )}

              {advancePaise > 0 && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-800 flex gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  {rupees(advancePaise)} more than you owe. It stays with the society as credit and is applied automatically to your next bill.
                </div>
              )}

              {payTab === 'OFFLINE' && (
                <>
                  <TextField hiddenLabel fullWidth size="small" placeholder="Reference / UTR / note" value={payForm.referenceNote} onChange={e => setPayForm(o => ({ ...o, referenceNote: e.target.value }))} />
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800 flex gap-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    {payForm.mode === 'UPI' && summary?.upiId
                      ? 'Paying by QR doesn’t update your dues on its own. After paying, submit the UTR here — your dues clear once the committee confirms it.'
                      : 'Marked as “Verifying” until your committee confirms receipt.'}
                  </div>
                </>
              )}

              {payTab === 'ONLINE' && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800">
                  You'll be redirected to Razorpay to pay {rupees(payAmountPaise)}. Your dues update automatically once payment succeeds.
                </div>
              )}
            </div>
          )}
        </DialogContent>
        <DialogActions className="p-5 pt-0 gap-2">
          <Button onClick={() => setPayOpen(false)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
          <Button onClick={pay} disabled={processing || payAmountPaise <= 0} variant="contained" fullWidth className="py-2.5 font-bold" startIcon={payTab === 'ONLINE' ? <ExternalLink className="w-4 h-4" /> : undefined}>{processing ? <CircularProgress size={18} color="inherit" /> : payTab === 'ONLINE' ? 'Proceed to Pay' : 'Submit'}</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
