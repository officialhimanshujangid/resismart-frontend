'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import VerifiedBadge from '@/components/marketplace/VerifiedBadge';
import {
  Tabs, Tab, CircularProgress, Button, Switch, IconButton, Checkbox, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { Heart, Bell, Trash2, GitCompare, ImageOff, Bookmark } from 'lucide-react';

const inr = (p: number) => `₹${(p / 100).toLocaleString('en-IN')}`;

interface Listing {
  _id: string; title: string; kind: string; pricePaise: number; priceType: string;
  bedrooms?: number; sizeLabel?: string; furnishing?: string; city?: string; amenities?: string[];
  photos: { url: string; isCover: boolean }[]; verification?: { status: string };
}
interface Saved { _id: string; name?: string; criteria: any; alertsEnabled: boolean; }

export default function SavedPage() {
  const { showToast, confirm } = useToastConfirm();
  const [tab, setTab] = useState<'favorites' | 'searches'>('favorites');
  const [favorites, setFavorites] = useState<Listing[]>([]);
  const [searches, setSearches] = useState<Saved[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareData, setCompareData] = useState<Listing[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [f, s] = await Promise.all([api.get('/marketplace/favorites'), api.get('/marketplace/saved-searches')]);
      setFavorites(f.data.listings || []);
      setSearches(s.data.searches || []);
    } catch { showToast('Failed to load', 'error'); } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const unfav = async (id: string) => {
    try { await api.post(`/marketplace/favorites/${id}`); setFavorites((p) => p.filter((l) => l._id !== id)); setSelected((s) => s.filter((x) => x !== id)); }
    catch { showToast('Failed', 'error'); }
  };
  const toggleSelect = (id: string) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : s.length < 4 ? [...s, id] : (showToast('Compare up to 4', 'info'), s));

  const openCompare = async () => {
    try { const r = await api.get(`/marketplace/compare?ids=${selected.join(',')}`); setCompareData(r.data.listings || []); setCompareOpen(true); }
    catch { showToast('Failed to compare', 'error'); }
  };

  const toggleAlerts = async (s: Saved) => {
    try { await api.patch(`/marketplace/saved-searches/${s._id}`, { alertsEnabled: !s.alertsEnabled }); setSearches((prev) => prev.map((x) => x._id === s._id ? { ...x, alertsEnabled: !x.alertsEnabled } : x)); }
    catch { showToast('Failed', 'error'); }
  };
  const delSearch = async (s: Saved) => {
    const ok = await confirm({ title: 'Delete saved search', message: 'Remove this saved search and its alerts?', confirmText: 'Delete', severity: 'error' });
    if (!ok) return;
    try { await api.delete(`/marketplace/saved-searches/${s._id}`); setSearches((prev) => prev.filter((x) => x._id !== s._id)); } catch { showToast('Failed', 'error'); }
  };

  const criteriaSummary = (c: any) => [c.kind, c.city, c.bedrooms ? `${c.bedrooms}+ BHK` : '', c.minPaise ? `≥₹${c.minPaise / 100}` : '', c.maxPaise ? `≤₹${c.maxPaise / 100}` : ''].filter(Boolean).join(' · ') || 'Any';

  const rows: { label: string; get: (l: Listing) => React.ReactNode }[] = [
    { label: 'Price', get: (l) => <span className="font-bold text-teal-700">{inr(l.pricePaise)}{l.priceType === 'PER_MONTH' ? '/mo' : ''}</span> },
    { label: 'Type', get: (l) => l.kind },
    { label: 'Bedrooms', get: (l) => l.bedrooms ?? '—' },
    { label: 'Size', get: (l) => l.sizeLabel || '—' },
    { label: 'Furnishing', get: (l) => l.furnishing?.replace('_', ' ').toLowerCase() || '—' },
    { label: 'City', get: (l) => l.city || '—' },
    { label: 'Verified', get: (l) => <VerifiedBadge status={l.verification?.status} /> },
    { label: 'Amenities', get: (l) => (l.amenities || []).join(', ') || '—' },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center"><Bookmark className="w-6 h-6" /></div>
        <div><h1 className="text-2xl font-black text-slate-800 tracking-tight">Saved</h1><p className="text-sm text-slate-500">Your shortlisted properties and search alerts</p></div>
      </div>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="favorites" icon={<Heart className="w-4 h-4" />} iconPosition="start" label={`Favorites (${favorites.length})`} sx={{ textTransform: 'none', fontWeight: 700 }} />
        <Tab value="searches" icon={<Bell className="w-4 h-4" />} iconPosition="start" label={`Saved searches (${searches.length})`} sx={{ textTransform: 'none', fontWeight: 700 }} />
      </Tabs>

      {loading ? <div className="flex justify-center py-20"><CircularProgress /></div> : tab === 'favorites' ? (
        favorites.length === 0 ? <div className="text-center py-16 text-slate-400"><Heart className="w-9 h-9 mx-auto mb-2 opacity-40" /><p className="text-sm">No favorites yet. Tap the heart on any listing.</p></div> : (
          <>
            {selected.length >= 2 && (
              <div className="flex justify-end"><Button variant="contained" startIcon={<GitCompare className="w-4 h-4" />} onClick={openCompare} sx={{ backgroundColor: '#0f766e', textTransform: 'none' }}>Compare ({selected.length})</Button></div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {favorites.map((l) => {
                const cover = l.photos?.find((p) => p.isCover) || l.photos?.[0];
                return (
                  <div key={l._id} className="rounded-2xl border border-slate-200/70 bg-white overflow-hidden">
                    <div className="relative h-36 bg-slate-100">
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cover.url} alt="" className="w-full h-full object-cover" />
                      ) : <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageOff className="w-7 h-7" /></div>}
                      <div className="absolute top-2 left-2 bg-white/90 rounded-lg"><Checkbox size="small" checked={selected.includes(l._id)} onChange={() => toggleSelect(l._id)} /></div>
                      <button onClick={() => unfav(l._id)} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center"><Heart className="w-4 h-4 fill-rose-500 text-rose-500" /></button>
                    </div>
                    <div className="p-3">
                      <h3 className="font-bold text-slate-800 line-clamp-1 text-sm">{l.title}</h3>
                      <div className="text-lg font-black text-teal-700 mt-0.5">{inr(l.pricePaise)}{l.priceType === 'PER_MONTH' ? <span className="text-xs font-medium text-slate-400">/mo</span> : ''}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )
      ) : (
        searches.length === 0 ? <div className="text-center py-16 text-slate-400"><Bell className="w-9 h-9 mx-auto mb-2 opacity-40" /><p className="text-sm">No saved searches. Save one from Browse to get alerts.</p></div> : (
          <div className="space-y-3">
            {searches.map((s) => (
              <div key={s._id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white p-4">
                <div>
                  <div className="font-bold text-slate-800">{s.name || 'Saved search'}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{criteriaSummary(s.criteria)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Alerts</span>
                  <Switch size="small" checked={s.alertsEnabled} onChange={() => toggleAlerts(s)} />
                  <IconButton size="small" onClick={() => delSearch(s)}><Trash2 className="w-4 h-4 text-rose-500" /></IconButton>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      <Dialog open={compareOpen} onClose={() => setCompareOpen(false)} maxWidth="lg" fullWidth slotProps={{ paper: { className: 'rounded-2xl' } }}>
        <DialogTitle className="font-bold border-b border-slate-100">Compare properties</DialogTitle>
        <DialogContent className="pt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className="text-left p-2 text-slate-400 font-bold"></th>{compareData.map((l) => <th key={l._id} className="text-left p-2 font-bold text-slate-800 min-w-[160px]">{l.title}</th>)}</tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-t border-slate-100">
                  <td className="p-2 text-slate-400 font-semibold whitespace-nowrap">{row.label}</td>
                  {compareData.map((l) => <td key={l._id} className="p-2 text-slate-700 capitalize">{row.get(l)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </DialogContent>
        <DialogActions className="p-4 border-t border-slate-100"><Button onClick={() => setCompareOpen(false)}>Close</Button></DialogActions>
      </Dialog>
    </div>
  );
}
