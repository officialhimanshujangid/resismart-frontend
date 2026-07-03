'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import {
  CircularProgress, TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  TablePagination, Paper, FormControl, Select, MenuItem, Collapse, Button, Grid,
} from '@mui/material';
import { SlidersHorizontal, RotateCcw, Repeat, RefreshCw, CheckCircle2, Sparkles, Clock, Ban } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import ModuleScope from '@/components/common/ModuleScope';
import StatCard from '@/components/common/StatCard';

interface Subscription {
  _id: string; status: string; tenure: string; startDate: string; endDate: string; createdAt: string;
  planId?: { name: string }; societyName?: string;
}

const STATUS_STYLES: Record<string, string> = {
  trialing: 'bg-amber-50 text-amber-700 border-amber-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  past_due: 'bg-orange-50 text-orange-700 border-orange-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
  expired: 'bg-red-50 text-red-700 border-red-200',
  pending_payment: 'bg-blue-50 text-blue-700 border-blue-200',
};

export default function OwnerSubscriptionsPage() {
  const { showToast } = useToastConfirm();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = Math.max(0, parseInt(searchParams.get('page') || '1', 10) - 1);
  const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
  const appliedStatus = searchParams.get('status') || 'all';

  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState(appliedStatus);
  const [syncing, setSyncing] = useState(false);

  const runMaintenance = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/billing/run-maintenance');
      showToast(res.data.message || 'Statuses synced', 'success');
      fetchSubs();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to sync', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const updateUrl = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    const DEFAULTS: Record<string, string> = { page: '1', pageSize: '10', status: 'all' };
    Object.entries(updates).forEach(([k, v]) => { if (!v || v === DEFAULTS[k]) params.delete(k); else params.set(k, v); });
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const fetchSubs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('isPagination', 'true');
      params.append('page', String(page + 1));
      params.append('pageSize', String(pageSize));
      if (appliedStatus !== 'all') params.append('status', appliedStatus);
      const scope = searchParams.get('scope');
      if (scope === 'society') params.append('tenantType', 'SOCIETY');
      if (scope === 'shop') params.append('tenantType', 'SHOP');
      const res = await api.get(`/billing/subscriptions?${params.toString()}`);
      setSubs(res.data.subscriptions || []);
      setTotal(res.data.pagination?.total ?? 0);
    } catch {
      showToast('Failed to load subscriptions', 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, appliedStatus]);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);

  const [stats, setStats] = useState({ active: 0, trialing: 0, past_due: 0, expired: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  useEffect(() => {
    const c = (s: string) => api.get(`/billing/subscriptions?isPagination=true&pageSize=1&status=${s}`).then((r) => r.data.pagination?.total ?? 0).catch(() => 0);
    setStatsLoading(true);
    Promise.all([c('active'), c('trialing'), c('past_due'), c('expired')])
      .then(([a, t, g, e]) => setStats({ active: a, trialing: t, past_due: g, expired: e }))
      .finally(() => setStatsLoading(false));
  }, []);

  const fmt = (s?: string) => (s ? new Date(s).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2"><Repeat className="w-6 h-6 text-[#0a5bd7]" /> Subscriptions</h1>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">Active and historical subscriptions across all tenants</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={runMaintenance} disabled={syncing} variant="outlined" startIcon={syncing ? <CircularProgress size={14} /> : <RefreshCw className="w-4 h-4" />} sx={{ whiteSpace: 'nowrap' }}>Sync statuses</Button>
          <Button onClick={() => setShowFilters(!showFilters)} variant={showFilters || appliedStatus !== 'all' ? 'contained' : 'outlined'}
            color={appliedStatus !== 'all' ? 'primary' : 'inherit'} startIcon={<SlidersHorizontal className="w-4 h-4" />} sx={{ whiteSpace: 'nowrap' }}>Filters</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active (paid)" value={stats.active} loading={statsLoading} tone="emerald" icon={<CheckCircle2 className="w-5 h-5" />} />
        <StatCard label="On Free / Trial" value={stats.trialing} loading={statsLoading} tone="amber" icon={<Sparkles className="w-5 h-5" />} />
        <StatCard label="In Grace" value={stats.past_due} loading={statsLoading} tone="violet" icon={<Clock className="w-5 h-5" />} />
        <StatCard label="Expired" value={stats.expired} loading={statsLoading} tone="rose" icon={<Ban className="w-5 h-5" />} />
      </div>

      <Collapse in={showFilters}>
        <Paper elevation={0} className="p-5 rounded-2xl border border-slate-200/60 bg-slate-50/40">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }} className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Status</span>
              <FormControl fullWidth>
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as string)} className="bg-white rounded-xl">
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="trialing">Trialing</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="past_due">Past Due</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                  <MenuItem value="expired">Expired</MenuItem>
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
        ) : subs.length === 0 ? (
          <div className="text-center py-20 text-slate-400 font-semibold text-sm bg-white">No subscriptions found.</div>
        ) : (
          <Table sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 60 }}>S.No.</TableCell>
                <TableCell>Tenant</TableCell>
                <TableCell>Plan</TableCell>
                <TableCell>Tenure</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Start</TableCell>
                <TableCell>End / Renews</TableCell>
                <TableCell>Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody className="bg-white">
              {subs.map((s, i) => (
                <TableRow key={s._id}>
                  <TableCell className="font-semibold text-slate-500">{page * pageSize + i + 1}</TableCell>
                  <TableCell className="font-bold text-slate-800">{s.societyName || '—'}</TableCell>
                  <TableCell className="text-slate-600">{s.planId?.name || (s.tenure === 'trial' ? 'Free Trial' : '—')}</TableCell>
                  <TableCell className="capitalize text-slate-600">{s.tenure}</TableCell>
                  <TableCell><span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-black border ${STATUS_STYLES[s.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>{s.status}</span></TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">{fmt(s.startDate)}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">{fmt(s.endDate)}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">{fmt(s.createdAt)}</TableCell>
                </TableRow>
              ))}
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
