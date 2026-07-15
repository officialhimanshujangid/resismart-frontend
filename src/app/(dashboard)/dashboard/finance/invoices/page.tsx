'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import {
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  CircularProgress, TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  TablePagination, Paper, Zoom, FormControl, Select, MenuItem, Chip,
} from '@mui/material';
import { FileText, Play, X, Download, Receipt, IndianRupee, TrendingUp, AlertTriangle } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

interface LineItem { code: string; name: string; category: string; baseAmountPaise: number; gstPaise: number; lineTotalPaise: number; }
interface Invoice {
  _id: string; invoiceNumber: string; flatNumber: string; blockName: string;
  primaryOwnerName?: string; billingPeriod: string; invoiceDate: string; dueDate: string;
  subTotalPaise: number; gstPaise: number; interestPaise: number; roundingPaise: number;
  openingArrearsPaise: number; totalPaise: number; grandTotalDuePaise: number;
  advanceAppliedPaise: number; outstandingPaise: number; status: string; lineItems: LineItem[];
}
interface Summary { invoiceCount: number; totalBilled: number; totalCollected: number; totalOutstanding: number; overdueCount: number; overdueAmount: number; }

const rupees = (p?: number) => `₹${((p || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const currentPeriod = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

const STATUS_STYLES: Record<string, string> = {
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  PARTIALLY_PAID: 'bg-blue-50 text-blue-700 border-blue-100',
  ISSUED: 'bg-amber-50 text-amber-700 border-amber-100',
  OVERDUE: 'bg-red-50 text-red-700 border-red-100',
  WAIVED: 'bg-slate-100 text-slate-600 border-slate-200',
  CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200',
  DRAFT: 'bg-slate-100 text-slate-500 border-slate-200',
};

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  return (
    <Paper elevation={0} className="p-4 rounded-2xl border border-slate-200/60 bg-white flex items-center gap-3">
      <div className={`p-2.5 rounded-xl ${tone}`}>{icon}</div>
      <div>
        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-lg font-black text-slate-800">{value}</p>
      </div>
    </Paper>
  );
}

export default function InvoicesPage() {
  const { showToast } = useToastConfirm();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [period, setPeriod] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const [genOpen, setGenOpen] = useState(false);
  const [genPeriod, setGenPeriod] = useState(currentPeriod());
  const [genBusy, setGenBusy] = useState(false);
  const [preview, setPreview] = useState<{ created: number; skipped: number; totalBilledPaise: number } | null>(null);

  const [detail, setDetail] = useState<Invoice | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page + 1), pageSize: String(pageSize) });
      if (period) params.append('period', period);
      if (status) params.append('status', status);
      if (search) params.append('search', search);
      const [inv, sum] = await Promise.all([
        api.get(`/finance/society/invoices?${params.toString()}`),
        api.get(`/finance/society/invoices/summary${period ? `?period=${period}` : ''}`),
      ]);
      setInvoices(inv.data.invoices);
      setTotal(inv.data.pagination?.total ?? 0);
      setSummary(sum.data);
    } catch (e: any) {
      showToast(e.response?.data?.error || 'Failed to load invoices', 'error');
    } finally { setLoading(false); }
  }, [page, pageSize, period, status, search, showToast]);
  useEffect(() => { load(); }, [load]);

  const runGenerate = async (dryRun: boolean) => {
    setGenBusy(true);
    try {
      const res = await api.post('/finance/society/invoices/generate', { period: genPeriod, dryRun });
      if (dryRun) {
        setPreview(res.data);
      } else {
        showToast(`Generated ${res.data.created} invoice(s) for ${res.data.period} (${res.data.skipped} skipped)`, 'success');
        setGenOpen(false); setPreview(null); setPage(0); load();
      }
    } catch (e: any) {
      showToast(e.response?.data?.error || 'Generation failed', 'error');
    } finally { setGenBusy(false); }
  };

  const downloadPdf = async (inv: Invoice) => {
    try {
      const res = await api.get(`/finance/society/invoices/${inv._id}/pdf`);
      if (res.data?.url) window.open(res.data.url, '_blank');
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to generate PDF', 'error'); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Invoices</h1>
          <p className="text-sm text-slate-500 mt-0.5">Generate and track consolidated maintenance invoices</p>
        </div>
        <Button onClick={() => { setGenOpen(true); setPreview(null); }} variant="contained" startIcon={<Play className="w-4 h-4" />} sx={{ whiteSpace: 'nowrap' }}>Generate Invoices</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<Receipt className="w-5 h-5 text-blue-600" />} label="Total Billed" value={rupees(summary?.totalBilled)} tone="bg-blue-50" />
        <StatCard icon={<IndianRupee className="w-5 h-5 text-emerald-600" />} label="Collected" value={rupees(summary?.totalCollected)} tone="bg-emerald-50" />
        <StatCard icon={<TrendingUp className="w-5 h-5 text-amber-600" />} label="Outstanding" value={rupees(summary?.totalOutstanding)} tone="bg-amber-50" />
        <StatCard icon={<AlertTriangle className="w-5 h-5 text-red-600" />} label={`Overdue (${summary?.overdueCount ?? 0})`} value={rupees(summary?.overdueAmount)} tone="bg-red-50" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <TextField size="small" type="month" label="Period" value={period} onChange={e => { setPeriod(e.target.value); setPage(0); }} slotProps={{ inputLabel: { shrink: true } }} />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <Select displayEmpty value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}>
            <MenuItem value="">All statuses</MenuItem>
            {['ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'WAIVED', 'CANCELLED'].map(s => <MenuItem key={s} value={s}>{s.replace(/_/g, ' ')}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField size="small" placeholder="Search flat / owner / no." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} sx={{ minWidth: 220 }} />
      </div>

      <TableContainer component={Paper} elevation={1} className="rounded-2xl border border-slate-200/60 shadow-sm overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20 bg-white"><CircularProgress size={32} thickness={4} /></div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-20 text-slate-400 font-semibold text-sm bg-white">No invoices found. Click "Generate Invoices" to create them.</div>
        ) : (
          <Table sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell>Invoice #</TableCell>
                <TableCell>Flat</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Period</TableCell>
                <TableCell align="right">Total Due</TableCell>
                <TableCell align="right">Outstanding</TableCell>
                <TableCell>Due Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody className="bg-white">
              {invoices.map((inv) => (
                <TableRow key={inv._id} hover className="cursor-pointer" onClick={() => setDetail(inv)}>
                  <TableCell className="font-mono text-xs font-bold text-slate-700">{inv.invoiceNumber}</TableCell>
                  <TableCell className="font-bold text-slate-800">{inv.flatNumber}<span className="text-slate-400 font-normal text-xs"> · {inv.blockName}</span></TableCell>
                  <TableCell className="text-slate-600">{inv.primaryOwnerName || '—'}</TableCell>
                  <TableCell className="text-slate-500 font-semibold">{inv.billingPeriod}</TableCell>
                  <TableCell align="right" className="font-bold text-slate-800">{rupees(inv.grandTotalDuePaise)}</TableCell>
                  <TableCell align="right" className={`font-bold ${inv.outstandingPaise > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{rupees(inv.outstandingPaise)}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">{new Date(inv.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</TableCell>
                  <TableCell><span className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-black border ${STATUS_STYLES[inv.status] || STATUS_STYLES.DRAFT}`}>{inv.status.replace(/_/g, ' ')}</span></TableCell>
                  <TableCell align="right" onClick={e => e.stopPropagation()}>
                    <IconButton onClick={() => downloadPdf(inv)} size="small" className="bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-500 rounded-xl p-2"><Download className="w-4 h-4" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <TablePagination
          component="div" count={total} page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={pageSize}
          onRowsPerPageChange={e => { setPageSize(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 20, 50, 100]}
        />
      </TableContainer>

      {/* Generate dialog */}
      <Dialog open={genOpen} onClose={() => setGenOpen(false)} slots={{ transition: Zoom }} maxWidth="xs" fullWidth>
        <DialogTitle className="flex justify-between items-center pr-3">
          <span className="flex items-center gap-2"><FileText className="w-5 h-5 text-blue-600" />Generate Invoices</span>
          <IconButton onClick={() => setGenOpen(false)} size="small"><X className="w-5 h-5" /></IconButton>
        </DialogTitle>
        <DialogContent className="space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Billing period</span>
            <TextField hiddenLabel fullWidth size="small" type="month" value={genPeriod} onChange={e => { setGenPeriod(e.target.value); setPreview(null); }} />
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800">
            One consolidated invoice per applicable flat will be created for this period, with all active charge heads, arrears carry-forward and interest. Already-generated flats are skipped.
          </div>
          {preview && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-slate-500">Will create</span><span className="font-bold text-slate-800">{preview.created} invoices</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Already exists (skip)</span><span className="font-bold text-slate-800">{preview.skipped}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Estimated billing</span><span className="font-bold text-blue-700">{rupees(preview.totalBilledPaise)}</span></div>
            </div>
          )}
        </DialogContent>
        <DialogActions className="p-5 pt-0 gap-2">
          <Button onClick={() => runGenerate(true)} disabled={genBusy} variant="outlined" fullWidth className="py-2.5 font-bold">{genBusy && !preview ? <CircularProgress size={18} /> : 'Preview'}</Button>
          <Button onClick={() => runGenerate(false)} disabled={genBusy} variant="contained" fullWidth className="py-2.5 font-bold">{genBusy ? <CircularProgress size={18} color="inherit" /> : 'Generate'}</Button>
        </DialogActions>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!detail} onClose={() => setDetail(null)} slots={{ transition: Zoom }} maxWidth="sm" fullWidth scroll="paper">
        {detail && (
          <>
            <DialogTitle className="flex justify-between items-center pr-3">
              <div className="flex items-center gap-2"><span>Invoice {detail.invoiceNumber}</span>
                <span className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-black border ${STATUS_STYLES[detail.status] || STATUS_STYLES.DRAFT}`}>{detail.status.replace(/_/g, ' ')}</span>
              </div>
              <IconButton onClick={() => setDetail(null)} size="small"><X className="w-5 h-5" /></IconButton>
            </DialogTitle>
            <DialogContent className="space-y-4">
              <div className="flex justify-between text-sm bg-slate-50 rounded-xl p-3 border border-slate-200/60">
                <div><p className="text-[10px] uppercase font-black text-slate-400">Flat</p><p className="font-bold text-slate-800">{detail.flatNumber} · {detail.blockName}</p></div>
                <div className="text-right"><p className="text-[10px] uppercase font-black text-slate-400">Owner</p><p className="font-bold text-slate-800">{detail.primaryOwnerName || '—'}</p></div>
              </div>
              <Table size="small">
                <TableHead><TableRow><TableCell>Charge</TableCell><TableCell align="right">Base</TableCell><TableCell align="right">GST</TableCell><TableCell align="right">Total</TableCell></TableRow></TableHead>
                <TableBody>
                  {detail.lineItems.map((li, i) => (
                    <TableRow key={i}>
                      <TableCell className={li.category === 'ARREARS_BF' ? 'text-slate-500 italic' : 'font-semibold text-slate-700'}>{li.name}</TableCell>
                      <TableCell align="right">{rupees(li.baseAmountPaise)}</TableCell>
                      <TableCell align="right">{li.gstPaise ? rupees(li.gstPaise) : '—'}</TableCell>
                      <TableCell align="right" className="font-semibold">{rupees(li.lineTotalPaise)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="space-y-1 text-sm border-t border-slate-100 pt-3">
                <div className="flex justify-between"><span className="text-slate-500">Current charges</span><span className="font-semibold">{rupees(detail.subTotalPaise)}</span></div>
                {detail.gstPaise > 0 && <div className="flex justify-between"><span className="text-slate-500">GST</span><span className="font-semibold">{rupees(detail.gstPaise)}</span></div>}
                {detail.interestPaise > 0 && <div className="flex justify-between"><span className="text-slate-500">Interest on arrears</span><span className="font-semibold">{rupees(detail.interestPaise)}</span></div>}
                {detail.roundingPaise !== 0 && <div className="flex justify-between"><span className="text-slate-500">Rounding</span><span className="font-semibold">{rupees(detail.roundingPaise)}</span></div>}
                {detail.openingArrearsPaise > 0 && <div className="flex justify-between"><span className="text-slate-500">Arrears brought forward</span><span className="font-semibold">{rupees(detail.openingArrearsPaise)}</span></div>}
                {detail.advanceAppliedPaise > 0 && <div className="flex justify-between"><span className="text-emerald-600">Advance adjusted</span><span className="font-semibold text-emerald-600">- {rupees(detail.advanceAppliedPaise)}</span></div>}
                <div className="flex justify-between border-t border-slate-200 pt-2 mt-1"><span className="font-black text-slate-800">Total Payable</span><span className="font-black text-blue-700">{rupees(detail.outstandingPaise)}</span></div>
              </div>
            </DialogContent>
            <DialogActions className="p-5 pt-0 gap-2">
              <Button onClick={() => downloadPdf(detail)} variant="outlined" fullWidth startIcon={<Download className="w-4 h-4" />} className="py-2.5 font-bold">Download PDF</Button>
              <Button onClick={() => setDetail(null)} variant="contained" fullWidth className="py-2.5 font-bold">Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </div>
  );
}
