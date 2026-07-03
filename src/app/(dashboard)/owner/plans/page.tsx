'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import {
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  CircularProgress, TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  TablePagination, Paper, Zoom, Collapse, FormControl, Select, MenuItem,
  Grid, Switch, FormControlLabel,
} from '@mui/material';
import {
  Plus, Pencil, Trash2, X, SlidersHorizontal, RotateCcw, Search, Star, IndianRupee, Info,
  Package, CheckCircle2,
} from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import ModuleScope from '@/components/common/ModuleScope';
import StatCard from '@/components/common/StatCard';

interface Plan {
  _id: string;
  name: string;
  description?: string;
  module?: string;
  basePrice: number;
  currency: string;
  isActive: boolean;
  isFeatured: boolean;
  capabilities: Record<string, number>;
  billingCycles?: BillingCycle[];
  computedPricing?: { tenure: string; label: string; totalPrice: number; perMonthEquivalent: number; savedAmount: number; discountPercent: number }[];
  subscriberCount?: number;
  createdByName?: string;
  updatedByName?: string;
  createdAt: string;
  updatedAt: string;
}

interface BillingCycle {
  tenure: 'monthly' | 'quarterly' | 'halfYearly' | 'yearly';
  label: string;
  durationMonths: number;
  discountPercent: number;
  isEnabled: boolean;
}

const DEFAULT_CYCLES: BillingCycle[] = [
  { tenure: 'monthly', label: 'Monthly', durationMonths: 1, discountPercent: 0, isEnabled: true },
  { tenure: 'quarterly', label: 'Quarterly', durationMonths: 3, discountPercent: 10, isEnabled: true },
  { tenure: 'halfYearly', label: 'Half-Yearly', durationMonths: 6, discountPercent: 15, isEnabled: true },
  { tenure: 'yearly', label: 'Yearly', durationMonths: 12, discountPercent: 25, isEnabled: true },
];

const CURRENCIES = [
  { code: 'INR', label: '₹ Indian Rupee (INR)' },
  { code: 'USD', label: '$ US Dollar (USD)' },
  { code: 'EUR', label: '€ Euro (EUR)' },
  { code: 'GBP', label: '£ British Pound (GBP)' },
];

const SOCIETY_CAPABILITIES: { key: string; label: string }[] = [
  { key: 'max_flat_count', label: 'Max Flats' },
  { key: 'max_staff_count', label: 'Max Staff' },
  { key: 'max_member_count', label: 'Max Members' },
  { key: 'max_visitor_count', label: 'Max Visitors' },
  { key: 'max_tickets_count', label: 'Max Tickets' },
  { key: 'max_service_count', label: 'Max Services' },
];

const SHOP_CAPABILITIES: { key: string; label: string }[] = [
  { key: 'max_staff_count', label: 'Max Staff' },
  { key: 'max_inventory_items', label: 'Max Items' },
  { key: 'max_orders_per_day', label: 'Max Orders/Day' },
  { key: 'max_customers', label: 'Max Customers' },
];

const emptyCaps = (scope: string) => {
  const fields = scope === 'shop' ? SHOP_CAPABILITIES : SOCIETY_CAPABILITIES;
  return fields.reduce((a, f) => ({ ...a, [f.key]: 50 }), {} as Record<string, number>);
};

export default function PlansPage() {
  const { showToast, confirm } = useToastConfirm();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const scope = searchParams.get('scope') || 'society';
  const page = Math.max(0, parseInt(searchParams.get('page') || '1', 10) - 1);
  const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
  const appliedSearch = searchParams.get('search') || '';
  const appliedStatus = searchParams.get('status') || 'all';

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState(appliedSearch);
  const [statusFilter, setStatusFilter] = useState(appliedStatus);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Plan | null>(null);
  const [form, setForm] = useState({
    name: '', description: '', basePrice: 999, currency: 'INR', isFeatured: false, isActive: true,
    capabilities: emptyCaps(scope), billingCycles: DEFAULT_CYCLES.map((c) => ({ ...c })), module: scope
  });

  const updateCycle = (idx: number, patch: Partial<BillingCycle>) =>
    setForm((f) => ({ ...f, billingCycles: f.billingCycles.map((c, i) => (i === idx ? { ...c, ...patch } : c)) }));

  const updateUrl = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    const DEFAULTS: Record<string, string> = { page: '1', pageSize: '10', status: 'all', search: '' };
    Object.entries(updates).forEach(([k, v]) => {
      if (!v || v === DEFAULTS[k]) params.delete(k);
      else params.set(k, v);
    });
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    const doFetch = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        params.append('isPagination', 'true');
        params.append('module', scope);
        params.append('page', String(page + 1));
        params.append('pageSize', String(pageSize));
        if (appliedSearch) params.append('search', appliedSearch);
        if (appliedStatus !== 'all') params.append('status', appliedStatus);
        const res = await api.get(`/plans?${params.toString()}`);
        setPlans(res.data.plans || []);
        setTotalCount(res.data.pagination?.total ?? 0);
      } catch {
        showToast('Failed to load plans', 'error');
      } finally {
        setLoading(false);
      }
    };
    doFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, appliedSearch, appliedStatus, refreshKey, scope]);

  const [pub, setPub] = useState<Plan[]>([]);
  useEffect(() => { api.get('/plans/public').then((r) => setPub(r.data.plans || [])).catch(() => {}); }, [refreshKey]);

  const activeFiltersCount = (appliedSearch ? 1 : 0) + (appliedStatus !== 'all' ? 1 : 0);

  const cyclesFromPlan = (p: Plan): BillingCycle[] =>
    DEFAULT_CYCLES.map((d) => {
      const existing = p.billingCycles?.find((c) => c.tenure === d.tenure);
      return existing ? { ...d, discountPercent: existing.discountPercent, isEnabled: existing.isEnabled } : { ...d };
    });

  const openCreate = () => {
    setEditTarget(null);
    setForm({ name: '', description: '', basePrice: 999, currency: 'INR', isFeatured: false, isActive: true, capabilities: emptyCaps(scope), billingCycles: DEFAULT_CYCLES.map((c) => ({ ...c })), module: scope });
    setModalOpen(true);
  };

  const openEdit = (p: Plan) => {
    setEditTarget(p);
    setForm({
      name: p.name,
      description: p.description || '',
      basePrice: p.basePrice,
      currency: p.currency || 'INR',
      isFeatured: p.isFeatured,
      isActive: p.isActive,
      capabilities: { ...emptyCaps(scope), ...(p.capabilities || {}) },
      billingCycles: cyclesFromPlan(p),
      module: p.module || scope,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        module: form.module,
        basePrice: Number(form.basePrice),
        currency: form.currency,
        isFeatured: form.isFeatured,
        isActive: form.isActive,
        capabilities: Object.fromEntries(
          Object.entries(form.capabilities).map(([k, v]) => [k, Number(v)])
        ),
        billingCycles: form.billingCycles.map((c) => ({
          tenure: c.tenure,
          label: c.label,
          durationMonths: c.durationMonths,
          discountPercent: Number(c.discountPercent) || 0,
          isEnabled: c.isEnabled,
        })),
      };
      if (editTarget) {
        await api.put(`/plans/${editTarget._id}`, payload);
        showToast('Plan updated successfully', 'success');
      } else {
        await api.post('/plans', payload);
        showToast('Plan created successfully', 'success');
      }
      setModalOpen(false);
      refresh();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save plan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (p: Plan) => {
    try {
      await api.put(`/plans/${p._id}`, { isActive: !p.isActive });
      showToast(`Plan ${!p.isActive ? 'activated' : 'deactivated'}`, 'success');
      refresh();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update status', 'error');
    }
  };

  const handleDelete = async (p: Plan) => {
    const ok = await confirm({
      title: 'Delete Plan',
      message: `Delete the plan "${p.name}"? Existing subscriptions are unaffected.`,
      confirmText: 'Delete', cancelText: 'Cancel', severity: 'error',
    });
    if (!ok) return;
    try {
      await api.delete(`/plans/${p._id}`);
      showToast('Plan deleted', 'success');
      refresh();
    } catch {
      showToast('Failed to delete plan', 'error');
    }
  };

  const inr = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;
  const capLabel = (v: number) => (v === -1 ? '∞' : v);
  const fmtDate = (s?: string) => (s ? new Date(s).toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—');

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-800 tracking-tight capitalize">{scope} Plans & Pricing</h1>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">Subscription plans offered to tenants (societies & shops)</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button onClick={() => setShowFilters(!showFilters)} variant={showFilters || activeFiltersCount > 0 ? 'contained' : 'outlined'}
            color={activeFiltersCount > 0 ? 'primary' : 'inherit'} startIcon={<SlidersHorizontal className="w-4 h-4" />}
            sx={{ whiteSpace: 'nowrap' }}>
            Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
          </Button>
          <Button onClick={openCreate} variant="contained" startIcon={<Plus className="w-4 h-4" />} sx={{ whiteSpace: 'nowrap' }}>
            Add Plan
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total Plans" value={totalCount} loading={loading} tone="blue" icon={<Package className="w-5 h-5" />} />
        <StatCard label="Customer-facing" value={pub.length} loading={loading} tone="emerald" icon={<CheckCircle2 className="w-5 h-5" />} />
        <StatCard label="Featured" value={pub.filter((p) => p.isFeatured).length} loading={loading} tone="amber" icon={<Star className="w-5 h-5" />} />
      </div>

      <Collapse in={showFilters}>
        <Paper elevation={0} className="p-5 rounded-2xl border border-slate-200/60 bg-slate-50/40 space-y-4">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }} className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Search</span>
              <TextField hiddenLabel fullWidth variant="outlined" placeholder="Search name or description..."
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                slotProps={{ input: { startAdornment: <Search className="w-4 h-4 text-slate-400 mr-2" /> } }} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }} className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Status</span>
              <FormControl fullWidth>
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as string)} className="bg-white rounded-xl">
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }} className="flex items-end gap-2">
              <Button variant="contained" fullWidth startIcon={<Search className="w-3.5 h-3.5" />}
                onClick={() => updateUrl({ search: searchTerm, status: statusFilter, page: '1' })}>Apply</Button>
              <Button variant="text" onClick={() => { setSearchTerm(''); setStatusFilter('all'); router.push(pathname, { scroll: false }); }}>
                <RotateCcw className="w-4 h-4" />
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </Collapse>

      <TableContainer component={Paper} elevation={1} className="rounded-2xl border border-slate-200/60 shadow-sm overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20 bg-white"><CircularProgress size={32} thickness={4} /></div>
        ) : plans.length === 0 ? (
          <div className="text-center py-20 text-slate-400 font-semibold text-sm bg-white">No plans yet. Click &quot;Add Plan&quot; to create one.</div>
        ) : (
          <Table sx={{ minWidth: 1320 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 60 }}>S.No.</TableCell>
                <TableCell>Plan</TableCell>
                <TableCell>Base / mo</TableCell>
                <TableCell>Yearly</TableCell>
                <TableCell>Subscribers</TableCell>
                <TableCell>{scope === 'shop' ? 'Staff' : 'Flats'}</TableCell>
                <TableCell>{scope === 'shop' ? 'Items' : 'Staff'}</TableCell>
                <TableCell>{scope === 'shop' ? 'Orders/Day' : 'Members'}</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created By</TableCell>
                <TableCell>Created At</TableCell>
                <TableCell>Updated By</TableCell>
                <TableCell>Updated At</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody className="bg-white">
              {plans.map((p, i) => {
                const yearly = p.computedPricing?.find((c) => c.tenure === 'yearly');
                return (
                  <TableRow key={p._id}>
                    <TableCell className="font-semibold text-slate-500">{page * pageSize + i + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">{p.name}</span>
                        {p.isFeatured && <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full"><Star className="w-3 h-3" /> Featured</span>}
                      </div>
                      <span className="text-xs text-slate-400 line-clamp-1">{p.description || '—'}</span>
                    </TableCell>
                    <TableCell className="font-bold text-slate-700">{inr(p.basePrice)}</TableCell>
                    <TableCell className="text-slate-600">{yearly ? inr(yearly.totalPrice) : '—'}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-xs font-black">{p.subscriberCount ?? 0}</span>
                    </TableCell>
                    <TableCell>{capLabel(scope === 'shop' ? (p.capabilities?.max_staff_count ?? 0) : (p.capabilities?.max_flat_count ?? 0))}</TableCell>
                    <TableCell>{capLabel(scope === 'shop' ? (p.capabilities?.max_inventory_items ?? 0) : (p.capabilities?.max_staff_count ?? 0))}</TableCell>
                    <TableCell>{capLabel(scope === 'shop' ? (p.capabilities?.max_orders_per_day ?? 0) : (p.capabilities?.max_member_count ?? 0))}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Switch checked={p.isActive} onChange={() => handleToggleActive(p)} color="primary" size="small" />
                        <span className={`text-xs font-bold ${p.isActive ? 'text-emerald-600' : 'text-slate-400'}`}>{p.isActive ? 'Active' : 'Inactive'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-slate-600">{p.createdByName || 'Owner'}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{fmtDate(p.createdAt)}</TableCell>
                    <TableCell className="text-sm font-semibold text-slate-600">{p.updatedByName || '—'}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{fmtDate(p.updatedAt)}</TableCell>
                    <TableCell align="right">
                      <div className="flex items-center justify-end gap-1">
                        <IconButton onClick={() => openEdit(p)} size="small" className="bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-500 rounded-xl p-2"><Pencil className="w-4 h-4" /></IconButton>
                        <IconButton onClick={() => handleDelete(p)} size="small" className="bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-500 rounded-xl p-2"><Trash2 className="w-4 h-4" /></IconButton>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <TablePagination component="div" count={totalCount} page={page}
          onPageChange={(_, np) => updateUrl({ page: String(np + 1) })}
          rowsPerPage={pageSize} onRowsPerPageChange={(e) => updateUrl({ pageSize: e.target.value, page: '1' })}
          rowsPerPageOptions={[5, 10, 25, 50]} sx={{ borderTop: '1px solid #f1f5f9', backgroundColor: '#fff' }} />
      </TableContainer>

      {/* Create / Edit Modal */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} slots={{ transition: Zoom }} maxWidth="md" fullWidth
        slotProps={{ paper: { sx: { maxHeight: 'calc(100% - 48px)' } } }}>
        <DialogTitle className="flex justify-between items-center pr-3">
          <span>{editTarget ? 'Edit Plan' : 'New Plan'}</span>
          <IconButton onClick={() => setModalOpen(false)} size="small"><X className="w-5 h-5" /></IconButton>
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent className="space-y-4">
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }} className="space-y-1">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Plan Name *</span>
                <TextField hiddenLabel required fullWidth placeholder="e.g. Growth" value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </Grid>
              <Grid size={{ xs: 12, sm: 7 }} className="space-y-1">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Currency</span>
                <FormControl fullWidth>
                  <Select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value as string }))}>
                    {CURRENCIES.map((c) => <MenuItem key={c.code} value={c.code}>{c.label}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 5 }} className="space-y-1">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Base Price / mo *</span>
                <TextField hiddenLabel required fullWidth type="number" value={form.basePrice}
                  onChange={(e) => setForm((f) => ({ ...f, basePrice: Number(e.target.value) }))}
                  slotProps={{ input: { startAdornment: <IndianRupee className="w-4 h-4 text-slate-400 mr-1" /> } }} />
              </Grid>
            </Grid>
            <div className="space-y-1">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">Description</span>
              <TextField hiddenLabel fullWidth multiline rows={2} placeholder="Short summary shown to customers..."
                value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>

            {/* Billing Cycles */}
            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#0a5bd7] border-b-2 border-[#0a5bd7]/30 pb-0.5 inline-block">Billing Cycles</span>
              <Grid container spacing={1.5}>
                {form.billingCycles.map((cyc, idx) => {
                  const full = Number(form.basePrice) * cyc.durationMonths;
                  const total = Math.round(full * (1 - (Number(cyc.discountPercent) || 0) / 100));
                  return (
                    <Grid size={{ xs: 12, sm: 6, md: 3 }} key={cyc.tenure}>
                      <div className={`p-3 rounded-xl border h-full ${cyc.isEnabled ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50/60 opacity-70'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-black uppercase tracking-wide text-slate-700">{cyc.label}</span>
                          <Switch size="small" checked={cyc.isEnabled} onChange={(e) => updateCycle(idx, { isEnabled: e.target.checked })} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Discount (%)</span>
                        <TextField hiddenLabel fullWidth size="small" type="number" value={cyc.discountPercent}
                          disabled={!cyc.isEnabled || cyc.tenure === 'monthly'}
                          onChange={(e) => updateCycle(idx, { discountPercent: Number(e.target.value) })} />
                        <div className="text-[10px] text-slate-400 mt-2">Duration: {cyc.durationMonths} Month{cyc.durationMonths > 1 ? 's' : ''}</div>
                        {cyc.isEnabled && form.basePrice > 0 && (
                          <div className="text-[11px] font-bold text-slate-700 mt-0.5">₹{total.toLocaleString('en-IN')} <span className="font-normal text-slate-400">total</span></div>
                        )}
                      </div>
                    </Grid>
                  );
                })}
              </Grid>
              <p className="text-[11px] text-slate-400">Monthly has no discount. Totals are computed from the base price × duration, less the discount.</p>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" /> Capability Limits (use -1 for unlimited)
              </span>
              <Grid container spacing={2}>
                {(scope === 'shop' ? SHOP_CAPABILITIES : SOCIETY_CAPABILITIES).map((c) => (
                  <Grid size={{ xs: 6, sm: 4 }} key={c.key} className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{c.label}</span>
                    <TextField hiddenLabel fullWidth type="number" size="small" value={form.capabilities[c.key]}
                      onChange={(e) => setForm((f) => ({ ...f, capabilities: { ...f.capabilities, [c.key]: Number(e.target.value) } }))} />
                  </Grid>
                ))}
              </Grid>
            </div>

            <div className="flex items-center gap-6 pt-1">
              <FormControlLabel control={<Switch checked={form.isFeatured} onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))} />} label={<span className="text-sm font-semibold text-slate-600">Featured</span>} />
              <FormControlLabel control={<Switch checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />} label={<span className="text-sm font-semibold text-slate-600">Active</span>} />
            </div>
            <p className="text-xs text-slate-400">Quarterly / half-yearly / yearly prices and discounts are computed automatically from the base price.</p>
          </DialogContent>
          <DialogActions className="p-5 pt-0 gap-2">
            <Button onClick={() => setModalOpen(false)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
            <Button type="submit" disabled={saving} variant="contained" fullWidth className="py-2.5 font-bold">
              {saving ? <CircularProgress size={20} color="inherit" /> : editTarget ? 'Save Changes' : 'Create Plan'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </div>
  );
}
