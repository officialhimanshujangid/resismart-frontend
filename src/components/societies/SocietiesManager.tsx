'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import {
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  CircularProgress, TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  TablePagination, Paper, Zoom, Collapse, FormControl, Select, MenuItem, Grid,
} from '@mui/material';
import {
  Plus, X, SlidersHorizontal, RotateCcw, Search, CheckCircle2, XCircle, Info, MapPin,
  CreditCard, Pencil, Building2, Clock, Ban,
} from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import LocationPicker from '@/components/common/LocationPicker';
import ModuleScope from '@/components/common/ModuleScope';
import StatCard from '@/components/common/StatCard';
import SocietiesMap from '@/components/societies/SocietiesMap';

interface Society {
  _id: string;
  name: string;
  address: string;
  status: 'PENDING' | 'ACTIVE' | 'REJECTED';
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  city?: string;
  state?: string;
  pincode?: string;
  registrationNumber?: string;
  totalBlocks?: number;
  totalFlats?: number;
  website?: string;
  location?: { coordinates: number[] };
  rejectionReason?: string;
  createdByName?: string;
  updatedByName?: string;
  createdAt: string;
  updatedAt: string;
}

interface PlanOption { _id: string; name: string; basePrice: number; }

const TENURES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'halfYearly', label: 'Half-Yearly' },
  { value: 'yearly', label: 'Yearly' },
];

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
};

const blankForm = {
  name: '', address: '', contactName: '', contactEmail: '', contactPhone: '',
  city: '', state: '', pincode: '', registrationNumber: '', website: '',
  totalBlocks: '', totalFlats: '', latitude: '', longitude: '',
};

export default function SocietiesManager({ mode }: { mode: 'manage' | 'approvals' }) {
  const { showToast, confirm } = useToastConfirm();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = Math.max(0, parseInt(searchParams.get('page') || '1', 10) - 1);
  const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
  const appliedSearch = searchParams.get('search') || '';
  const appliedStatus = searchParams.get('status') || (mode === 'approvals' ? 'PENDING' : 'all');
  const life = searchParams.get('life') || '';
  const LIFE_MAP: Record<string, string> = { trial: 'trialing', subscribed: 'active', expired: 'expired' };
  const LIFE_TITLE: Record<string, string> = { trial: 'Trial Societies', subscribed: 'Subscribed Societies', expired: 'Expired-Plan Societies' };

  const [societies, setSocieties] = useState<Society[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [mapSocieties, setMapSocieties] = useState<Society[]>([]);
  const [mapLoading, setMapLoading] = useState(false);

  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState(appliedSearch);
  const [statusFilter, setStatusFilter] = useState(appliedStatus);

  useEffect(() => {
    setSearchTerm(appliedSearch);
    setStatusFilter(appliedStatus);
  }, [appliedSearch, appliedStatus]);

  // Add / Edit
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Society | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...blankForm });

  // Reject
  const [rejectTarget, setRejectTarget] = useState<Society | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Assign cash plan
  const [cashTarget, setCashTarget] = useState<Society | null>(null);
  const [cashForm, setCashForm] = useState({ planId: '', tenure: 'yearly', note: '' });

  const updateUrl = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    const DEFAULTS: Record<string, string> = { page: '1', pageSize: '10', status: mode === 'approvals' ? 'PENDING' : 'all', search: '' };
    Object.entries(updates).forEach(([k, v]) => {
      if (!v || v === DEFAULTS[k]) params.delete(k);
      else params.set(k, v);
    });
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const fetchSocieties = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('isPagination', 'true');
      params.append('page', String(page + 1));
      params.append('pageSize', String(pageSize));
      if (appliedSearch) params.append('search', appliedSearch);
      if (appliedStatus !== 'all') params.append('status', appliedStatus);
      if (LIFE_MAP[life]) params.append('subscriptionStatus', LIFE_MAP[life]);
      const res = await api.get(`/societies?${params.toString()}`);
      setSocieties(res.data.societies || []);
      setTotalCount(res.data.pagination?.total ?? 0);
    } catch {
      showToast('Failed to load societies', 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, appliedSearch, appliedStatus, life]);

  useEffect(() => { fetchSocieties(); }, [fetchSocieties, refreshKey]);

  useEffect(() => {
    if (viewMode === 'map' && mapSocieties.length === 0) {
      setMapLoading(true);
      api.get('/societies?isPagination=false')
        .then(res => setMapSocieties(res.data.societies || []))
        .catch(() => showToast('Failed to load map data', 'error'))
        .finally(() => setMapLoading(false));
    }
  }, [viewMode, refreshKey]);

  useEffect(() => { api.get('/plans/public?module=society').then((r) => setPlans(r.data.plans || [])).catch(() => {}); }, []);

  // KPI summary
  const [stats, setStats] = useState({ total: 0, pending: 0, active: 0, expired: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  useEffect(() => {
    const total = (q = '') => api.get(`/societies?isPagination=true&pageSize=1${q}`).then((r) => r.data.pagination?.total ?? 0).catch(() => 0);
    setStatsLoading(true);
    Promise.all([total(), total('&status=PENDING'), total('&status=ACTIVE'), total('&subscriptionStatus=expired')])
      .then(([t, p, a, e]) => setStats({ total: t, pending: p, active: a, expired: e }))
      .finally(() => setStatsLoading(false));
  }, [refreshKey]);

  const activeFiltersCount = (appliedSearch ? 1 : 0) + (appliedStatus !== (mode === 'approvals' ? 'PENDING' : 'all') ? 1 : 0);

  const openCreate = () => { setEditTarget(null); setForm({ ...blankForm }); setFormOpen(true); };
  const openEdit = (s: Society) => {
    setEditTarget(s);
    setForm({
      name: s.name || '', address: s.address || '', contactName: s.contactName || '', contactEmail: s.contactEmail || '',
      contactPhone: s.contactPhone || '', city: s.city || '', state: s.state || '', pincode: s.pincode || '',
      registrationNumber: s.registrationNumber || '', website: s.website || '',
      totalBlocks: s.totalBlocks != null ? String(s.totalBlocks) : '', totalFlats: s.totalFlats != null ? String(s.totalFlats) : '',
      latitude: s.location?.coordinates?.[1] != null ? String(s.location.coordinates[1]) : '',
      longitude: s.location?.coordinates?.[0] != null ? String(s.location.coordinates[0]) : '',
    });
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: any = {
        name: form.name.trim(),
        address: form.address.trim(),
        contactName: form.contactName.trim() || undefined,
        contactEmail: form.contactEmail.trim() || undefined,
        contactPhone: form.contactPhone.trim() || '',
        city: form.city.trim() || '',
        state: form.state.trim() || '',
        pincode: form.pincode.trim() || '',
        registrationNumber: form.registrationNumber.trim() || '',
        website: form.website.trim() || '',
        totalBlocks: form.totalBlocks !== '' ? Number(form.totalBlocks) : undefined,
        totalFlats: form.totalFlats !== '' ? Number(form.totalFlats) : undefined,
        latitude: form.latitude !== '' ? Number(form.latitude) : undefined,
        longitude: form.longitude !== '' ? Number(form.longitude) : undefined,
      };
      if (editTarget) {
        await api.put(`/societies/${editTarget._id}`, payload);
        showToast('Society updated successfully', 'success');
      } else {
        await api.post('/societies/register-admin', payload);
        showToast('Society created and activated', 'success');
      }
      setFormOpen(false);
      refresh();
    } catch (err: any) {
      showToast(err.response?.data?.error || err.response?.data?.message || 'Failed to save society', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openDetails = (s: Society) => router.push(`/owner/societies/${s._id}`);

  const handleApprove = async (s: Society) => {
    const ok = await confirm({ title: 'Approve Society', message: `Approve "${s.name}"? This provisions the admin account and starts the free trial.`, confirmText: 'Approve', cancelText: 'Cancel', severity: 'info' });
    if (!ok) return;
    try {
      await api.post(`/societies/${s._id}/approve`);
      showToast('Society approved', 'success');
      refresh();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to approve', 'error');
    }
  };

  const submitReject = async () => {
    if (!rejectTarget) return;
    try {
      await api.post(`/societies/${rejectTarget._id}/reject`, { reason: rejectReason });
      showToast('Society rejected', 'success');
      setRejectTarget(null); setRejectReason(''); refresh();
    } catch (err: any) {
      showToast(err.response?.data?.error || err.response?.data?.message || 'Failed to reject', 'error');
    }
  };

  const submitCash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashTarget) return;
    setSaving(true);
    try {
      await api.post('/billing/assign-cash', { societyId: cashTarget._id, planId: cashForm.planId, tenure: cashForm.tenure, note: cashForm.note || undefined });
      showToast('Cash plan assigned & invoice generated', 'success');
      setCashTarget(null); setCashForm({ planId: '', tenure: 'yearly', note: '' }); refresh();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to assign plan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const fmt = (s?: string) => (s ? new Date(s).toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—');
  const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">{mode === 'approvals' ? 'Pending Approvals' : (LIFE_TITLE[life] || 'Manage Societies')}</h1>
            <ModuleScope scope="society" />
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{mode === 'approvals' ? 'Review and approve societies that registered themselves' : (life ? `Societies filtered by subscription lifecycle: ${life}` : 'Register, review and manage every society on the platform')}</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button onClick={() => setShowFilters(!showFilters)} variant={showFilters || activeFiltersCount > 0 ? 'contained' : 'outlined'}
            color={activeFiltersCount > 0 ? 'primary' : 'inherit'} startIcon={<SlidersHorizontal className="w-4 h-4" />} sx={{ whiteSpace: 'nowrap' }}>
            Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
          </Button>
          {mode === 'manage' && (
            <Button onClick={openCreate} variant="contained" startIcon={<Plus className="w-4 h-4" />} sx={{ whiteSpace: 'nowrap' }}>Add Society</Button>
          )}
        </div>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Societies" value={stats.total} loading={statsLoading} tone="blue" icon={<Building2 className="w-5 h-5" />} />
        <StatCard label="Pending Approval" value={stats.pending} loading={statsLoading} tone="amber" icon={<Clock className="w-5 h-5" />} />
        <StatCard label="Active" value={stats.active} loading={statsLoading} tone="emerald" icon={<CheckCircle2 className="w-5 h-5" />} />
        <StatCard label="Expired Plans" value={stats.expired} loading={statsLoading} tone="rose" icon={<Ban className="w-5 h-5" />} />
      </div>

      <div className="flex items-center gap-4 border-b border-slate-200">
        <button onClick={() => setViewMode('list')} className={`pb-3 text-sm font-bold border-b-2 transition-colors ${viewMode === 'list' ? 'border-[#0a5bd7] text-[#0a5bd7]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>List View</button>
        <button onClick={() => setViewMode('map')} className={`pb-3 text-sm font-bold border-b-2 transition-colors ${viewMode === 'map' ? 'border-[#0a5bd7] text-[#0a5bd7]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Map View</button>
      </div>

      <Collapse in={showFilters && viewMode === 'list'}>
        <Paper elevation={0} className="p-5 rounded-2xl border border-slate-200/60 bg-slate-50/40 space-y-4">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }} className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Search</span>
              <TextField hiddenLabel fullWidth placeholder="Search name, address, contact..." value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)} slotProps={{ input: { startAdornment: <Search className="w-4 h-4 text-slate-400 mr-2" /> } }} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }} className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Status</span>
              <FormControl fullWidth>
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as string)} className="bg-white rounded-xl">
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="PENDING">Pending</MenuItem>
                  <MenuItem value="ACTIVE">Active</MenuItem>
                  <MenuItem value="REJECTED">Rejected</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }} className="flex items-end gap-2">
              <Button variant="contained" fullWidth startIcon={<Search className="w-3.5 h-3.5" />} onClick={() => updateUrl({ search: searchTerm, status: statusFilter, page: '1' })}>Apply</Button>
              <Button variant="text" onClick={() => { setSearchTerm(''); setStatusFilter(mode === 'approvals' ? 'PENDING' : 'all'); router.push(pathname, { scroll: false }); }}><RotateCcw className="w-4 h-4" /></Button>
            </Grid>
          </Grid>
        </Paper>
      </Collapse>

      {viewMode === 'list' && (
      <TableContainer component={Paper} elevation={1} className="rounded-2xl border border-slate-200/60 shadow-sm overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20 bg-white"><CircularProgress size={32} thickness={4} /></div>
        ) : societies.length === 0 ? (
          <div className="text-center py-20 text-slate-400 font-semibold text-sm bg-white">No societies found.</div>
        ) : (
          <Table sx={{ minWidth: 1180 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 60 }}>S.No.</TableCell>
                <TableCell>Society</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created By</TableCell>
                <TableCell>Created At</TableCell>
                <TableCell>Updated By</TableCell>
                <TableCell>Updated At</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody className="bg-white">
              {societies.map((s, i) => (
                <TableRow key={s._id}>
                  <TableCell className="font-semibold text-slate-500">{page * pageSize + i + 1}</TableCell>
                  <TableCell>
                    <div className="font-bold text-slate-800">{s.name}</div>
                    <div className="text-xs text-slate-400 max-w-[200px] truncate">{[s.city, s.state].filter(Boolean).join(', ') || s.address}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-slate-700 font-semibold">{s.contactName || '—'}</div>
                    <div className="text-xs text-slate-400">{s.contactEmail || ''}</div>
                  </TableCell>
                  <TableCell>
                    {s.location?.coordinates?.length === 2 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-mono"><MapPin className="w-3 h-3 text-blue-500" />{s.location.coordinates[1].toFixed(3)}, {s.location.coordinates[0].toFixed(3)}</span>
                    ) : <span className="text-xs text-slate-400">—</span>}
                  </TableCell>
                  <TableCell><span className={`text-[10px] uppercase px-2.5 py-1 rounded-full font-black border ${STATUS_STYLES[s.status]}`}>{s.status}</span></TableCell>
                  <TableCell className="font-semibold text-slate-600 text-sm">{s.createdByName || '—'}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">{fmt(s.createdAt)}</TableCell>
                  <TableCell className="font-semibold text-slate-600 text-sm">{s.updatedByName || '—'}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">{fmt(s.updatedAt)}</TableCell>
                  <TableCell align="right">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton onClick={() => openDetails(s)} size="small" className="bg-slate-100 hover:bg-violet-50 hover:text-violet-600 text-slate-500 rounded-xl p-2" title="Details"><Info className="w-4 h-4" /></IconButton>
                      <IconButton onClick={() => openEdit(s)} size="small" className="bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-500 rounded-xl p-2" title="Edit"><Pencil className="w-4 h-4" /></IconButton>
                      {s.status === 'PENDING' && (
                        <>
                          <IconButton onClick={() => handleApprove(s)} size="small" className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl p-2" title="Approve"><CheckCircle2 className="w-4 h-4" /></IconButton>
                          <IconButton onClick={() => { setRejectTarget(s); setRejectReason(''); }} size="small" className="bg-red-50 hover:bg-red-100 text-red-600 rounded-xl p-2" title="Reject"><XCircle className="w-4 h-4" /></IconButton>
                        </>
                      )}
                      {s.status === 'ACTIVE' && (
                        <IconButton onClick={() => { setCashTarget(s); setCashForm({ planId: plans[0]?._id || '', tenure: 'yearly', note: '' }); }} size="small" className="bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl p-2" title="Upgrade / assign plan"><CreditCard className="w-4 h-4" /></IconButton>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <TablePagination component="div" count={totalCount} page={page}
          onPageChange={(_, np) => updateUrl({ page: String(np + 1) })}
          rowsPerPage={pageSize} onRowsPerPageChange={(e) => updateUrl({ pageSize: e.target.value, page: '1' })}
          rowsPerPageOptions={[5, 10, 25, 50]} sx={{ borderTop: '1px solid #f1f5f9', backgroundColor: '#fff' }} />
      </TableContainer>
      )}

      {viewMode === 'map' && (
        <Paper elevation={1} className="rounded-2xl border border-slate-200/60 shadow-sm p-2 bg-white">
          {mapLoading ? (
            <div className="flex items-center justify-center py-32"><CircularProgress size={32} thickness={4} /></div>
          ) : (
            <SocietiesMap societies={mapSocieties} height={600} />
          )}
        </Paper>
      )}

      {/* Add / Edit Society */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} slots={{ transition: Zoom }} maxWidth="md" fullWidth
        disableEnforceFocus
        slotProps={{ paper: { sx: { maxHeight: 'calc(100% - 48px)' } } }}>
        <DialogTitle className="flex justify-between items-center pr-3"><span>{editTarget ? 'Edit Society' : 'Add Society'}</span><IconButton onClick={() => setFormOpen(false)} size="small"><X className="w-5 h-5" /></IconButton></DialogTitle>
        <form onSubmit={handleSave}>
          <DialogContent className="space-y-4">
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 7 }}><TextField label="Society Name" required fullWidth value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Grid>
              <Grid size={{ xs: 12, sm: 5 }}><TextField label="Registration No." fullWidth value={form.registrationNumber} onChange={(e) => setForm((f) => ({ ...f, registrationNumber: e.target.value }))} /></Grid>
              <Grid size={{ xs: 12 }}><TextField label="Full Address" required fullWidth multiline rows={2} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></Grid>
              <Grid size={{ xs: 12, sm: 4 }}><TextField label="City" fullWidth value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} /></Grid>
              <Grid size={{ xs: 12, sm: 4 }}><TextField label="State" fullWidth value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} /></Grid>
              <Grid size={{ xs: 12, sm: 4 }}><TextField label="Pincode" fullWidth value={form.pincode} onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))} /></Grid>
            </Grid>

            <div className="space-y-1">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Pin Location</span>
              <LocationPicker latitude={form.latitude} longitude={form.longitude}
                onChange={(v) => setForm((f) => ({ 
                  ...f, 
                  latitude: v.latitude, 
                  longitude: v.longitude, 
                  ...(v.address ? { address: v.address } : {}),
                  ...(v.city ? { city: v.city } : {}),
                  ...(v.state ? { state: v.state } : {}),
                  ...(v.pincode ? { pincode: v.pincode } : {}),
                }))} />
              <Grid container spacing={2} className="pt-1">
                <Grid size={{ xs: 6 }}><TextField label="Latitude" size="small" fullWidth value={form.latitude} onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))} /></Grid>
                <Grid size={{ xs: 6 }}><TextField label="Longitude" size="small" fullWidth value={form.longitude} onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))} /></Grid>
              </Grid>
            </div>

            <Grid container spacing={2}>
              <Grid size={{ xs: 6, sm: 3 }}><TextField label="Total Blocks" type="number" fullWidth value={form.totalBlocks} onChange={(e) => setForm((f) => ({ ...f, totalBlocks: e.target.value }))} /></Grid>
              <Grid size={{ xs: 6, sm: 3 }}><TextField label="Total Flats" type="number" fullWidth value={form.totalFlats} onChange={(e) => setForm((f) => ({ ...f, totalFlats: e.target.value }))} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField label="Website" fullWidth value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} /></Grid>
            </Grid>

            <div className="pt-2 border-t border-slate-100">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">Primary Admin Contact</span>
              <Grid container spacing={2} className="mt-1">
                <Grid size={{ xs: 12, sm: 5 }}><TextField label="Admin Name" fullWidth value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} /></Grid>
                <Grid size={{ xs: 12, sm: 4 }}><TextField label="Admin Email" type="email" fullWidth value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} /></Grid>
                <Grid size={{ xs: 12, sm: 3 }}><TextField label="Phone" fullWidth value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} /></Grid>
              </Grid>
              {!editTarget && <p className="text-xs text-slate-400 mt-2">If an admin email is given, login credentials are emailed and a free trial starts immediately.</p>}
            </div>
          </DialogContent>
          <DialogActions className="p-5 pt-0 gap-2">
            <Button onClick={() => setFormOpen(false)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
            <Button type="submit" disabled={saving} variant="contained" fullWidth className="py-2.5 font-bold">{saving ? <CircularProgress size={20} color="inherit" /> : editTarget ? 'Save Changes' : 'Create Society'}</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Reject */}
      <Dialog open={!!rejectTarget} onClose={() => setRejectTarget(null)} slots={{ transition: Zoom }} maxWidth="xs" fullWidth>
        <DialogTitle>Reject Society</DialogTitle>
        <DialogContent>
          <p className="text-sm text-slate-500 mb-3">Provide a reason for rejecting <strong>{rejectTarget?.name}</strong>.</p>
          <TextField label="Reason" required fullWidth multiline rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
        </DialogContent>
        <DialogActions className="p-5 pt-0 gap-2">
          <Button onClick={() => setRejectTarget(null)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
          <Button onClick={submitReject} disabled={rejectReason.trim().length < 3} variant="contained" color="error" fullWidth className="py-2.5 font-bold">Reject</Button>
        </DialogActions>
      </Dialog>

      {/* Assign cash plan */}
      <Dialog open={!!cashTarget} onClose={() => setCashTarget(null)} slots={{ transition: Zoom }} maxWidth="xs" fullWidth>
        <DialogTitle className="flex justify-between items-center pr-3"><span>Upgrade / Assign Plan (Cash)</span><IconButton onClick={() => setCashTarget(null)} size="small"><X className="w-5 h-5" /></IconButton></DialogTitle>
        <form onSubmit={submitCash}>
          <DialogContent className="space-y-3">
            <p className="text-sm text-slate-500">Record an offline/cash payment for <strong>{cashTarget?.name}</strong>. If a plan is already active it is extended/upgraded into the future; a PDF invoice is generated.</p>
            <FormControl fullWidth>
              <span className="text-[10px] font-bold text-slate-500 uppercase mb-1">Plan</span>
              <Select value={cashForm.planId} onChange={(e) => setCashForm((f) => ({ ...f, planId: e.target.value as string }))} required>
                {plans.map((p) => <MenuItem key={p._id} value={p._id}>{p.name} — ₹{p.basePrice.toLocaleString('en-IN')}/mo</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <span className="text-[10px] font-bold text-slate-500 uppercase mb-1">Tenure</span>
              <Select value={cashForm.tenure} onChange={(e) => setCashForm((f) => ({ ...f, tenure: e.target.value as string }))}>
                {TENURES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Note (optional)" fullWidth value={cashForm.note} onChange={(e) => setCashForm((f) => ({ ...f, note: e.target.value }))} />
          </DialogContent>
          <DialogActions className="p-5 pt-0 gap-2">
            <Button onClick={() => setCashTarget(null)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
            <Button type="submit" disabled={saving || !cashForm.planId} variant="contained" fullWidth className="py-2.5 font-bold">{saving ? <CircularProgress size={20} color="inherit" /> : 'Assign & Invoice'}</Button>
          </DialogActions>
        </form>
      </Dialog>
    </div>
  );
}

