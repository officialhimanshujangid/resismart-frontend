'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import {
  CircularProgress, TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  TablePagination, Paper, Chip, FormControl, Select, MenuItem, Collapse, Button, Grid,
} from '@mui/material';
import { Download, SlidersHorizontal, RotateCcw, ReceiptText, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import ModuleScope from '@/components/common/ModuleScope';
import StatCard from '@/components/common/StatCard';

interface Invoice {
  _id: string; invoiceType: string; amount: number; status: string; createdAt: string; paidAt?: string;
  customInvoiceNumber?: string; customPdfUrl?: string; razorpayInvoiceUrl?: string;
  planId?: { name: string }; tenure?: string; societyName?: string;
}

const STATUS_STYLES: Record<string, string> = {
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200',
  REFUNDED: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function OwnerInvoicesPage() {
  const { showToast } = useToastConfirm();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = Math.max(0, parseInt(searchParams.get('page') || '1', 10) - 1);
  const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
  const appliedStatus = searchParams.get('status') || 'all';

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState(appliedStatus);

  const updateUrl = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    const DEFAULTS: Record<string, string> = { page: '1', pageSize: '10', status: 'all' };
    Object.entries(updates).forEach(([k, v]) => { if (!v || v === DEFAULTS[k]) params.delete(k); else params.set(k, v); });
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('isPagination', 'true');
      params.append('page', String(page + 1));
      params.append('pageSize', String(pageSize));
      if (appliedStatus !== 'all') params.append('status', appliedStatus);
      const res = await api.get(`/billing/invoices?${params.toString()}`);
      setInvoices(res.data.invoices || []);
      setTotal(res.data.pagination?.total ?? 0);
    } catch {
      showToast('Failed to load invoices', 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, appliedStatus]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const [stats, setStats] = useState({ total: 0, paid: 0, pending: 0, failed: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  useEffect(() => {
    const c = (s = '') => api.get(`/billing/invoices?isPagination=true&pageSize=1${s}`).then((r) => r.data.pagination?.total ?? 0).catch(() => 0);
    setStatsLoading(true);
    Promise.all([c(), c('&status=PAID'), c('&status=PENDING'), c('&status=FAILED')])
      .then(([t, p, pe, f]) => setStats({ total: t, paid: p, pending: pe, failed: f }))
      .finally(() => setStatsLoading(false));
  }, []);

  const downloadInvoice = async (id: string) => {
    try {
      const res = await api.get(`/billing/invoices/${id}/download`);
      if (res.data?.url) window.open(res.data.url, '_blank', 'noopener');
      else showToast('No document available', 'error');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Could not open invoice', 'error');
    }
  };

  const inr = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;
  const fmt = (s?: string) => (s ? new Date(s).toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—');

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2"><ReceiptText className="w-6 h-6 text-[#0a5bd7]" /> Invoices</h1>
            <ModuleScope scope="society" />
          </div>
          <p className="text-sm text-slate-500 mt-0.5">Every invoice generated across all societies (online & cash)</p>
        </div>
        <Button onClick={() => setShowFilters(!showFilters)} variant={showFilters || appliedStatus !== 'all' ? 'contained' : 'outlined'}
          color={appliedStatus !== 'all' ? 'primary' : 'inherit'} startIcon={<SlidersHorizontal className="w-4 h-4" />} sx={{ whiteSpace: 'nowrap' }}>Filters</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Invoices" value={stats.total} loading={statsLoading} tone="blue" icon={<ReceiptText className="w-5 h-5" />} />
        <StatCard label="Paid" value={stats.paid} loading={statsLoading} tone="emerald" icon={<CheckCircle2 className="w-5 h-5" />} />
        <StatCard label="Pending" value={stats.pending} loading={statsLoading} tone="amber" icon={<Clock className="w-5 h-5" />} />
        <StatCard label="Failed" value={stats.failed} loading={statsLoading} tone="rose" icon={<XCircle className="w-5 h-5" />} />
      </div>

      <Collapse in={showFilters}>
        <Paper elevation={0} className="p-5 rounded-2xl border border-slate-200/60 bg-slate-50/40">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }} className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Status</span>
              <FormControl fullWidth>
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as string)} className="bg-white rounded-xl">
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="PAID">Paid</MenuItem>
                  <MenuItem value="PENDING">Pending</MenuItem>
                  <MenuItem value="FAILED">Failed</MenuItem>
                  <MenuItem value="REFUNDED">Refunded</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }} className="flex items-end gap-2">
              <Button variant="contained" fullWidth onClick={() => updateUrl({ status: statusFilter, page: '1' })}>Apply</Button>
              <Button variant="text" onClick={() => { setStatusFilter('all'); router.push(pathname, { scroll: false }); }}><RotateCcw className="w-4 h-4" /></Button>
            </Grid>
          </Grid>
        </Paper>
      </Collapse>

      <TableContainer component={Paper} elevation={1} className="rounded-2xl border border-slate-200/60 shadow-sm overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20 bg-white"><CircularProgress size={32} thickness={4} /></div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-20 text-slate-400 font-semibold text-sm bg-white">No invoices yet.</div>
        ) : (
          <Table sx={{ minWidth: 1000 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 60 }}>S.No.</TableCell>
                <TableCell>Invoice #</TableCell>
                <TableCell>Society</TableCell>
                <TableCell>Plan</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Download</TableCell>
              </TableRow>
            </TableHead>
            <TableBody className="bg-white">
              {invoices.map((inv, i) => {
                const url = inv.customPdfUrl || inv.razorpayInvoiceUrl;
                return (
                  <TableRow key={inv._id}>
                    <TableCell className="font-semibold text-slate-500">{page * pageSize + i + 1}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-600">{inv.customInvoiceNumber || inv._id.slice(-8).toUpperCase()}</TableCell>
                    <TableCell className="font-bold text-slate-800">{inv.societyName || '—'}</TableCell>
                    <TableCell className="text-slate-600">{inv.planId?.name || '—'}{inv.tenure ? <span className="text-slate-400"> · {inv.tenure}</span> : ''}</TableCell>
                    <TableCell><Chip size="small" label={inv.invoiceType === 'OFFLINE_CASH' ? 'Cash' : 'Online'} /></TableCell>
                    <TableCell className="font-bold text-slate-800">{inr(inv.amount / 100)}</TableCell>
                    <TableCell><span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-black border ${STATUS_STYLES[inv.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>{inv.status}</span></TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{fmt(inv.paidAt || inv.createdAt)}</TableCell>
                    <TableCell align="right">
                      {url ? <button onClick={() => downloadInvoice(inv._id)} className="inline-flex items-center gap-1 text-[#0a5bd7] font-bold text-xs hover:underline"><Download className="w-3.5 h-3.5" /> PDF</button> : <span className="text-xs text-slate-400">—</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <TablePagination component="div" count={total} page={page}
          onPageChange={(_, np) => updateUrl({ page: String(np + 1) })}
          rowsPerPage={pageSize} onRowsPerPageChange={(e) => updateUrl({ pageSize: e.target.value, page: '1' })}
          rowsPerPageOptions={[5, 10, 25, 50]} sx={{ borderTop: '1px solid #f1f5f9', backgroundColor: '#fff' }} />
      </TableContainer>
    </div>
  );
}
