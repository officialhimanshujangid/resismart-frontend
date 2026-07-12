'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import VerifiedBadge from '@/components/marketplace/VerifiedBadge';
import { DataTable, ColumnDef } from '@/components/common/DataTable';
import { TablePagination, Chip, Button, TextField, MenuItem, Select, FormControl, InputLabel } from '@mui/material';
import { ShieldX, Rocket, Search } from 'lucide-react';

const inr = (p: number) => `₹${(p / 100).toLocaleString('en-IN')}`;
const statusColor: Record<string, any> = { DRAFT: 'default', ACTIVE: 'success', PAUSED: 'warning', SOLD: 'info', RENTED: 'info', EXPIRED: 'default', TAKEN_DOWN: 'error' };

interface Row {
  _id: string; title: string; kind: string; status: string; pricePaise: number; priceType: string;
  city?: string; societyName: string; createdByName: string; verification?: { status: string };
  boost?: { active?: boolean }; viewsCount: number; leadsCount: number;
}

export default function OwnerListingsPage() {
  const { showToast, confirm } = useToastConfirm();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(15);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/marketplace/owner/listings', { params: { page: page + 1, pageSize, status: status || undefined, search: search || undefined } });
      setRows(r.data.listings || []);
      setTotal(r.data.pagination?.total ?? 0);
    } catch { showToast('Failed to load listings', 'error'); } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, status, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const takedown = async (row: Row) => {
    const ok = await confirm({ title: 'Take down listing', message: `Remove “${row.title}” from the marketplace?`, confirmText: 'Take down', severity: 'error' });
    if (!ok) return;
    try { await api.post(`/marketplace/owner/listings/${row._id}/takedown`); showToast('Listing taken down', 'success'); fetchData(); }
    catch (err: any) { showToast(err.response?.data?.error || 'Failed', 'error'); }
  };

  const columns: ColumnDef<Row>[] = [
    { id: 'title', label: 'Listing', render: (r) => (
      <div><div className="flex items-center gap-1.5"><span className="font-semibold text-slate-800">{r.title}</span>{r.boost?.active && <Rocket className="w-3.5 h-3.5 text-amber-500" />}<VerifiedBadge status={r.verification?.status} /></div><div className="text-xs text-slate-500">{r.societyName}{r.city ? ` · ${r.city}` : ''}</div></div>
    ) },
    { id: 'kind', label: 'Type', render: (r) => <Chip size="small" label={r.kind} variant="outlined" /> },
    { id: 'price', label: 'Price', render: (r) => <span className="font-bold text-teal-700">{inr(r.pricePaise)}{r.priceType === 'PER_MONTH' ? '/mo' : ''}</span> },
    { id: 'status', label: 'Status', render: (r) => <Chip size="small" color={statusColor[r.status]} label={r.status} /> },
    { id: 'engagement', label: 'Views / Leads', render: (r) => <span className="text-xs text-slate-500">{r.viewsCount} / {r.leadsCount}</span> },
    { id: 'actions', label: 'Actions', align: 'right', render: (r) => (
      r.status !== 'TAKEN_DOWN' ? <Button size="small" color="error" startIcon={<ShieldX className="w-4 h-4" />} onClick={() => takedown(r)} sx={{ textTransform: 'none' }}>Take down</Button> : <span className="text-xs text-slate-300">—</span>
    ) },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0f766e] to-[#14b8a6] p-6 shadow-lg">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div><h1 className="text-2xl font-black text-white tracking-tight">All Listings</h1><p className="text-sm text-teal-50 mt-1">Moderate property advertisements across societies</p></div>
          <Button onClick={() => window.open('/property-marketplace', '_blank')} variant="outlined" startIcon={<Search className="w-4 h-4" />}
            sx={{ borderColor: 'rgba(255,255,255,0.5)', color: '#fff', '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: '#fff' } }}>Browse Public Ads</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200/70 rounded-2xl p-3">
        <TextField size="small" label="Search title" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} sx={{ width: 240 }} />
        <FormControl size="small" sx={{ minWidth: 140 }}><InputLabel>Status</InputLabel>
          <Select value={status} label="Status" onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
            {['', 'DRAFT', 'ACTIVE', 'PAUSED', 'SOLD', 'RENTED', 'EXPIRED', 'TAKEN_DOWN'].map((s) => <MenuItem key={s} value={s}>{s || 'All'}</MenuItem>)}
          </Select>
        </FormControl>
      </div>

      <div className="bg-white border border-slate-200/70 rounded-2xl p-4">
        <DataTable columns={columns} data={rows} loading={loading} keyExtractor={(r) => r._id} emptyText="No listings." />
        <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={pageSize} onRowsPerPageChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(0); }} rowsPerPageOptions={[15, 30, 50]} />
      </div>
    </div>
  );
}
