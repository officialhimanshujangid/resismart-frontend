'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import {
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  CircularProgress, TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  TablePagination, Paper, Zoom, FormControl, Select, MenuItem, Chip, Tooltip,
} from '@mui/material';
import { FileText, Play, X, Download, Receipt, IndianRupee, TrendingUp, AlertTriangle, BadgePercent, Zap } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

interface LineItem { code: string; name: string; category: string; baseAmountPaise: number; gstPaise: number; lineTotalPaise: number; }
interface Invoice {
  _id: string; invoiceNumber: string; flatNumber: string; blockName: string;
  primaryOwnerName?: string; billingPeriod: string; demandTitle?: string; invoiceDate: string; dueDate: string;
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
  const [preview, setPreview] = useState<{
    created: number; skipped: number; totalBilledPaise: number;
    unbilled?: { flat: string; chargeHeadName: string; reason: string }[];
    fundImpact?: { fundId: string; fundName: string; targetAmountPaise: number; raisedPaise: number; thisRunPaise: number; projectedPaise: number; overByPaise: number; shortByPaise: number }[];
  } | null>(null);
  const [confirmOverTarget, setConfirmOverTarget] = useState(false);

  const [demandOpen, setDemandOpen] = useState(false);
  const [heads, setHeads] = useState<{ _id: string; code: string; name: string }[]>([]);
  const [blocks, setBlocks] = useState<{ _id: string; name: string }[]>([]);
  const [demand, setDemand] = useState({ chargeHeadIds: [] as string[], blockIds: [] as string[], title: '', dueDate: '' });

  const [detail, setDetail] = useState<Invoice | null>(null);

  const [adjustOf, setAdjustOf] = useState<Invoice | null>(null);
  const [adjust, setAdjust] = useState({ kind: 'WAIVER', amount: '', reason: '' });
  const [adjustBusy, setAdjustBusy] = useState(false);
  const [rebate, setRebate] = useState<{ eligible: boolean; amountPaise: number; reason: string } | null>(null);

  const openAdjust = async (inv: Invoice) => {
    setAdjustOf(inv);
    setAdjust({ kind: 'WAIVER', amount: '', reason: '' });
    setRebate(null);
    // Ask what a rebate would come to — a suggestion the committee applies, not
    // something that happens on its own.
    try {
      const res = await api.get(`/finance/society/invoices/${inv._id}/rebate`);
      setRebate(res.data);
    } catch { /* rebates are optional; the dialog works without one */ }
  };

  const submitAdjust = async () => {
    if (!adjustOf) return;
    setAdjustBusy(true);
    try {
      const res = await api.post(`/finance/society/invoices/${adjustOf._id}/adjust`, {
        kind: adjust.kind,
        amountPaise: Math.round(parseFloat(adjust.amount || '0') * 100),
        reason: adjust.reason.trim(),
      });
      showToast(`${rupees(Math.round(parseFloat(adjust.amount) * 100))} taken off ${res.data.invoiceNumber} — voucher ${res.data.voucherNumber}`, 'success');
      setAdjustOf(null); load();
    } catch (e: any) { showToast(e.response?.data?.error || 'Could not adjust this bill', 'error'); }
    finally { setAdjustBusy(false); }
  };

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
      const res = await api.post('/finance/society/invoices/generate', {
        period: genPeriod, dryRun,
        // Only sent once the treasurer has ticked it, and only after the server
        // has said this run would push a fund past its target.
        confirmOverTarget: confirmOverTarget || undefined,
      });
      if (dryRun) {
        setPreview(res.data);
      } else {
        showToast(`Generated ${res.data.created} invoice(s) for ${res.data.period} (${res.data.skipped} skipped)`, 'success');
        setGenOpen(false); setPreview(null); setConfirmOverTarget(false); setPage(0); load();
      }
    } catch (e: any) {
      // A fund breach comes back as a 409 carrying the numbers, so the dialog can
      // show what is wrong instead of a bare error toast.
      if (e.response?.status === 409 && e.response.data?.requiresConfirmation) {
        setPreview((p: any) => ({ ...(p || { created: 0, skipped: 0, totalBilledPaise: 0 }), fundImpact: e.response.data.fundImpact }));
      }
      showToast(e.response?.data?.error || 'Generation failed', 'error');
    } finally { setGenBusy(false); }
  };

  const openDemand = async () => {
    setDemand({ chargeHeadIds: [], blockIds: [], title: '', dueDate: '' });
    setPreview(null); setConfirmOverTarget(false); setDemandOpen(true);
    try {
      const [h, b] = await Promise.all([
        api.get('/finance/society/charge-heads'),
        api.get('/societies/blocks'),
      ]);
      setHeads(h.data || []);
      setBlocks(Array.isArray(b.data) ? b.data : (b.data?.blocks ?? []));
    } catch (e: any) { showToast(e.response?.data?.error || 'Could not load charge heads', 'error'); }
  };

  const runDemand = async (dryRun: boolean) => {
    setGenBusy(true);
    try {
      const res = await api.post('/finance/society/invoices/special-demand', {
        chargeHeadIds: demand.chargeHeadIds,
        blockIds: demand.blockIds.length ? demand.blockIds : undefined,
        title: demand.title.trim(),
        dueDate: demand.dueDate ? new Date(demand.dueDate).toISOString() : undefined,
        dryRun,
        confirmOverTarget: confirmOverTarget || undefined,
      });
      if (dryRun) {
        setPreview(res.data);
      } else {
        showToast(`Raised ${res.data.created} demand(s) — ${res.data.period}`, 'success');
        setDemandOpen(false); setPreview(null); setConfirmOverTarget(false); setPage(0); load();
      }
    } catch (e: any) {
      if (e.response?.status === 409 && e.response.data?.requiresConfirmation) {
        setPreview((p: any) => ({ ...(p || { created: 0, skipped: 0, totalBilledPaise: 0 }), fundImpact: e.response.data.fundImpact }));
      }
      showToast(e.response?.data?.error || 'Could not raise the demand', 'error');
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
        <Button onClick={openDemand} variant="outlined" startIcon={<Zap className="w-4 h-4" />} sx={{ whiteSpace: 'nowrap' }}>Special Demand</Button>
        <Button onClick={() => { setGenOpen(true); setPreview(null); setConfirmOverTarget(false); }} variant="contained" startIcon={<Play className="w-4 h-4" />} sx={{ whiteSpace: 'nowrap' }}>Generate Invoices</Button>
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
                  <TableCell className="text-slate-500 font-semibold">
                    {inv.billingPeriod}
                    {inv.demandTitle && (
                      <Tooltip title={inv.demandTitle}>
                        <span className="ml-1 text-[9px] font-black uppercase text-amber-700 bg-amber-50 border border-amber-100 rounded px-1 py-0.5">Special</span>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell align="right" className="font-bold text-slate-800">{rupees(inv.grandTotalDuePaise)}</TableCell>
                  <TableCell align="right" className={`font-bold ${inv.outstandingPaise > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{rupees(inv.outstandingPaise)}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">{new Date(inv.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</TableCell>
                  <TableCell><span className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-black border ${STATUS_STYLES[inv.status] || STATUS_STYLES.DRAFT}`}>{inv.status.replace(/_/g, ' ')}</span></TableCell>
                  <TableCell align="right" onClick={e => e.stopPropagation()}>
                    {inv.outstandingPaise > 0 && (
                      <Tooltip title="Waive, write off or rebate part of this bill">
                        <IconButton onClick={e => { e.stopPropagation(); openAdjust(inv); }} size="small" className="bg-slate-100 hover:bg-amber-50 hover:text-amber-600 text-slate-500 rounded-xl p-2 mr-1"><BadgePercent className="w-4 h-4" /></IconButton>
                      </Tooltip>
                    )}
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

              {/* Flats a charge head applies to but cannot price. These used to
                  vanish without a word, and a society only found out when the
                  collection came up short. */}
              {!!preview.unbilled?.length && (
                <div className="mt-3 pt-3 border-t border-amber-200 bg-amber-50 -mx-3 -mb-3 px-3 py-3 rounded-b-xl">
                  <p className="text-xs font-black text-amber-800 mb-1.5">
                    {preview.unbilled.length} flat{preview.unbilled.length === 1 ? '' : 's'} will be billed ₹0
                  </p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {preview.unbilled.slice(0, 12).map((u, i) => (
                      <p key={i} className="text-[11px] text-amber-800">
                        <b>{u.flat}</b> — {u.chargeHeadName}: {u.reason}
                      </p>
                    ))}
                    {preview.unbilled.length > 12 && (
                      <p className="text-[11px] text-amber-700 font-semibold">…and {preview.unbilled.length - 12} more</p>
                    )}
                  </div>
                  <p className="text-[10px] text-amber-700 mt-2">Fix these first, or they simply will not be charged.</p>
                </div>
              )}

              {/* What this run does to any fund with a target. Over-collecting is
                  hard to explain afterwards and harder to refund. */}
              {!!preview.fundImpact?.length && (
                <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                  <p className="text-xs font-black text-slate-600">Fund impact</p>
                  {preview.fundImpact.map(f => (
                    <div key={f.fundId} className={`rounded-lg px-2.5 py-2 text-[11px] ${f.overByPaise > 0 ? 'bg-red-50 border border-red-100 text-red-800' : 'bg-slate-50 border border-slate-200 text-slate-700'}`}>
                      <p className="font-bold">{f.fundName}</p>
                      <p>
                        Already billed {rupees(f.raisedPaise)} + this run {rupees(f.thisRunPaise)} = <b>{rupees(f.projectedPaise)}</b>,
                        against a target of {rupees(f.targetAmountPaise)}.
                      </p>
                      {f.overByPaise > 0
                        ? <p className="font-bold mt-0.5">⚠ {rupees(f.overByPaise)} more than the fund needs.</p>
                        : f.shortByPaise > 0
                          ? <p className="mt-0.5">{rupees(f.shortByPaise)} still short of the target after this run.</p>
                          : <p className="mt-0.5">Meets the target exactly.</p>}
                    </div>
                  ))}
                  {preview.fundImpact.some(f => f.overByPaise > 0) && (
                    <label className="flex items-start gap-2 text-[11px] text-red-800 cursor-pointer">
                      <input
                        type="checkbox" className="mt-0.5"
                        checked={confirmOverTarget}
                        onChange={e => setConfirmOverTarget(e.target.checked)}
                      />
                      <span>I understand this bills members more than the fund needs, and I want to go ahead.</span>
                    </label>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
        <DialogActions className="p-5 pt-0 gap-2">
          <Button onClick={() => runGenerate(true)} disabled={genBusy} variant="outlined" fullWidth className="py-2.5 font-bold">{genBusy && !preview ? <CircularProgress size={18} /> : 'Preview'}</Button>
          <Button onClick={() => runGenerate(false)} disabled={genBusy} variant="contained" fullWidth className="py-2.5 font-bold">{genBusy ? <CircularProgress size={18} color="inherit" /> : 'Generate'}</Button>
        </DialogActions>
      </Dialog>

      {/* Special demand — a one-off levy raised after the month's bill has gone. */}
      <Dialog open={demandOpen} onClose={() => setDemandOpen(false)} slots={{ transition: Zoom }} maxWidth="sm" fullWidth>
        <DialogTitle className="flex justify-between items-center pr-3">
          <span className="flex items-center gap-2"><Zap className="w-5 h-5 text-amber-600" />Special Demand</span>
          <IconButton onClick={() => setDemandOpen(false)} size="small"><X className="w-5 h-5" /></IconButton>
        </DialogTitle>
        <DialogContent className="space-y-4">
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800">
            For something that could not wait for next month — an urgent repair, a painting contract.
            It is raised alongside this month&apos;s bill, and carries <b>no interest and no arrears line</b>.
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">What are you billing for? *</span>
            <FormControl fullWidth size="small">
              <Select
                multiple displayEmpty
                value={demand.chargeHeadIds}
                onChange={e => { setDemand(d => ({ ...d, chargeHeadIds: (typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value) as string[] })); setPreview(null); }}
                renderValue={(v) => (v as string[]).length
                  ? heads.filter(h => (v as string[]).includes(h._id)).map(h => h.name).join(', ')
                  : 'Choose a charge head'}
              >
                {heads.map(h => <MenuItem key={h._id} value={h._id}>{h.code} · {h.name}</MenuItem>)}
              </Select>
            </FormControl>
            <p className="text-[10px] text-slate-400">Set the amount and how it splits on the charge head itself.</p>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Reason, as members will see it *</span>
            <TextField
              hiddenLabel fullWidth size="small" placeholder="e.g. External painting 2026"
              value={demand.title} onChange={e => setDemand(d => ({ ...d, title: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {blocks.length > 1 && (
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Which wings</span>
                <FormControl fullWidth size="small">
                  <Select
                    multiple displayEmpty
                    value={demand.blockIds}
                    onChange={e => { setDemand(d => ({ ...d, blockIds: (typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value) as string[] })); setPreview(null); }}
                    renderValue={(v) => (v as string[]).length
                      ? blocks.filter(b => (v as string[]).includes(b._id)).map(b => b.name).join(', ')
                      : 'Every wing'}
                  >
                    {blocks.map(b => <MenuItem key={b._id} value={b._id}>{b.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </div>
            )}
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Due date</span>
              <TextField
                hiddenLabel fullWidth size="small" type="date"
                value={demand.dueDate} onChange={e => setDemand(d => ({ ...d, dueDate: e.target.value }))}
              />
              <p className="text-[10px] text-slate-400">Blank uses your usual due days.</p>
            </div>
          </div>

          {preview && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-slate-500">Will raise</span><span className="font-bold text-slate-800">{preview.created} demand(s)</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Total</span><span className="font-bold text-blue-700">{rupees(preview.totalBilledPaise)}</span></div>

              {!!preview.unbilled?.length && (
                <div className="mt-2 pt-2 border-t border-amber-200 bg-amber-50 -mx-3 -mb-3 px-3 py-2 rounded-b-xl">
                  <p className="text-xs font-black text-amber-800 mb-1">{preview.unbilled.length} flat(s) would be billed ₹0</p>
                  {preview.unbilled.slice(0, 8).map((u, i) => (
                    <p key={i} className="text-[11px] text-amber-800"><b>{u.flat}</b> — {u.reason}</p>
                  ))}
                </div>
              )}

              {!!preview.fundImpact?.length && (
                <div className="mt-2 pt-2 border-t border-slate-200 space-y-2">
                  {preview.fundImpact.map(f => (
                    <div key={f.fundId} className={`rounded-lg px-2.5 py-2 text-[11px] ${f.overByPaise > 0 ? 'bg-red-50 border border-red-100 text-red-800' : 'bg-white border border-slate-200 text-slate-700'}`}>
                      <p className="font-bold">{f.fundName}</p>
                      <p>Already billed {rupees(f.raisedPaise)} + this demand {rupees(f.thisRunPaise)} = <b>{rupees(f.projectedPaise)}</b> against {rupees(f.targetAmountPaise)}.</p>
                      {f.overByPaise > 0 && <p className="font-bold mt-0.5">⚠ {rupees(f.overByPaise)} more than the fund needs.</p>}
                    </div>
                  ))}
                  {preview.fundImpact.some(f => f.overByPaise > 0) && (
                    <label className="flex items-start gap-2 text-[11px] text-red-800 cursor-pointer">
                      <input type="checkbox" className="mt-0.5" checked={confirmOverTarget} onChange={e => setConfirmOverTarget(e.target.checked)} />
                      <span>I understand this bills members more than the fund needs, and I want to go ahead.</span>
                    </label>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
        <DialogActions className="p-5 pt-0 gap-2">
          <Button onClick={() => runDemand(true)} disabled={genBusy || !demand.chargeHeadIds.length || !demand.title.trim()} variant="outlined" fullWidth className="py-2.5 font-bold">
            {genBusy && !preview ? <CircularProgress size={18} /> : 'Preview'}
          </Button>
          <Button onClick={() => runDemand(false)} disabled={genBusy || !demand.chargeHeadIds.length || !demand.title.trim()} variant="contained" fullWidth className="py-2.5 font-bold">
            {genBusy ? <CircularProgress size={18} color="inherit" /> : 'Raise Demand'}
          </Button>
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

      {/* Waive / write off / rebate — the society giving up income it already booked. */}
      <Dialog open={!!adjustOf} onClose={() => setAdjustOf(null)} slots={{ transition: Zoom }} maxWidth="xs" fullWidth>
        <DialogTitle className="flex justify-between items-center pr-3">
          <div>
            <p className="font-bold text-slate-800">Adjust {adjustOf?.invoiceNumber}</p>
            <p className="text-xs text-slate-500 font-normal mt-0.5">{adjustOf?.blockName} {adjustOf?.flatNumber} · {rupees(adjustOf?.outstandingPaise)} outstanding</p>
          </div>
          <IconButton onClick={() => setAdjustOf(null)} size="small"><X className="w-5 h-5" /></IconButton>
        </DialogTitle>
        <DialogContent className="space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Why</span>
            <FormControl fullWidth size="small">
              <Select value={adjust.kind} onChange={e => setAdjust(a => ({ ...a, kind: e.target.value }))}>
                <MenuItem value="WAIVER">Waiver — the committee has agreed not to charge it</MenuItem>
                <MenuItem value="REBATE">Early-payment rebate</MenuItem>
                <MenuItem value="WRITE_OFF">Write-off — it will never be recovered</MenuItem>
              </Select>
            </FormControl>
          </div>

          {adjust.kind === 'REBATE' && rebate && (
            <div className={`rounded-xl p-3 text-xs ${rebate.eligible ? 'bg-emerald-50 border border-emerald-100 text-emerald-800' : 'bg-slate-50 border border-slate-200 text-slate-600'}`}>
              {rebate.eligible ? (
                <>
                  Rebate due on this bill: <b>{rupees(rebate.amountPaise)}</b> — {rebate.reason}.
                  <Button size="small" className="ml-1 font-bold" onClick={() => setAdjust(a => ({ ...a, amount: String(rebate.amountPaise / 100), reason: a.reason || 'Early-payment rebate' }))}>Use this</Button>
                </>
              ) : rebate.reason}
            </div>
          )}

          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Amount (₹)</span>
            <TextField hiddenLabel fullWidth size="small" type="number" value={adjust.amount} onChange={e => setAdjust(a => ({ ...a, amount: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Reason *</span>
            <TextField hiddenLabel fullWidth size="small" multiline minRows={2} placeholder="Recorded against the bill and the ledger — a member may ask" value={adjust.reason} onChange={e => setAdjust(a => ({ ...a, reason: e.target.value }))} />
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600">
            The bill keeps its full value and records what was given up alongside it — a bill that silently shrinks is one
            nobody can audit. Any GST already charged is <b>not</b> reversed: that needs a formal credit note.
          </div>
        </DialogContent>
        <DialogActions className="p-5 pt-0 gap-2">
          <Button onClick={() => setAdjustOf(null)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
          <Button onClick={submitAdjust} disabled={adjustBusy || !adjust.amount || !adjust.reason.trim()} variant="contained" fullWidth className="py-2.5 font-bold">
            {adjustBusy ? <CircularProgress size={18} color="inherit" /> : 'Apply'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
