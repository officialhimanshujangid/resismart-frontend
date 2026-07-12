'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Button, TextField, CircularProgress, Paper, Grid, Switch, IconButton, Tooltip } from '@mui/material';
import { Save, Radius, Megaphone, Rocket, Plus, Trash2, Info, Power } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import ModuleScope from '@/components/common/ModuleScope';

interface PkgRow {
  key: string;
  _id?: string;
  label: string;
  priceRupees: string;
  durationDays: number;
  radiusKm: number;
  topPlacement: boolean;
  isActive: boolean;
}

let uid = 0;
const nextKey = () => `pkg_${++uid}`;

const emptyPkg = (): PkgRow => ({
  key: nextKey(), label: '', priceRupees: '', durationDays: 10, radiusKm: 25, topPlacement: true, isActive: true,
});

export default function MarketplaceSettingsPage() {
  const { showToast } = useToastConfirm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [listingsEnabled, setListingsEnabled] = useState(true);
  const [baseRadiusKm, setBaseRadiusKm] = useState<number>(5);
  const [maxRadiusKm, setMaxRadiusKm] = useState<number>(50);
  const [listingExpiryDays, setListingExpiryDays] = useState<number>(60);
  const [packages, setPackages] = useState<PkgRow[]>([]);

  useEffect(() => {
    api.get('/marketplace/ad-settings')
      .then((res) => {
        const s = res.data.settings;
        setListingsEnabled(!!s.listingsEnabled);
        setBaseRadiusKm(s.baseRadiusKm ?? 5);
        setMaxRadiusKm(s.maxRadiusKm ?? 50);
        setListingExpiryDays(s.listingExpiryDays ?? 60);
        setPackages((s.boostPackages || []).map((p: any) => ({
          key: p._id || nextKey(),
          _id: p._id,
          label: p.label,
          priceRupees: String((p.pricePaise ?? 0) / 100),
          durationDays: p.durationDays,
          radiusKm: p.radiusKm,
          topPlacement: !!p.topPlacement,
          isActive: !!p.isActive,
        })));
      })
      .catch(() => showToast('Failed to load marketplace settings', 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updatePkg = (key: string, patch: Partial<PkgRow>) =>
    setPackages((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const handleSave = async () => {
    // Client-side guards mirror the server rules for a friendlier UX.
    if (baseRadiusKm > maxRadiusKm) { showToast('Base radius cannot exceed the maximum radius', 'error'); return; }
    for (const p of packages) {
      if (!p.label.trim()) { showToast('Every boost package needs a label', 'error'); return; }
      if (p.radiusKm > maxRadiusKm) { showToast(`"${p.label}" radius exceeds the maximum radius`, 'error'); return; }
    }

    setSaving(true);
    try {
      await api.put('/marketplace/ad-settings', {
        listingsEnabled,
        baseRadiusKm: Number(baseRadiusKm),
        maxRadiusKm: Number(maxRadiusKm),
        listingExpiryDays: Number(listingExpiryDays),
        boostPackages: packages.map((p) => ({
          ...(p._id ? { _id: p._id } : {}),
          label: p.label.trim(),
          pricePaise: Math.round(Number(p.priceRupees || 0) * 100),
          durationDays: Number(p.durationDays),
          radiusKm: Number(p.radiusKm),
          topPlacement: p.topPlacement,
          isActive: p.isActive,
        })),
      });
      showToast('Marketplace settings saved', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-32"><CircularProgress size={34} thickness={4} /></div>;
  }

  const sectionHeader = (icon: React.ReactNode, title: string, desc: string, tone: string) => (
    <div className="flex items-start gap-3 mb-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone}`}>{icon}</div>
      <div>
        <h2 className="text-sm font-black text-slate-800">{title}</h2>
        <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-6xl pb-4">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0a5bd7] to-[#2691f5] p-6 md:p-7 shadow-lg shadow-blue-500/10">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black text-white tracking-tight">Marketplace Settings</h1>
              <ModuleScope scope="system" />
            </div>
            <p className="text-sm text-blue-100 mt-1">Free visibility radius, boost packages and pricing for property listings</p>
          </div>
          <Button onClick={handleSave} disabled={saving} variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save className="w-4 h-4" />}
            sx={{ whiteSpace: 'nowrap', backgroundImage: 'none', backgroundColor: '#fff', color: '#0a5bd7', '&:hover': { backgroundColor: '#f1f5f9', backgroundImage: 'none' } }}>
            Save Changes
          </Button>
        </div>
      </div>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <div className="space-y-5">
            {/* Master switch */}
            <Paper elevation={0} className="p-6 rounded-2xl border border-slate-200/70">
              {sectionHeader(<Power className="w-5 h-5" />, 'Marketplace', 'Master switch for property listings across the platform', 'bg-slate-100 text-slate-600')}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <p className="text-sm text-slate-500 max-w-sm">When off, new listings and boosts are disabled platform-wide. Existing data is preserved.</p>
                <div className="flex items-center gap-2">
                  <Switch checked={listingsEnabled} onChange={(e) => setListingsEnabled(e.target.checked)} />
                  <span className={`text-xs font-bold ${listingsEnabled ? 'text-emerald-600' : 'text-slate-400'}`}>{listingsEnabled ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>
            </Paper>

            {/* Radius */}
            <Paper elevation={0} className="p-6 rounded-2xl border border-slate-200/70">
              {sectionHeader(<Radius className="w-5 h-5" />, 'Visibility Radius', 'Free reach for every listing and the hard cap for paid boosts', 'bg-violet-50 text-violet-600')}
              <div className="flex items-end gap-4 flex-wrap">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Free Base Radius (km)</span>
                  <TextField hiddenLabel type="number" value={baseRadiusKm} onChange={(e) => setBaseRadiusKm(Number(e.target.value))} sx={{ width: 160 }} />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Maximum Radius (km)</span>
                  <TextField hiddenLabel type="number" value={maxRadiusKm} onChange={(e) => setMaxRadiusKm(Number(e.target.value))} sx={{ width: 160 }} />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Listing Expiry (days)</span>
                  <TextField hiddenLabel type="number" value={listingExpiryDays} onChange={(e) => setListingExpiryDays(Number(e.target.value))} sx={{ width: 160 }} />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-3">Every active listing is visible for free within the base radius. Buyers of a boost extend it — never beyond the maximum.</p>
            </Paper>

            {/* Boost packages */}
            <Paper elevation={0} className="p-6 rounded-2xl border border-slate-200/70">
              {sectionHeader(<Rocket className="w-5 h-5" />, 'Boost Packages', 'What advertisers can buy to expand reach and pin to the top', 'bg-amber-50 text-amber-600')}
              <div className="space-y-3">
                {packages.length === 0 && (
                  <p className="text-xs text-slate-400">No packages yet — add one below.</p>
                )}
                {packages.map((p) => (
                  <div key={p.key} className={`rounded-xl border p-4 transition-colors ${p.isActive ? 'border-slate-200/70' : 'border-slate-200/70 bg-slate-50/60 opacity-70'}`}>
                    <Grid container spacing={2} sx={{ alignItems: 'center' }}>
                      <Grid size={{ xs: 12, sm: 4 }}>
                        <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Label</span>
                        <TextField hiddenLabel fullWidth size="small" value={p.label} placeholder="e.g. 10-Day Spotlight"
                          onChange={(e) => updatePkg(p.key, { label: e.target.value })} sx={{ mt: 0.5 }} />
                      </Grid>
                      <Grid size={{ xs: 6, sm: 2 }}>
                        <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Price (₹)</span>
                        <TextField hiddenLabel fullWidth size="small" type="number" value={p.priceRupees}
                          onChange={(e) => updatePkg(p.key, { priceRupees: e.target.value })} sx={{ mt: 0.5 }} />
                      </Grid>
                      <Grid size={{ xs: 6, sm: 2 }}>
                        <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Days</span>
                        <TextField hiddenLabel fullWidth size="small" type="number" value={p.durationDays}
                          onChange={(e) => updatePkg(p.key, { durationDays: Number(e.target.value) })} sx={{ mt: 0.5 }} />
                      </Grid>
                      <Grid size={{ xs: 6, sm: 2 }}>
                        <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Radius (km)</span>
                        <TextField hiddenLabel fullWidth size="small" type="number" value={p.radiusKm}
                          onChange={(e) => updatePkg(p.key, { radiusKm: Number(e.target.value) })} sx={{ mt: 0.5 }} />
                      </Grid>
                      <Grid size={{ xs: 6, sm: 2 }}>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip title="Pin to top of results while active">
                            <div className="flex items-center gap-1">
                              <Megaphone className={`w-3.5 h-3.5 ${p.topPlacement ? 'text-amber-500' : 'text-slate-300'}`} />
                              <Switch size="small" checked={p.topPlacement} onChange={(e) => updatePkg(p.key, { topPlacement: e.target.checked })} />
                            </div>
                          </Tooltip>
                          <Tooltip title={p.isActive ? 'Active — buyers can purchase' : 'Hidden from buyers'}>
                            <Switch size="small" color="success" checked={p.isActive} onChange={(e) => updatePkg(p.key, { isActive: e.target.checked })} />
                          </Tooltip>
                          <Tooltip title="Remove package">
                            <IconButton size="small" onClick={() => setPackages((prev) => prev.filter((x) => x.key !== p.key))}>
                              <Trash2 className="w-4 h-4 text-rose-500" />
                            </IconButton>
                          </Tooltip>
                        </div>
                      </Grid>
                    </Grid>
                  </div>
                ))}
                <Button onClick={() => setPackages((prev) => [...prev, emptyPkg()])} startIcon={<Plus className="w-4 h-4" />}
                  variant="outlined" size="small" sx={{ mt: 1 }}>
                  Add Package
                </Button>
              </div>
            </Paper>
          </div>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper elevation={0} className="p-6 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 to-white sticky top-4 space-y-3">
            <div className="flex items-center gap-2 text-blue-700"><Info className="w-4 h-4" /><span className="font-black text-sm">How boosting works</span></div>
            <ul className="text-xs text-slate-600 space-y-2.5 leading-relaxed">
              {[
                'Every active listing shows for free within the base radius.',
                'A boost extends the listing’s radius and pins it to the top for the package duration.',
                'Prices are set here and charged at checkout — boosts are 100% platform revenue.',
                'A package radius can never exceed the maximum radius.',
                'Turn a package inactive to retire it without losing past purchase history.',
              ].map((t, i) => (
                <li key={i} className="flex gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />{t}</li>
              ))}
            </ul>
          </Paper>
        </Grid>
      </Grid>
    </div>
  );
}
