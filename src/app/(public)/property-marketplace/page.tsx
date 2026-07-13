'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import ListingCard, { type ListingCardData } from '@/components/marketplace/ListingCard';
import SkeletonCard from '@/components/marketplace/SkeletonCard';
import CityAutocomplete from '@/components/marketplace/CityAutocomplete';
import { MapPin, Locate, SlidersHorizontal, Map, List, RefreshCw, Home } from 'lucide-react';
import dynamic from 'next/dynamic';

const GoogleMarketMap = dynamic(() => import('@/components/marketplace/GoogleMarketMap'), { ssr: false, loading: () => <div className="w-full h-full bg-slate-100 animate-pulse rounded-2xl flex items-center justify-center text-slate-400">Loading Map...</div> });

type SortOption = 'relevance' | 'price_asc' | 'price_desc' | 'newest';

const SORT_LABELS: Record<SortOption, string> = {
  relevance: 'Most relevant',
  price_asc: 'Price: Low → High',
  price_desc: 'Price: High → Low',
  newest: 'Newest first',
};

const FURNISHING_LABELS = [
  { value: '', label: 'Any furnishing' },
  { value: 'UNFURNISHED', label: 'Unfurnished' },
  { value: 'SEMI_FURNISHED', label: 'Semi-furnished' },
  { value: 'FURNISHED', label: 'Furnished' },
];

function PublicBrowseContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Filter state — initialized from URL for shareable links
  const [city, setCity] = useState(searchParams.get('city') || '');
  const [kind, setKind] = useState(searchParams.get('kind') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('max') || '');
  const [minPrice, setMinPrice] = useState(searchParams.get('min') || '');
  const [bedrooms, setBedrooms] = useState(searchParams.get('bedrooms') || '');
  const [furnishing, setFurnishing] = useState(searchParams.get('furnishing') || '');
  const [sort, setSort] = useState<SortOption>((searchParams.get('sort') as SortOption) || 'relevance');
  const [coords, setCoords] = useState<[number, number] | null>(
    searchParams.get('lng') && searchParams.get('lat')
      ? [parseFloat(searchParams.get('lng')!), parseFloat(searchParams.get('lat')!)]
      : null
  );
  const [radiusKm, setRadiusKm] = useState<number>(
    searchParams.get('radius') ? parseInt(searchParams.get('radius')!, 10) : 10
  );

  // Listing + pagination state
  const [listings, setListings] = useState<ListingCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  // UI state
  const [view, setView] = useState<'list' | 'map'>('list');
  const [showFilters, setShowFilters] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [mapSearchArea, setMapSearchArea] = useState<[number, number] | null>(null);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());

  const observerTarget = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Push current filters to URL so the link is shareable
  const syncUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (city) params.set('city', city);
    if (kind) params.set('kind', kind);
    if (minPrice) params.set('min', minPrice);
    if (maxPrice) params.set('max', maxPrice);
    if (bedrooms) params.set('bedrooms', bedrooms);
    if (furnishing) params.set('furnishing', furnishing);
    if (sort !== 'relevance') params.set('sort', sort);
    if (coords) { 
      params.set('lng', String(coords[0])); 
      params.set('lat', String(coords[1])); 
      params.set('radius', String(radiusKm)); 
    }
    router.replace(`/property-marketplace?${params.toString()}`, { scroll: false });
  }, [city, kind, minPrice, maxPrice, bedrooms, furnishing, sort, coords, radiusKm, router]);

  const fetchListings = useCallback(async (cursorParam?: string | null, append = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);
    setError('');

    try {
      const params: Record<string, any> = { pageSize: 18, sort };
      if (coords || mapSearchArea) {
        const c = (mapSearchArea || coords)!;
        params.lng = c[0]; params.lat = c[1];
        params.radiusKm = radiusKm;
      } else {
        if (city) params.city = city;
      }
      if (kind) params.kind = kind;
      if (minPrice) params.min = minPrice;
      if (maxPrice) params.max = maxPrice;
      if (bedrooms) params.bedrooms = bedrooms;
      if (furnishing) params.furnishing = furnishing;
      if (cursorParam) params.cursor = cursorParam;

      const res = await api.get('/public/marketplace/listings', { params });
      const data = res.data;

      setListings((prev) => append ? [...prev, ...(data.listings || [])] : (data.listings || []));
      setHasMore(!!data.hasMore);
      setNextCursor(data.nextCursor || null);
      if (data.total !== undefined) setTotal(data.total);
    } catch {
      setError('Could not load listings. Please try again.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [city, kind, minPrice, maxPrice, bedrooms, furnishing, sort, coords, mapSearchArea, radiusKm]);

  // Debounce filter changes
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setNextCursor(null);
      fetchListings(null, false);
      syncUrl();
    }, 400);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, kind, minPrice, maxPrice, bedrooms, furnishing, sort, coords, mapSearchArea, radiusKm]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const el = observerTarget.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && nextCursor) {
        fetchListings(nextCursor, true);
      }
    }, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, nextCursor, fetchListings]);

  const nearMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords([pos.coords.longitude, pos.coords.latitude]),
      () => setError('Could not get your location. Please allow location access and try again.')
    );
  };

  const clearLocation = () => { setCoords(null); setMapSearchArea(null); };

  // Unified handler for map click / pin drag / "search this area".
  // Moves the search pin and writes the reverse-geocoded locality back into the search box.
  const handlePickLocation = useCallback((c: [number, number], label?: string) => {
    setCoords(c);
    setMapSearchArea(c);
    if (label) setCity(label);
    setNextCursor(null);
  }, []);

  const toggleFavorite = async (id: string) => {
    try {
      const res = await api.post(`/marketplace/favorites/${id}`);
      setFavIds((prev) => {
        const next = new Set(prev);
        res.data.favorited ? next.add(id) : next.delete(id);
        return next;
      });
    } catch { /* silent — not authenticated */ }
  };

  const isLocated = !!(coords || mapSearchArea);

  return (
    <div className="space-y-0">
      {/* ── Hero Search ── */}
      <div className="rounded-[2.5rem] p-6 md:p-12 text-white relative mb-8 shadow-lg z-40"
        style={{ background: 'linear-gradient(135deg, var(--mkt-primary), var(--mkt-primary-strong), #0f172a)' }}>
        <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden pointer-events-none z-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-[#0ea5e9]/20 rounded-full blur-[60px] translate-y-1/3 -translate-x-1/4" />
        </div>
        <div className="relative z-10 text-center md:text-left">
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-tight drop-shadow-sm">Find your next home</h1>
          <p className="mt-4 text-white/90 text-lg md:text-xl font-medium max-w-2xl">Verified flats to rent and buy in premium societies.</p>

          {/* Search bar */}
          <div className="mt-8 bg-white/95 backdrop-blur-md rounded-2xl p-2 md:p-3 flex flex-col md:flex-row items-center gap-3 shadow-2xl mx-auto md:mx-0 max-w-3xl"
            style={{ color: 'var(--mkt-ink)' }}>
            <CityAutocomplete
              value={city}
              onChange={setCity}
              onSelect={(c, lat, lng) => {
                setCity(c);
                if (lat !== undefined && lng !== undefined) {
                  setCoords([lng, lat]);
                  setMapSearchArea([lng, lat]);
                } else if (!c) {
                  clearLocation();
                }
                setNextCursor(null);
              }}
            />
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="text-sm px-3 py-2 rounded-xl bg-slate-50 outline-none border-0"
              aria-label="Property type"
            >
              <option value="">Rent &amp; Buy</option>
              <option value="RENT">For Rent</option>
              <option value="SALE">For Sale</option>
            </select>
            <button
              onClick={isLocated ? clearLocation : nearMe}
              className="text-sm px-3 py-2 rounded-xl flex items-center gap-1.5 font-semibold transition-all"
              style={{
                background: isLocated ? 'var(--mkt-verified)' : 'var(--mkt-primary-soft)',
                color: isLocated ? '#fff' : 'var(--mkt-primary-strong)',
              }}
              aria-label={isLocated ? 'Clear location filter' : 'Use my location'}
            >
              {isLocated ? <MapPin className="w-4 h-4" /> : <Locate className="w-4 h-4" />}
              {isLocated ? 'Near me ✓' : 'Near me'}
            </button>
          </div>

          {isLocated && (
            <p className="mt-2 text-xs text-white/70 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Showing results near your location
            </p>
          )}
        </div>
      </div>

      {/* ── Filter rail + view toggle ── */}
      <div className="flex flex-wrap items-center gap-3 mb-6 bg-white p-2 rounded-2xl border sticky top-16 z-30 shadow-sm" style={{ borderColor: 'var(--mkt-line)' }}>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
          style={{ 
            color: showFilters ? 'white' : 'var(--mkt-ink)', 
            background: showFilters ? 'var(--mkt-primary)' : 'var(--mkt-surface)' 
          }}
        >
          <SlidersHorizontal className="w-4 h-4" /> Filters
        </button>

        <select value={sort} onChange={(e) => setSort(e.target.value as SortOption)}
          className="text-sm px-4 py-2.5 rounded-xl outline-none font-semibold transition-colors focus:ring-2 focus:ring-[var(--mkt-primary-soft)]"
          style={{ background: 'var(--mkt-surface)', color: 'var(--mkt-ink-soft)' }}
          aria-label="Sort listings">
          {Object.entries(SORT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>

        {total !== null && (
          <span className="text-sm ml-1 font-medium hidden sm:inline" style={{ color: 'var(--mkt-muted)' }}>
            {total.toLocaleString()} propert{total === 1 ? 'y' : 'ies'}
          </span>
        )}

        <div className="ml-auto flex rounded-xl overflow-hidden shadow-sm border border-slate-200">
          {(['list', 'map'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className="px-5 py-2.5 text-sm font-bold flex items-center gap-2 transition-all relative"
              style={{ background: view === v ? 'var(--mkt-primary)' : 'white', color: view === v ? '#fff' : 'var(--mkt-ink-soft)' }}
              aria-pressed={view === v}>
              {v === 'list' ? <List className="w-4 h-4" /> : <Map className="w-4 h-4" />}
              {v === 'list' ? 'List' : 'Map'}
            </button>
          ))}
        </div>
      </div>

      {/* Expanded filter panel */}
      {showFilters && (
        <div className="mb-4 p-4 rounded-2xl border bg-white grid grid-cols-2 md:grid-cols-4 gap-3"
          style={{ borderColor: 'var(--mkt-line)' }}>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--mkt-muted)' }}>Min price (₹)</label>
            <input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)}
              placeholder="e.g. 5000" className="w-full text-sm border rounded-xl px-3 py-2 outline-none"
              style={{ borderColor: 'var(--mkt-line)' }} aria-label="Minimum price" />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--mkt-muted)' }}>Max price (₹)</label>
            <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="e.g. 50000" className="w-full text-sm border rounded-xl px-3 py-2 outline-none"
              style={{ borderColor: 'var(--mkt-line)' }} aria-label="Maximum price" />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--mkt-muted)' }}>Bedrooms (min)</label>
            <input type="number" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)}
              placeholder="e.g. 2" min="0" className="w-full text-sm border rounded-xl px-3 py-2 outline-none"
              style={{ borderColor: 'var(--mkt-line)' }} aria-label="Minimum bedrooms" />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--mkt-muted)' }}>Furnishing</label>
            <select value={furnishing} onChange={(e) => setFurnishing(e.target.value)}
              className="w-full text-sm border rounded-xl px-3 py-2 outline-none bg-white"
              style={{ borderColor: 'var(--mkt-line)' }} aria-label="Furnishing type">
              {FURNISHING_LABELS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* ── Main content: Split map + list ── */}
      <div className={`${view === 'map' ? 'flex gap-4 h-[calc(100vh-210px)] min-h-[420px] rounded-2xl overflow-hidden border' : ''}`}
        style={view === 'map' ? { borderColor: 'var(--mkt-line)' } : undefined}>
        {/* Listing grid — hidden on mobile in map view so the map goes full-screen */}
        <div className={`${view === 'map' ? 'hidden md:block md:w-[380px] lg:w-[440px] flex-shrink-0 overflow-y-auto p-3' : ''}`}>
          {error && (
            <div className="text-center py-16">
              <RefreshCw className="w-8 h-8 mx-auto mb-3 opacity-40" style={{ color: 'var(--mkt-muted)' }} />
              <p className="font-semibold" style={{ color: 'var(--mkt-ink)' }}>{error}</p>
              <button onClick={() => fetchListings(null, false)}
                className="mt-3 text-sm px-4 py-2 rounded-xl text-white font-semibold"
                style={{ background: 'var(--mkt-primary)' }}>
                Try again
              </button>
            </div>
          )}

          {!error && (
            <>
              {loading ? (
                <div className={`grid gap-5 ${view === 'map' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
                  {Array.from({ length: view === 'map' ? 4 : 9 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
              ) : listings.length === 0 ? (
                <div className="text-center py-24" style={{ color: 'var(--mkt-muted)' }}>
                  <Home className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-bold text-lg" style={{ color: 'var(--mkt-ink)' }}>No properties found</p>
                  <p className="text-sm mt-1">Try a different city, widen your budget, or remove filters.</p>
                  {(city || kind || minPrice || maxPrice || bedrooms || furnishing) && (
                    <button
                      onClick={() => { setCity(''); setKind(''); setMinPrice(''); setMaxPrice(''); setBedrooms(''); setFurnishing(''); clearLocation(); }}
                      className="mt-4 text-sm px-4 py-2 rounded-xl font-semibold border transition-colors hover:bg-slate-50"
                      style={{ borderColor: 'var(--mkt-line)', color: 'var(--mkt-primary)' }}>
                      Clear all filters
                    </button>
                  )}
                </div>
              ) : (
                <div className={`grid gap-5 ${view === 'map' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
                  {listings.map((l) => (
                    <div key={l._id} onMouseEnter={() => setHighlightedId(l._id)} onMouseLeave={() => setHighlightedId(null)}>
                      <ListingCard
                        listing={l}
                        isFavorited={favIds.has(l._id)}
                        onToggleFavorite={toggleFavorite}
                        highlighted={highlightedId === l._id}
                        onMouseEnter={() => setHighlightedId(l._id)}
                        onMouseLeave={() => setHighlightedId(null)}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Infinite scroll trigger */}
              <div ref={observerTarget} className="py-4 flex justify-center">
                {loadingMore && (
                  <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: 'var(--mkt-primary)' }} />
                )}
              </div>
            </>
          )}
        </div>

        {/* Map panel (split view) */}
        {view === 'map' && (
          <div className="flex-1 relative w-full h-full rounded-2xl overflow-hidden shadow-inner border border-slate-200">
            <GoogleMarketMap
              listings={listings}
              highlightedId={highlightedId}
              onHover={setHighlightedId}
              centerCoords={coords || mapSearchArea ? (coords || mapSearchArea)! : undefined}
              onPickLocation={handlePickLocation}
              distanceKm={coords || mapSearchArea ? radiusKm : undefined}
              onDistanceChange={setRadiusKm}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function PublicBrowsePage() {
  return (
    <Suspense fallback={<div className="p-10 text-center" style={{ color: 'var(--mkt-muted)' }}>Loading...</div>}>
      <PublicBrowseContent />
    </Suspense>
  );
}
