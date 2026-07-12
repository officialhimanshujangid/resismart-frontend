'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { MapPin, Filter, Search } from 'lucide-react';
import { Slider, Chip } from '@mui/material';
import { GoogleMap, useJsApiLoader, Marker, Circle, InfoWindow } from '@react-google-maps/api';

const inr = (p: number) => `₹${(p / 100).toLocaleString('en-IN')}`;

interface Pin {
  _id: string; slug: string; title?: string; pricePaise?: number; kind?: string;
  status: string; location?: { coordinates: number[] };
  verification?: { status: string }; boost?: { topPlacement?: boolean };
  societyId?: { name: string };
}

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

export default function OwnerMarketplaceMap() {
  const [radius, setRadius] = useState(50); // km
  const [center, setCenter] = useState({ lat: 20.5937, lng: 78.9629 }); // India center roughly
  const [pins, setPins] = useState<Pin[]>([]);
  const [kindFilter, setKindFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
  });

  const fetchPins = useCallback(async (bbox: string) => {
    try {
      const res = await api.get(`/public/marketplace/listings/map`, { params: { bbox } });
      setPins(res.data.pins || []);
    } catch { /* silent */ }
  }, []);

  // Update bounds based on center and radius manually to fetch pins
  useEffect(() => {
    // We do a simple approx bbox calculation for the api fetch, Google Maps Circle will draw the exact circle.
    // 1 deg lat = ~111km, 1 deg lng = ~111km * cos(lat)
    const latOffset = radius / 111;
    const lngOffset = radius / (111 * Math.cos(center.lat * (Math.PI / 180)));
    const bbox = `${center.lng - lngOffset},${center.lat - latOffset},${center.lng + lngOffset},${center.lat + latOffset}`;
    fetchPins(bbox);
  }, [center, radius, fetchPins]);

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      setCenter({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      setSelectedPin(null);
    }
  };

  const visiblePins = pins.filter((p) => 
    (kindFilter ? p.kind === kindFilter : true) &&
    (statusFilter ? p.status === statusFilter : true)
  );

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] gap-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Property Marketplace Map</h1>
        <div className="text-sm text-slate-500 font-semibold">{visiblePins.length} listing{visiblePins.length !== 1 ? 's' : ''} in view</div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Sidebar */}
        <div className="w-80 bg-white rounded-2xl border border-slate-200/70 p-5 flex flex-col gap-6 overflow-y-auto">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3"><Filter className="w-4 h-4" /> Filters</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-2 block">Property Type</label>
                <div className="flex gap-2">
                  <Chip label="All" size="small" onClick={() => setKindFilter('')} color={!kindFilter ? 'primary' : 'default'} />
                  <Chip label="Rent" size="small" onClick={() => setKindFilter('RENT')} color={kindFilter === 'RENT' ? 'primary' : 'default'} />
                  <Chip label="Sale" size="small" onClick={() => setKindFilter('SALE')} color={kindFilter === 'SALE' ? 'primary' : 'default'} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-2 block">Status</label>
                <div className="flex gap-2 flex-wrap">
                  <Chip label="All Active" size="small" onClick={() => setStatusFilter('')} color={!statusFilter ? 'primary' : 'default'} />
                  <Chip label="Verified Only" size="small" onClick={() => setStatusFilter('ACTIVE')} color={statusFilter === 'ACTIVE' ? 'primary' : 'default'} />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-2"><Search className="w-4 h-4" /> Search Radius</h2>
            <p className="text-xs text-slate-500 mb-4">Click anywhere on the map to drop the center pin and move the search area.</p>
            <div className="px-2">
              <Slider
                value={radius} onChange={(_, v) => setRadius(v as number)}
                min={1} max={200} step={1}
                valueLabelDisplay="auto" valueLabelFormat={(v) => `${v} km`}
                sx={{ color: '#0f766e' }}
              />
              <div className="flex justify-between text-xs text-slate-400 font-semibold mt-1">
                <span>1 km</span><span>200 km</span>
              </div>
            </div>
          </div>
          
          <div className="border-t border-slate-100 pt-5 flex-1">
            <h2 className="text-sm font-bold text-slate-800 mb-3">Top results in area</h2>
            {visiblePins.length === 0 ? (
              <p className="text-xs text-slate-400">No listings found in this radius.</p>
            ) : (
              <div className="space-y-3">
                {visiblePins.slice(0, 10).map(p => (
                  <div key={p._id} className="text-sm border border-slate-100 rounded-lg p-2 hover:bg-slate-50 cursor-pointer" onClick={() => {
                    setCenter({ lat: p.location!.coordinates[1], lng: p.location!.coordinates[0] });
                    setSelectedPin(p);
                  }}>
                    <div className="font-bold text-slate-800 line-clamp-1">{p.title}</div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-teal-700 font-bold">{inr(p.pricePaise || 0)}</span>
                      <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 rounded">{p.kind}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 rounded-2xl overflow-hidden border border-slate-200/70 relative bg-slate-100">
          {!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-sm pointer-events-none">
              <div className="bg-white p-4 rounded-xl shadow-lg border border-red-200 text-center max-w-sm">
                <p className="text-red-600 font-bold mb-1">Missing Google Maps API Key</p>
                <p className="text-xs text-slate-600">Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your .env.local file.</p>
              </div>
            </div>
          )}
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={center}
              zoom={5}
              onClick={handleMapClick}
              options={{ disableDefaultUI: false }}
            >
              <Circle
                center={center}
                radius={radius * 1000}
                options={{
                  fillColor: '#0f766e',
                  fillOpacity: 0.1,
                  strokeColor: '#0f766e',
                  strokeOpacity: 0.8,
                  strokeWeight: 2,
                  clickable: false
                }}
              />
              <Marker position={center} icon={{ url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png' }} />
              
              {visiblePins.map((listing) => {
                const coords = listing.location?.coordinates;
                if (!coords || coords.length < 2) return null;
                const [lng, lat] = coords;
                
                const isBoosted = listing.boost?.topPlacement;
                const isVerified = listing.verification?.status === 'VERIFIED';
                const iconColor = isBoosted ? 'yellow' : (isVerified ? 'green' : 'red');

                return (
                  <Marker 
                    key={listing._id}
                    position={{ lat, lng }}
                    icon={{ url: `http://maps.google.com/mapfiles/ms/icons/${iconColor}-dot.png` }}
                    onClick={() => setSelectedPin(listing)}
                  />
                );
              })}

              {selectedPin && selectedPin.location?.coordinates && (
                <InfoWindow 
                  position={{ lat: selectedPin.location.coordinates[1], lng: selectedPin.location.coordinates[0] }}
                  onCloseClick={() => setSelectedPin(null)}
                >
                  <div style={{ minWidth: 140, fontFamily: 'sans-serif' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{selectedPin.title || 'Property'}</div>
                    <div style={{ color: '#0f766e', fontWeight: 800 }}>{selectedPin.pricePaise ? inr(selectedPin.pricePaise) : ''}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{selectedPin.societyId?.name || ''}</div>
                    <a href={`/property-marketplace/${selectedPin.slug}`} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 8, textAlign: 'center', background: '#0f766e', color: 'white', padding: '4px 8px', borderRadius: 6, textDecoration: 'none', fontSize: 12, fontWeight: 600 }}>View →</a>
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400">Loading Map...</div>
          )}
        </div>
      </div>
    </div>
  );
}
