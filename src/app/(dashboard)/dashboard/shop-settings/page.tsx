'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  Button, TextField, CircularProgress, Paper, Grid, MenuItem
} from '@mui/material';
import { Save, Store, MapPin } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import LocationPicker from '@/components/common/LocationPicker';
import ModuleScope from '@/components/common/ModuleScope';

export default function ShopSettingsPage() {
  const { showToast } = useToastConfirm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', address: '', contactNumber: '', adminEmail: '',
    gstNumber: '', storeType: '', typeService: '', salesAndProduct: '',
    city: '', state: '', pincode: '', latitude: '', longitude: ''
  });

  useEffect(() => {
    api.get('/shops/me/shop')
      .then((res) => {
        const s = res.data.shop;
        setForm({
          name: s.name || '',
          address: s.address || '',
          contactNumber: s.contactNumber || '',
          adminEmail: s.adminEmail || '',
          gstNumber: s.gstNumber || '',
          storeType: s.storeType || '',
          typeService: s.typeService || '',
          salesAndProduct: s.salesAndProduct || '',
          city: s.city || '',
          state: s.state || '',
          pincode: s.pincode || '',
          latitude: s.location?.coordinates[1]?.toString() || '',
          longitude: s.location?.coordinates[0]?.toString() || '',
        });
      })
      .catch(() => showToast('Failed to load shop settings', 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    if (!form.name || !form.address) {
      showToast('Name and address are required', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload: any = { ...form };
      if (form.latitude && form.longitude) {
        payload.latitude = Number(form.latitude);
        payload.longitude = Number(form.longitude);
      }
      await api.put('/shops/me/shop', payload);
      showToast('Shop settings saved successfully', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-32"><CircularProgress size={34} thickness={4} /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-5xl pb-4">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0a5bd7] to-[#2691f5] p-6 md:p-7 shadow-lg shadow-blue-500/10">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black text-white tracking-tight">Shop Settings</h1>
              <ModuleScope scope="shop" />
            </div>
            <p className="text-sm text-blue-100 mt-1">Manage your shop details, location, and business information.</p>
          </div>
          <Button onClick={handleSave} disabled={saving} variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save className="w-4 h-4" />}
            sx={{ whiteSpace: 'nowrap', backgroundImage: 'none', backgroundColor: '#fff', color: '#0a5bd7', '&:hover': { backgroundColor: '#f1f5f9', backgroundImage: 'none' } }}>
            Save Changes
          </Button>
        </div>
      </div>

      <Paper elevation={0} className="p-6 rounded-2xl border border-slate-200/70">
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 6 }}>
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-slate-500 font-black uppercase tracking-wider text-xs border-b border-slate-100 pb-2">
                <Store className="w-4 h-4" /> Basic Information
              </div>
              <TextField fullWidth label="Shop Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} variant="outlined" size="small" />
              <TextField fullWidth label="Admin Email" required type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} variant="outlined" size="small" />
              <TextField fullWidth label="Contact Number" value={form.contactNumber} onChange={(e) => setForm({ ...form, contactNumber: e.target.value })} variant="outlined" size="small" />
              <TextField fullWidth label="GST Number" value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} variant="outlined" size="small" />
              
              <div className="flex items-center gap-2 text-slate-500 font-black uppercase tracking-wider text-xs border-b border-slate-100 pb-2 pt-2">
                <Store className="w-4 h-4" /> Business Details
              </div>
              <TextField fullWidth label="Store Type" value={form.storeType} onChange={(e) => setForm({ ...form, storeType: e.target.value })} variant="outlined" size="small" />
              <TextField select fullWidth label="Type of Service" value={form.typeService} onChange={(e) => setForm({ ...form, typeService: e.target.value })} variant="outlined" size="small">
                {['Delivery', 'Dine-in', 'Takeaway', 'Installation', 'Repair', 'Consulting', 'Retail', 'Online', 'Offline', 'Other'].map(type => (
                  <MenuItem key={type} value={type}>{type}</MenuItem>
                ))}
              </TextField>
              <TextField fullWidth label="Sales & Product Info" value={form.salesAndProduct} onChange={(e) => setForm({ ...form, salesAndProduct: e.target.value })} variant="outlined" size="small" multiline rows={3} />
            </div>
          </Grid>
          
          <Grid size={{ xs: 12, md: 6 }}>
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-slate-500 font-black uppercase tracking-wider text-xs border-b border-slate-100 pb-2">
                <MapPin className="w-4 h-4" /> Location Information
              </div>
              <TextField fullWidth label="Full Address" required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} variant="outlined" size="small" multiline rows={2} />
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}><TextField fullWidth label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} variant="outlined" size="small" /></Grid>
                <Grid size={{ xs: 6 }}><TextField fullWidth label="Pincode" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} variant="outlined" size="small" /></Grid>
              </Grid>
              
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Map Location</span>
                <LocationPicker
                  latitude={form.latitude} longitude={form.longitude}
                  onChange={(v) => setForm((prev) => ({
                    ...prev,
                    latitude: v.latitude,
                    longitude: v.longitude,
                    ...(v.address ? { address: v.address } : {}),
                    ...(v.city ? { city: v.city } : {}),
                    ...(v.state ? { state: v.state } : {}),
                    ...(v.pincode ? { pincode: v.pincode } : {}),
                  }))}
                  height={250}
                />
              </div>
            </div>
          </Grid>
        </Grid>
      </Paper>
    </div>
  );
}
