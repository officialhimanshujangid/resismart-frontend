'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import VerifiedBadge from '@/components/marketplace/VerifiedBadge';
import { CircularProgress } from '@mui/material';
import { Search, MapPin, Locate, KeyRound, Home, ImageOff, Rocket } from 'lucide-react';

interface Card {
  _id: string; slug: string; title: string; kind: string; pricePaise: number; priceType: string;
  bedrooms?: number; sizeLabel?: string; city?: string; distanceKm?: number;
  photos: { url: string; isCover: boolean }[]; verification?: { status: string }; boost?: { topPlacement?: boolean };
}

const inr = (p: number) => `₹${(p / 100).toLocaleString('en-IN')}`;

export default function PublicBrowsePage() {
  const [listings, setListings] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState('');
  const [kind, setKind] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [coords, setCoords] = useState<[number, number] | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { pageSize: 24 };
      if (coords) { params.lng = coords[0]; params.lat = coords[1]; }
      if (city) params.city = city;
      if (kind) params.kind = kind;
      if (maxPrice) params.max = maxPrice;
      const res = await api.get('/public/marketplace/listings', { params });
      setListings(res.data.listings || []);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [city, kind, maxPrice, coords]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const nearMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => setCoords([pos.coords.longitude, pos.coords.latitude]));
  };

  return (
    <div className="space-y-6">
      {/* Hero + search */}
      <div className="rounded-3xl p-8 text-white relative overflow-hidden" style={{ background: 'linear-gradient(120deg, var(--mkt-primary), var(--mkt-primary-strong))' }}>
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
        <div className="relative">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Find your next home</h1>
          <p className="mt-1 text-white/80">Verified flats to rent and buy in trusted societies.</p>
          <div className="mt-5 bg-white rounded-2xl p-2 flex flex-wrap items-center gap-2 shadow-lg" style={{ color: 'var(--mkt-ink)' }}>
            <div className="flex items-center gap-2 px-3 flex-1 min-w-[160px]">
              <Search className="w-4 h-4 text-slate-400" />
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="py-2 w-full outline-none text-sm" />
            </div>
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="text-sm px-3 py-2 rounded-xl bg-slate-50 outline-none">
              <option value="">Rent & Buy</option><option value="RENT">Rent</option><option value="SALE">Buy</option>
            </select>
            <input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Max ₹" type="number" className="text-sm px-3 py-2 rounded-xl bg-slate-50 outline-none w-24" />
            <button onClick={nearMe} className="text-sm px-3 py-2 rounded-xl flex items-center gap-1 font-semibold" style={{ background: 'var(--mkt-primary-soft)', color: 'var(--mkt-primary-strong)' }}>
              <Locate className="w-4 h-4" /> Near me
            </button>
          </div>
          {coords && <p className="mt-2 text-xs text-white/70 flex items-center gap-1"><MapPin className="w-3 h-3" /> Showing results near your location</p>}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><CircularProgress /></div>
      ) : listings.length === 0 ? (
        <div className="text-center py-20" style={{ color: 'var(--mkt-muted)' }}>
          <Home className="w-10 h-10 mx-auto mb-3 opacity-40" /><p className="font-semibold">No properties found</p><p className="text-sm">Try a different city or widen your budget.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {listings.map((l) => {
            const cover = l.photos?.find((p) => p.isCover) || l.photos?.[0];
            return (
              <Link key={l._id} href={`/marketplace/${l.slug}`} className="rounded-2xl bg-white overflow-hidden border hover:shadow-xl transition-shadow" style={{ borderColor: 'var(--mkt-line)' }}>
                <div className="relative h-48 bg-slate-100">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover.url} alt={l.title} className="w-full h-full object-cover" />
                  ) : <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageOff className="w-8 h-8" /></div>}
                  {l.boost?.topPlacement && <span className="absolute top-2 left-2 text-[11px] font-bold text-white px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'var(--mkt-accent)' }}><Rocket className="w-3 h-3" /> Featured</span>}
                  <div className="absolute top-2 right-2"><VerifiedBadge status={l.verification?.status} /></div>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: 'var(--mkt-muted)' }}>
                    {l.kind === 'RENT' ? <KeyRound className="w-3.5 h-3.5" /> : <Home className="w-3.5 h-3.5" />}
                    {l.kind === 'RENT' ? 'For Rent' : 'For Sale'}{l.distanceKm != null ? ` · ${l.distanceKm} km away` : l.city ? ` · ${l.city}` : ''}
                  </div>
                  <h3 className="font-bold line-clamp-1" style={{ color: 'var(--mkt-ink)' }}>{l.title}</h3>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--mkt-muted)' }}>{[l.bedrooms ? `${l.bedrooms} BHK` : '', l.sizeLabel].filter(Boolean).join(' · ')}</div>
                  <div className="mt-2 text-xl font-black" style={{ color: 'var(--mkt-primary)' }}>{inr(l.pricePaise)}{l.priceType === 'PER_MONTH' ? <span className="text-xs font-medium" style={{ color: 'var(--mkt-muted)' }}>/mo</span> : ''}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
