'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Loader2, Navigation, AlertCircle, LocateFixed } from 'lucide-react';

const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const DEFAULT_CENTER = { lat: 28.6273, lng: 77.3649 };

declare global {
  interface Window { google?: any; __gmapsLoading?: Promise<void>; __gmapsCallback?: () => void; }
}

export function loadGoogleMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.maps?.places) return Promise.resolve();
  if (window.__gmapsLoading) return window.__gmapsLoading;
  window.__gmapsLoading = new Promise<void>((resolve, reject) => {
    window.__gmapsCallback = () => {
      resolve();
    };
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=places&callback=__gmapsCallback`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
  return window.__gmapsLoading;
}

interface Props {
  latitude?: string | number;
  longitude?: string | number;
  onChange: (v: { latitude: string; longitude: string; address?: string; city?: string; state?: string; pincode?: string }) => void;
  height?: number;
}

const parseAddressComponents = (components: any[]) => {
  let city = '', state = '', pincode = '';
  if (!components) return { city, state, pincode };
  for (const comp of components) {
    if (comp.types.includes('locality')) city = comp.long_name;
    else if (!city && comp.types.includes('administrative_area_level_2')) city = comp.long_name;
    if (comp.types.includes('administrative_area_level_1')) state = comp.long_name;
    if (comp.types.includes('postal_code')) pincode = comp.long_name;
  }
  return { city, state, pincode };
};

export default function LocationPicker({ latitude, longitude, onChange, height = 200 }: Props) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState('');

  const hasInitial = useRef(Boolean(Number(latitude) && Number(longitude)));
  const initial = useRef({
    lat: Number(latitude) || DEFAULT_CENTER.lat,
    lng: Number(longitude) || DEFAULT_CENTER.lng,
  });

  const reverseGeocode = (lat: number, lng: number, withAddress: boolean) => {
    if (withAddress && geocoderRef.current) {
      geocoderRef.current.geocode({ location: { lat, lng } }, (results: any, status: string) => {
        if (status === 'OK' && results?.[0]) {
          const { city, state, pincode } = parseAddressComponents(results[0].address_components);
          onChange({ latitude: lat.toFixed(6), longitude: lng.toFixed(6), address: results[0].formatted_address, city, state, pincode });
        } else {
          onChange({ latitude: lat.toFixed(6), longitude: lng.toFixed(6) });
        }
      });
    } else {
      onChange({ latitude: lat.toFixed(6), longitude: lng.toFixed(6) });
    }
  };

  const moveTo = (lat: number, lng: number, zoom = 16) => {
    if (mapRef.current && markerRef.current) {
      const pos = { lat, lng };
      mapRef.current.setCenter(pos);
      mapRef.current.setZoom(zoom);
      markerRef.current.setPosition(pos);
    }
  };

  const useCurrentLocation = (silent = false) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      if (!silent) setGeoError('Geolocation is not supported by this browser.');
      return;
    }
    setGeoError('');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        moveTo(lat, lng);
        reverseGeocode(lat, lng, true);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        if (!silent) {
          setGeoError(err.code === err.PERMISSION_DENIED ? 'Location permission denied. Allow it in your browser, or pick on the map.' : 'Could not fetch your current location.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !mapDivRef.current) return;
        const map = new window.google.maps.Map(mapDivRef.current, { center: initial.current, zoom: 14, disableDefaultUI: true, zoomControl: true });
        const marker = new window.google.maps.Marker({ position: initial.current, map, draggable: true });
        mapRef.current = map;
        markerRef.current = marker;
        geocoderRef.current = new window.google.maps.Geocoder();
        setReady(true);

        // The map often initialises while the dialog is still animating (zero size),
        // leaving grey tiles. Force a resize + recenter once the modal has settled.
        const fixSize = () => {
          try { window.google.maps.event.trigger(map, 'resize'); map.setCenter(initial.current); } catch { /* noop */ }
        };
        setTimeout(fixSize, 350);
        setTimeout(fixSize, 800);

        marker.addListener('dragend', () => { const p = marker.getPosition(); reverseGeocode(p.lat(), p.lng(), true); });
        map.addListener('click', (e: any) => { marker.setPosition(e.latLng); reverseGeocode(e.latLng.lat(), e.latLng.lng(), true); });

        if (searchRef.current) {
          const ac = new window.google.maps.places.Autocomplete(searchRef.current, { fields: ['geometry', 'formatted_address', 'name', 'address_components'] });
          ac.bindTo('bounds', map);
          ac.addListener('place_changed', () => {
            const place = ac.getPlace();
            if (!place.geometry?.location) return;
            const loc = place.geometry.location;
            moveTo(loc.lat(), loc.lng());
            const { city, state, pincode } = parseAddressComponents(place.address_components);
            onChange({ latitude: loc.lat().toFixed(6), longitude: loc.lng().toFixed(6), address: place.formatted_address, city, state, pincode });
          });
        }

        // If no coordinates were supplied yet, try to centre on the user's location.
        if (!hasInitial.current) useCurrentLocation(true);
      })
      .catch(() => setError(true));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready && mapRef.current && markerRef.current) {
      const pLat = Number(latitude);
      const pLng = Number(longitude);
      if (pLat && pLng) {
        const currentPos = markerRef.current.getPosition();
        if (!currentPos || Math.abs(currentPos.lat() - pLat) > 0.0001 || Math.abs(currentPos.lng() - pLng) > 0.0001) {
          moveTo(pLat, pLng, mapRef.current.getZoom());
        }
      }
    }
  }, [latitude, longitude, ready]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 z-10" />
          <input ref={searchRef} placeholder="Search a place to drop the pin..." disabled={error}
            onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
            className="w-full pl-9 pr-3 h-10 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#0a5bd7] focus:ring-2 focus:ring-[#0a5bd7]/15" />
        </div>
        <button type="button" onClick={() => useCurrentLocation(false)} disabled={error || locating}
          className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-[#0a5bd7] disabled:opacity-50 whitespace-nowrap">
          {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />} My location
        </button>
      </div>
      {geoError && <p className="text-[11px] text-amber-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {geoError}</p>}
      <div className="rounded-xl overflow-hidden border border-slate-200 relative bg-blue-50/40" style={{ height }}>
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-xs gap-1 p-4 text-center">
            <AlertCircle className="w-6 h-6 text-amber-500" /> Map unavailable — enter coordinates manually.
          </div>
        ) : !ready ? (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : null}
        <div ref={mapDivRef} className="w-full h-full" />
      </div>
    </div>
  );
}
