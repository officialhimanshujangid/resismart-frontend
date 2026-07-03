'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/lib/api';
import {
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  CircularProgress, Collapse, MenuItem, Grid, Select
} from '@mui/material';
import {
  Plus, SlidersHorizontal, RotateCcw, Search, CheckCircle2, XCircle, MapPin,
  CreditCard, Pencil, Ban, Eye, Receipt
} from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import LocationPicker from '@/components/common/LocationPicker';
import ModuleScope from '@/components/common/ModuleScope';
import ShopsMap from '@/components/shops/ShopsMap';

import { useApi } from '@/hooks/useApi';
import { DataTable, ColumnDef } from '@/components/common/DataTable';
import { FormTextField } from '@/components/common/form/FormTextField';
import { FormSelect } from '@/components/common/form/FormSelect';
import { shopFormSchema, ShopFormValues, SHOP_SERVICE_TYPES } from '@/validators/shop.validator';

export interface Shop {
  _id: string;
  name: string;
  address: string;
  status: 'PENDING' | 'ACTIVE' | 'REJECTED';
  contactNumber?: string;
  gstNumber?: string;
  storeType?: string;
  typeService?: string;
  salesAndProduct?: string;
  adminEmail?: string;
  city?: string;
  state?: string;
  pincode?: string;
  location?: { coordinates: number[] };
  rejectionReason?: string;
  createdByName?: string;
  updatedByName?: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
};

const blankForm = {
  name: '', address: '', contactNumber: '', adminEmail: '', gstNumber: '',
  storeType: '', typeService: undefined, salesAndProduct: '', city: '', state: '', pincode: '',
  latitude: '', longitude: '',
};

export default function ShopsManager({ mode }: { mode: 'manage' | 'approvals' }) {
  const { showToast, confirm } = useToastConfirm();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = Math.max(0, parseInt(searchParams.get('page') || '1', 10) - 1);
  const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
  const appliedSearch = searchParams.get('search') || '';
  const appliedStatus = searchParams.get('status') || (mode === 'approvals' ? 'PENDING' : 'all');

  const { data, loading, refetch } = useApi<any>(
    `/shops?isPagination=true&page=${page + 1}&pageSize=${pageSize}${appliedSearch ? `&search=${appliedSearch}` : ''}${appliedStatus !== 'all' ? `&status=${appliedStatus}` : ''}`
  );

  const shops = data?.shops || [];
  const totalCount = data?.pagination?.total ?? 0;

  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [mapShops, setMapShops] = useState<Shop[]>([]);
  const [mapLoading, setMapLoading] = useState(false);

  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState(appliedSearch);
  const [statusFilter, setStatusFilter] = useState(appliedStatus);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Shop | null>(null);
  const [saving, setSaving] = useState(false);

  const [rejectTarget, setRejectTarget] = useState<Shop | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const methods = useForm<ShopFormValues>({
    resolver: zodResolver(shopFormSchema),
    defaultValues: blankForm,
  });

  const updateUrl = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    const DEFAULTS: Record<string, string> = { page: '1', pageSize: '10', status: mode === 'approvals' ? 'PENDING' : 'all', search: '' };
    Object.entries(updates).forEach(([k, v]) => {
      if (!v || v === DEFAULTS[k]) params.delete(k);
      else params.set(k, v);
    });
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (viewMode === 'map' && mapShops.length === 0) {
      setMapLoading(true);
      api.get('/shops?isPagination=false')
        .then(res => setMapShops(res.data.shops || []))
        .catch(() => showToast('Failed to load map data', 'error'))
        .finally(() => setMapLoading(false));
    }
  }, [viewMode, mapShops.length, showToast]);

  const handleFormSubmit = async (formData: ShopFormValues) => {
    setSaving(true);
    try {
      const payload: any = { ...formData };
      if (formData.latitude && formData.longitude) {
        payload.latitude = Number(formData.latitude);
        payload.longitude = Number(formData.longitude);
      }
      if (editTarget) {
        await api.put(`/shops/${editTarget._id}`, payload);
        showToast('Shop updated successfully', 'success');
      } else {
        await api.post('/shops/register-admin', payload);
        showToast('Shop created & activated successfully', 'success');
      }
      setFormOpen(false);
      refetch();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save shop', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (shop: Shop) => {
    const isConfirmed = await confirm({
      title: 'Approve Shop',
      message: `Approve ${shop.name} and start their trial?`,
      confirmText: 'Approve & Activate',
    });

    if (isConfirmed) {
      try {
        await api.post(`/shops/${shop._id}/approve`);
        showToast('Shop approved successfully', 'success');
        refetch();
      } catch (err: any) {
        showToast(err.response?.data?.error || 'Failed to approve', 'error');
      }
    }
  };

  const submitReject = async () => {
    if (!rejectTarget || !rejectReason) return;
    try {
      await api.post(`/shops/${rejectTarget._id}/reject`, { reason: rejectReason });
      showToast('Shop rejected', 'success');
      setRejectTarget(null);
      refetch();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to reject', 'error');
    }
  };

  const columns: ColumnDef<Shop>[] = [
    {
      id: 'sno',
      label: 'S.No.',
      render: (_, index) => <span className="text-slate-500 font-medium whitespace-nowrap">{page * pageSize + index + 1}</span>,
    },
    {
      id: 'contact',
      label: 'Shop Contact',
      render: (s) => (
        <div>
          <div className="font-bold text-slate-900">{s.name}</div>
          <div className="text-sm font-medium text-slate-800">{s.adminEmail}</div>
          <div className="text-xs text-slate-500">{s.contactNumber}</div>
        </div>
      ),
    },
    {
      id: 'location',
      label: 'Location',
      render: (s) => (
        <div>
          <div className="text-sm text-slate-700 max-w-[200px] truncate">{s.address}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{[s.city, s.state, s.pincode].filter(Boolean).join(', ')}</div>
          <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3" /> {s.location ? 'Mapped' : 'Unmapped'}
          </div>
        </div>
      )
    },
    {
      id: 'status',
      label: 'Status',
      render: (s) => (
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${STATUS_STYLES[s.status]}`}>
          {s.status}
        </span>
      )
    },
    {
      id: 'createdBy',
      label: 'Created By',
      render: (s) => <div className="text-sm text-slate-700 font-medium">{s.createdByName || '-'}</div>
    },
    {
      id: 'createdAt',
      label: 'Created At',
      render: (s) => <div className="text-sm text-slate-700">{s.createdAt ? new Date(s.createdAt).toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}</div>
    },
    {
      id: 'updatedBy',
      label: 'Updated By',
      render: (s) => <div className="text-sm text-slate-700 font-medium">{s.updatedByName || '-'}</div>
    },
    {
      id: 'updatedAt',
      label: 'Updated At',
      render: (s) => <div className="text-sm text-slate-700">{s.updatedAt ? new Date(s.updatedAt).toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}</div>
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (s) => (
        <div className="flex items-center justify-end gap-1">
          {mode === 'approvals' && s.status === 'PENDING' ? (
            <>
              <IconButton onClick={() => handleApprove(s)} size="small" className="bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 text-slate-500 rounded-xl p-2"><CheckCircle2 className="w-4 h-4" /></IconButton>
              <IconButton onClick={() => { setRejectTarget(s); setRejectReason(''); }} size="small" className="bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-500 rounded-xl p-2"><XCircle className="w-4 h-4" /></IconButton>
            </>
          ) : (
            <>
              {s.status === 'ACTIVE' && (
                <>
                  <IconButton title="Assign Plan" onClick={() => router.push(`/owner/shops/${s._id}?action=cash`)} size="small" className="bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 text-slate-500 rounded-xl p-2 ml-1"><CreditCard className="w-4 h-4" /></IconButton>
                  <IconButton title="Manage Invoices" onClick={() => router.push(`/owner/shops/${s._id}?tab=2`)} size="small" className="bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-500 rounded-xl p-2 ml-1"><Receipt className="w-4 h-4" /></IconButton>
                </>
              )}
              <IconButton title="View Shop" onClick={() => router.push(`/owner/shops/${s._id}`)} size="small" className="bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 rounded-xl p-2 ml-1"><Eye className="w-4 h-4" /></IconButton>
              <IconButton title="Edit Shop" onClick={() => {
                setEditTarget(s);
                methods.reset({
                  name: s.name,
                  adminEmail: s.adminEmail || '',
                  contactNumber: s.contactNumber || '',
                  address: s.address,
                  gstNumber: s.gstNumber || '',
                  storeType: s.storeType || '',
                  typeService: s.typeService as any,
                  salesAndProduct: s.salesAndProduct || '',
                  city: s.city || '',
                  state: s.state || '',
                  pincode: s.pincode || '',
                  latitude: s.location?.coordinates[1]?.toString() || '',
                  longitude: s.location?.coordinates[0]?.toString() || '',
                });
                setFormOpen(true);
              }} className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg ml-1 w-8 h-8"><Pencil className="w-4 h-4" /></IconButton>
            </>
          )}
        </div>
      )
    }
  ];

  return (
    <>
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                {mode === 'approvals' ? 'Pending Shops' : 'Shop Directory'}
              </h1>
              <ModuleScope scope="shop" />
            </div>
            <p className="text-slate-500 text-sm mt-1">
                {mode === 'approvals' ? 'Review and approve public shop registrations.' : 'Manage all onboarded shops across the platform.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex bg-slate-100 rounded-xl p-1 shadow-inner border border-slate-200/60">
                <button onClick={() => setViewMode('list')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-[#0a5bd7] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>List</button>
                <button onClick={() => setViewMode('map')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'map' ? 'bg-white text-[#0a5bd7] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Map</button>
              </div>
              {mode === 'manage' && (
                <Button variant="contained" onClick={() => { setEditTarget(null); methods.reset({ ...blankForm }); setFormOpen(true); }} className="bg-[#0a5bd7] hover:bg-[#0a5bd7]/90 text-white shadow-md font-bold rounded-xl h-10 px-4">
                  <Plus className="w-4 h-4 mr-2" /> Add Shop
                </Button>
              )}
            </div>
          </div>

          {viewMode === 'list' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Button variant="outlined" onClick={() => setShowFilters(!showFilters)} className={`h-10 px-4 rounded-xl font-bold border-slate-200 transition-colors ${showFilters ? 'bg-slate-100 text-slate-800' : 'text-slate-600'}`}>
                  <SlidersHorizontal className="w-4 h-4 mr-2" /> Filters
                </Button>
                {(appliedSearch || appliedStatus !== (mode === 'approvals' ? 'PENDING' : 'all')) && (
                  <Button variant="text" onClick={() => { setSearchTerm(''); setStatusFilter(mode === 'approvals' ? 'PENDING' : 'all'); updateUrl({ search: '', status: mode === 'approvals' ? 'PENDING' : 'all', page: '1' }); }} className="h-10 text-slate-500 hover:text-slate-800 font-bold px-3">
                    <RotateCcw className="w-4 h-4 mr-2" /> Clear Filters
                  </Button>
                )}
              </div>

              <Collapse in={showFilters}>
                <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Search</label>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="text" placeholder="Search by name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && updateUrl({ search: searchTerm, page: '1' })} className="w-full pl-9 pr-3 h-10 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:border-[#0a5bd7] focus:ring-1 focus:ring-[#0a5bd7] outline-none transition-all" />
                    </div>
                  </div>
                  {mode === 'manage' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Status</label>
                      <Select size="small" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full bg-slate-50 rounded-xl h-10">
                        <MenuItem value="all">All Statuses</MenuItem>
                        <MenuItem value="ACTIVE">Active</MenuItem>
                        <MenuItem value="PENDING">Pending</MenuItem>
                        <MenuItem value="REJECTED">Rejected</MenuItem>
                      </Select>
                    </div>
                  )}
                  <div className="flex items-end">
                    <Button onClick={() => updateUrl({ search: searchTerm, status: statusFilter, page: '1' })} className="w-full h-10 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl">Apply Filters</Button>
                  </div>
                </div>
              </Collapse>

              <DataTable
                columns={columns}
                data={shops}
                loading={loading}
                emptyText="No shops found matching your criteria."
                keyExtractor={(s) => s._id}
                pagination={{
                  page,
                  pageSize,
                  total: totalCount,
                  onPageChange: (newPage) => updateUrl({ page: String(newPage + 1) }),
                  onPageSizeChange: (size) => updateUrl({ pageSize: String(size), page: '1' }),
                }}
              />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-2">
              {mapLoading ? (
                <div className="h-[600px] flex items-center justify-center text-slate-400">
                  <CircularProgress />
                </div>
              ) : (
                <ShopsMap shops={mapShops} height={600} />
              )}
            </div>
          )}
        </div>

        <Dialog open={formOpen} onClose={() => !saving && setFormOpen(false)} maxWidth="md" fullWidth slotProps={{ paper: { className: 'rounded-2xl p-2' } }}>
          <DialogTitle className="font-black text-xl text-slate-800 pb-2">
            {editTarget ? 'Edit Shop' : 'Add New Shop'}
          </DialogTitle>
          <FormProvider {...methods}>
            <form onSubmit={methods.handleSubmit(handleFormSubmit)}>
              <DialogContent className="space-y-6 pt-2">
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}><FormTextField name="name" label="Shop Name" required fullWidth /></Grid>
                  <Grid size={{ xs: 12, sm: 6 }}><FormTextField name="adminEmail" label="Admin Email" required type="email" fullWidth /></Grid>
                  <Grid size={{ xs: 12, sm: 6 }}><FormTextField name="contactNumber" label="Contact Number" fullWidth /></Grid>
                  <Grid size={{ xs: 12, sm: 6 }}><FormTextField name="gstNumber" label="GST Number" fullWidth /></Grid>
                  
                  <Grid size={{ xs: 12, sm: 6 }}><FormTextField name="storeType" label="Store Type" fullWidth /></Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormSelect name="typeService" label="Type of Service" fullWidth>
                      {SHOP_SERVICE_TYPES.map(type => (
                        <MenuItem key={type} value={type}>{type}</MenuItem>
                      ))}
                    </FormSelect>
                  </Grid>
                  <Grid size={{ xs: 12 }}><FormTextField name="salesAndProduct" label="Sales & Product Info" fullWidth multiline rows={2} /></Grid>

                  <Grid size={{ xs: 12 }}><FormTextField name="address" label="Full Address" required fullWidth multiline rows={2} /></Grid>
                  <Grid size={{ xs: 12, sm: 4 }}><FormTextField name="city" label="City" fullWidth /></Grid>
                  <Grid size={{ xs: 12, sm: 4 }}><FormTextField name="state" label="State" fullWidth /></Grid>
                  <Grid size={{ xs: 12, sm: 4 }}><FormTextField name="pincode" label="Pincode" fullWidth /></Grid>
                </Grid>

                <div className="space-y-1">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Pin Location</span>
                  <LocationPicker
                    latitude={methods.watch('latitude') as string}
                    longitude={methods.watch('longitude') as string}
                    onChange={(v) => {
                      if (v.latitude) methods.setValue('latitude', v.latitude);
                      if (v.longitude) methods.setValue('longitude', v.longitude);
                      if (v.address) methods.setValue('address', v.address);
                      if (v.city) methods.setValue('city', v.city);
                      if (v.state) methods.setValue('state', v.state);
                      if (v.pincode) methods.setValue('pincode', v.pincode);
                    }}
                  />
                  <Grid container spacing={2} className="pt-1">
                    <Grid size={{ xs: 6 }}><FormTextField name="latitude" label="Latitude" size="small" fullWidth /></Grid>
                    <Grid size={{ xs: 6 }}><FormTextField name="longitude" label="Longitude" size="small" fullWidth /></Grid>
                  </Grid>
                </div>
              </DialogContent>
              <DialogActions className="px-6 pb-6 pt-2">
                <Button onClick={() => setFormOpen(false)} disabled={saving} className="text-slate-500 font-bold">Cancel</Button>
                <Button type="submit" disabled={saving} variant="contained" className="bg-[#0a5bd7] font-bold rounded-xl shadow-md px-6">
                  {saving ? <CircularProgress size={20} className="text-white" /> : 'Save Shop'}
                </Button>
              </DialogActions>
            </form>
          </FormProvider>
        </Dialog>

        <Dialog open={!!rejectTarget} onClose={() => setRejectTarget(null)} maxWidth="xs" fullWidth slotProps={{ paper: { className: 'rounded-2xl p-2' } }}>
          <DialogTitle className="font-black text-xl text-red-700 flex items-center gap-2 pb-2">
            <Ban className="w-5 h-5" /> Reject Shop
          </DialogTitle>
          <DialogContent className="pt-2 space-y-4">
            <p className="text-sm text-slate-600 font-medium">Please provide a reason for rejecting <strong>{rejectTarget?.name}</strong>. This will be visible in the logs.</p>
            <TextField fullWidth label="Rejection Reason" required value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} variant="outlined" size="small" multiline rows={3} />
          </DialogContent>
          <DialogActions className="px-6 pb-6 pt-2">
            <Button onClick={() => setRejectTarget(null)} className="text-slate-500 font-bold">Cancel</Button>
            <Button onClick={submitReject} disabled={!rejectReason} variant="contained" color="error" className="font-bold rounded-xl shadow-md px-6">Reject Shop</Button>
          </DialogActions>
        </Dialog>

    </>
  );
}
