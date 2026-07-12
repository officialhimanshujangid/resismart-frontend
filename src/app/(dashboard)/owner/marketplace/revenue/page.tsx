'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import StatCard from '@/components/common/StatCard';
import { DataTable, ColumnDef } from '@/components/common/DataTable';
import { TablePagination, Chip, CircularProgress } from '@mui/material';
import { IndianRupee, Rocket, Zap, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid } from 'recharts';

const inr = (p: number) => `₹${(p / 100).toLocaleString('en-IN')}`;
const statusColor: Record<string, any> = { ACTIVE: 'success', EXPIRED: 'default', PENDING: 'warning', FAILED: 'error', REFUNDED: 'info' };

interface Boost {
  _id: string; societyName: string; listingId?: { title: string; kind: string };
  packageSnapshot: { label: string }; amountPaise: number; status: string; createdAt: string; endAt?: string;
}

export default function MarketplaceRevenuePage() {
  const { showToast } = useToastConfirm();
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [boosts, setBoosts] = useState<Boost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(15);
  const [tableLoading, setTableLoading] = useState(true);

  useEffect(() => {
    api.get('/marketplace/owner/revenue/stats')
      .then((r) => setStats(r.data.stats))
      .catch(() => showToast('Failed to load revenue stats', 'error'))
      .finally(() => setStatsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchBoosts = useCallback(async () => {
    setTableLoading(true);
    try {
      const r = await api.get('/marketplace/owner/revenue/boosts', { params: { page: page + 1, pageSize } });
      setBoosts(r.data.boosts || []);
      setTotal(r.data.pagination?.total ?? 0);
    } catch { /* silent */ } finally { setTableLoading(false); }
  }, [page, pageSize]);

  useEffect(() => { fetchBoosts(); }, [fetchBoosts]);

  const columns: ColumnDef<Boost>[] = [
    { id: 'society', label: 'Society', render: (r) => <span className="font-semibold text-slate-700">{r.societyName}</span> },
    { id: 'listing', label: 'Listing', render: (r) => <span className="text-sm text-slate-600">{r.listingId?.title || '—'}</span> },
    { id: 'package', label: 'Package', render: (r) => <Chip size="small" label={r.packageSnapshot?.label} variant="outlined" /> },
    { id: 'amount', label: 'Amount', render: (r) => <span className="font-bold text-teal-700">{inr(r.amountPaise)}</span> },
    { id: 'status', label: 'Status', render: (r) => <Chip size="small" color={statusColor[r.status]} label={r.status} /> },
    { id: 'date', label: 'Date', render: (r) => <span className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span> },
  ];

  const chartData = (stats?.last30 || []).map((d: any) => ({ date: d.date.slice(5), revenue: Math.round(d.revenuePaise / 100) }));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0f766e] to-[#14b8a6] p-6 shadow-lg">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative"><h1 className="text-2xl font-black text-white tracking-tight">Marketplace Revenue</h1><p className="text-sm text-teal-50 mt-1">Ad-boost earnings across all societies</p></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Earned" value={statsLoading ? '' : inr(stats?.revenuePaise || 0)} icon={<IndianRupee className="w-5 h-5" />} tone="emerald" loading={statsLoading} />
        <StatCard label="Boosts Sold" value={statsLoading ? '' : (stats?.boostsSold || 0)} icon={<Rocket className="w-5 h-5" />} tone="amber" loading={statsLoading} />
        <StatCard label="Active Boosts" value={statsLoading ? '' : (stats?.activeBoosts || 0)} icon={<Zap className="w-5 h-5" />} tone="violet" loading={statsLoading} />
        <StatCard label="Packages" value={statsLoading ? '' : (stats?.byPackage?.length || 0)} icon={<TrendingUp className="w-5 h-5" />} tone="blue" loading={statsLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white border border-slate-200/70 rounded-2xl p-5">
          <h3 className="text-sm font-black text-slate-700 mb-4">Revenue — last 30 days (₹)</h3>
          {statsLoading ? <div className="flex justify-center py-16"><CircularProgress /></div> : chartData.length === 0 ? (
            <p className="text-sm text-slate-400 py-16 text-center">No revenue yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f6" />
                <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} />
                <RTooltip formatter={(v: any) => [`₹${v}`, 'Revenue']} />
                <Bar dataKey="revenue" fill="#0f766e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-white border border-slate-200/70 rounded-2xl p-5">
          <h3 className="text-sm font-black text-slate-700 mb-4">By package</h3>
          <div className="space-y-3">
            {(stats?.byPackage || []).length === 0 ? <p className="text-sm text-slate-400">No data.</p> : stats.byPackage.map((p: any) => (
              <div key={p.label} className="flex items-center justify-between">
                <div><span className="text-sm font-semibold text-slate-700">{p.label}</span><div className="text-[11px] text-slate-400">{p.count} sold</div></div>
                <span className="font-bold text-teal-700">{inr(p.revenuePaise)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200/70 rounded-2xl p-4">
        <h3 className="text-sm font-black text-slate-700 mb-3 px-1">Boost ledger</h3>
        <DataTable columns={columns} data={boosts} loading={tableLoading} keyExtractor={(r) => r._id} emptyText="No boosts yet." />
        <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={pageSize} onRowsPerPageChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(0); }} rowsPerPageOptions={[15, 30, 50]} />
      </div>
    </div>
  );
}
