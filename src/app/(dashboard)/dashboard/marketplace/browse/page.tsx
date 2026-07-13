'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import VerifiedBadge from '@/components/marketplace/VerifiedBadge';
import GoogleMarketMap from '@/components/marketplace/GoogleMarketMap';
import {
  Button, Chip, TextField, MenuItem, Select, FormControl, InputLabel, CircularProgress,
  ToggleButton, ToggleButtonGroup, Dialog, DialogContent, IconButton,
} from '@mui/material';
import { MapPin, LayoutGrid, Map as MapIcon, Locate, KeyRound, Home, ImageOff, X, Rocket, Filter, Heart, BookmarkPlus } from 'lucide-react';

interface Card {
  _id: string; title: string; kind: string; pricePaise: number; priceType: string;
  bedrooms?: number; sizeLabel?: string; city?: string; distanceKm?: number;
  photos: { url: string; isCover: boolean }[]; verification?: { status: string };
  boost?: { active?: boolean; topPlacement?: boolean }; location?: { coordinates: number[] };
}

const inr = (p: number) => `₹${(p / 100).toLocaleString('en-IN')}`;

export default function BrowsePage() {
  const router = useRouter();
  const { showToast } = useToastConfirm();
  const [listings, setListings] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'map'>('grid');
  const [viewer, setViewer] = useState<[number, number] | null>(null);
  const [needsLocation, setNeedsLocation] = useState(false);

  const [kind, setKind] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [radiusKm, setRadiusKm] = useState(20);

  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.get('/marketplace/favorites/ids').then((r) => setFavIds(new Set(r.data.ids || []))).catch(() => {});
  }, []);

  const toggleFav = async (id: string) => {
    try {
      const r = await api.post(`/marketplace/favorites/${id}`);
      setFavIds((prev) => { const n = new Set(prev); if (r.data.favorited) n.add(id); else n.delete(id); return n; });
    } catch { showToast('Could not update favorite', 'error'); }
  };

  const saveSearch = async () => {
    try {
      await api.post('/marketplace/saved-searches', {
        name: kind ? `${kind} properties` : 'My search',
        criteria: { kind: kind || undefined, min: min || undefined, max: max || undefined, bedrooms: bedrooms || undefined },
        alertsEnabled: true,
      });
      showToast('Search saved — you’ll get alerts for new matches', 'success');
    } catch { showToast('Could not save search', 'error'); }
  };

  const fetchBrowse = useCallback(async (coords?: [number, number]) => {
    setLoading(true);
    try {
      const params: any = { pageSize: 24 };
      if (coords) { params.lng = coords[0]; params.lat = coords[1]; }
      params.radiusKm = radiusKm;
      if (kind) params.kind = kind;
      if (min) params.min = min;
      if (max) params.max = max;
      if (bedrooms) params.bedrooms = bedrooms;
      const res = await api.get('/marketplace/browse', { params });
      setListings(res.data.listings || []);
      setNeedsLocation(!!res.data.needsLocation);
      if (res.data.viewer) setViewer(res.data.viewer);
    } catch {
      showToast('Failed to load listings', 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, min, max, bedrooms, radiusKm]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchBrowse(viewer || undefined); }, [fetchBrowse]);

  const useMyLocation = () => {
    if (!navigator.geolocation) return showToast('Geolocation not available', 'error');
    navigator.geolocation.getCurrentPosition(
      (pos) => { const c: [number, number] = [pos.coords.longitude, pos.coords.latitude]; setViewer(c); fetchBrowse(c); },
      () => showToast('Could not get your location', 'error'),
    );
  };

  const openDetail = async (id: string) => {
    setDetailLoading(true); setDetail({ _id: id });
    try {
      const res = await api.get(`/marketplace/browse/${id}`);
      setDetail(res.data.listing);
    } catch {
      showToast('Failed to load listing', 'error'); setDetail(null);
    } finally { setDetailLoading(false); }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0f766e] to-[#14b8a6] p-6 shadow-lg">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2"><MapPin className="w-6 h-6 text-white" /><h1 className="text-2xl font-black text-white tracking-tight">Browse Properties</h1></div>
            <p className="text-sm text-teal-50 mt-1">Homes to rent and buy near you</p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => router.push('/property-marketplace')} variant="contained"
              sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff', boxShadow: 'none', '&:hover': { backgroundColor: 'rgba(255,255,255,0.3)', boxShadow: 'none' } }}>
              Public Resismart Homes
            </Button>
            <Button onClick={useMyLocation} variant="contained" startIcon={<Locate className="w-4 h-4" />}
              sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff', boxShadow: 'none', '&:hover': { backgroundColor: 'rgba(255,255,255,0.3)', boxShadow: 'none' } }}>
              Near me
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200/70 rounded-2xl p-3">
        <Filter className="w-4 h-4 text-slate-400 ml-1" />
        <FormControl size="small" sx={{ minWidth: 120 }}><InputLabel>Type</InputLabel>
          <Select value={kind} label="Type" onChange={(e) => setKind(e.target.value)}>
            <MenuItem value="">All</MenuItem><MenuItem value="RENT">For Rent</MenuItem><MenuItem value="SALE">For Sale</MenuItem>
          </Select>
        </FormControl>
        <TextField size="small" label="Min ₹" type="number" value={min} onChange={(e) => setMin(e.target.value)} sx={{ width: 110 }} />
        <TextField size="small" label="Max ₹" type="number" value={max} onChange={(e) => setMax(e.target.value)} sx={{ width: 110 }} />
        <TextField size="small" label="Min beds" type="number" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} sx={{ width: 100 }} />
        <div className="flex-1" />
        <Button size="small" onClick={saveSearch} startIcon={<BookmarkPlus className="w-4 h-4" />} sx={{ textTransform: 'none' }}>Save search</Button>
        <ToggleButtonGroup exclusive size="small" value={view} onChange={(_, v) => v && setView(v)}>
          <ToggleButton value="grid"><LayoutGrid className="w-4 h-4" /></ToggleButton>
          <ToggleButton value="map"><MapIcon className="w-4 h-4" /></ToggleButton>
        </ToggleButtonGroup>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><CircularProgress /></div>
      ) : needsLocation ? (
        <div className="text-center py-20 text-slate-400"><MapPin className="w-10 h-10 mx-auto mb-3 opacity-40" /><p className="font-semibold">Set your location</p><p className="text-sm">Tap “Near me” to find properties around you.</p></div>
      ) : listings.length === 0 ? (
        <div className="text-center py-20 text-slate-400"><Home className="w-10 h-10 mx-auto mb-3 opacity-40" /><p className="font-semibold">No properties found</p><p className="text-sm">Try widening your filters.</p></div>
      ) : view === 'map' && viewer ? (
        <div className="h-[520px]">
          <GoogleMarketMap 
            viewer={viewer} 
            listings={listings} 
            onSelect={openDetail} 
            centerCoords={viewer}
            distanceKm={radiusKm}
            onDistanceChange={setRadiusKm}
            onMapClick={(c) => { setViewer(c); }}
            publicMode={false}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {listings.map((l) => {
            const cover = l.photos?.find((p) => p.isCover) || l.photos?.[0];
            return (
              <div key={l._id} role="button" tabIndex={0} onClick={() => openDetail(l._id)} onKeyDown={(e) => e.key === 'Enter' && openDetail(l._id)} className="cursor-pointer text-left rounded-2xl border border-slate-200/70 bg-white overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative h-40 bg-slate-100">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover.url} alt="" className="w-full h-full object-cover" />
                  ) : <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageOff className="w-8 h-8" /></div>}
                  {l.boost?.topPlacement && <div className="absolute top-2 left-2"><Chip size="small" icon={<Rocket className="w-3 h-3" />} label="Featured" sx={{ height: 22, bgcolor: '#f59e0b', color: '#fff', fontWeight: 700 }} /></div>}
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    <VerifiedBadge status={l.verification?.status} />
                    <button onClick={(e) => { e.stopPropagation(); toggleFav(l._id); }} className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center shadow-sm">
                      <Heart className={`w-4 h-4 ${favIds.has(l._id) ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`} />
                    </button>
                  </div>
                </div>
                <div className="p-3.5">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                    {l.kind === 'RENT' ? <KeyRound className="w-3.5 h-3.5" /> : <Home className="w-3.5 h-3.5" />}
                    {l.kind === 'RENT' ? 'Rent' : 'Sale'}{l.distanceKm != null ? ` · ${l.distanceKm} km away` : ''}
                  </div>
                  <h3 className="font-bold text-slate-800 line-clamp-1">{l.title}</h3>
                  <div className="text-xs text-slate-500 mt-0.5">{[l.bedrooms ? `${l.bedrooms} BHK` : '', l.sizeLabel, l.city].filter(Boolean).join(' · ')}</div>
                  <div className="mt-2 text-lg font-black text-teal-700">{inr(l.pricePaise)}{l.priceType === 'PER_MONTH' ? <span className="text-xs font-medium text-slate-400">/mo</span> : ''}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!detail} onClose={() => setDetail(null)} maxWidth="md" fullWidth slotProps={{ paper: { className: 'rounded-2xl' } }}>
        <DialogContent className="p-0">
          <div className="relative">
            <IconButton onClick={() => setDetail(null)} sx={{ position: 'absolute', top: 8, right: 8, zIndex: 2, bgcolor: 'rgba(255,255,255,0.9)' }}><X className="w-4 h-4" /></IconButton>
            {detailLoading || !detail?.title ? (
              <div className="flex justify-center py-24"><CircularProgress /></div>
            ) : (
              <div>
                {detail.photos?.length > 0 && (
                  <div className="flex gap-1 overflow-x-auto bg-slate-900">
                    {detail.photos.map((p: any, i: number) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={p.url} alt="" className="h-64 object-cover flex-shrink-0" />
                    ))}
                  </div>
                )}
                <div className="p-6 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-black text-slate-800">{detail.title}</h2>
                      <div className="text-sm text-slate-500 mt-0.5">{[detail.bedrooms ? `${detail.bedrooms} BHK` : '', detail.sizeLabel, detail.furnishing?.replace('_', ' ').toLowerCase(), detail.city].filter(Boolean).join(' · ')}</div>
                    </div>
                    <VerifiedBadge status={detail.verification?.status} size="md" />
                  </div>
                  <div className="text-2xl font-black text-teal-700">{inr(detail.pricePaise)}{detail.priceType === 'PER_MONTH' ? <span className="text-sm font-medium text-slate-400">/mo</span> : ''}</div>
                  {detail.description && <p className="text-sm text-slate-600 whitespace-pre-line">{detail.description}</p>}
                  {detail.amenities?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">{detail.amenities.map((a: string, i: number) => <Chip key={i} size="small" label={a} variant="outlined" />)}</div>
                  )}
                  <div className="pt-2 border-t border-slate-100 mt-2">
                    {detail.contact?.revealPhone && detail.contact?.phone
                      ? <p className="text-sm">Contact: <span className="font-bold">{detail.contact.name || 'Owner'}</span> · {detail.contact.phone}</p>
                      : <p className="text-xs text-slate-400">Contact details are shared on inquiry.</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
