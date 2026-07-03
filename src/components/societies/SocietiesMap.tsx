'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { loadGoogleMaps } from '@/components/common/LocationPicker';
import { useRouter } from 'next/navigation';
import { Box } from '@mui/material';

interface Society {
  _id: string;
  name: string;
  status: string;
  address: string;
  location?: { coordinates: number[] };
}

interface Props {
  societies: Society[];
  height?: string | number;
}

const DEFAULT_CENTER = { lat: 28.6273, lng: 77.3649 };

export default function SocietiesMap({ societies, height = 600 }: Props) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !mapDivRef.current) return;
        try {
          const map = new window.google.maps.Map(mapDivRef.current, {
            center: DEFAULT_CENTER,
            zoom: 12,
            disableDefaultUI: false,
          });
          mapRef.current = map;
          setReady(true);
        } catch (err: any) {
          console.error('Error creating map:', err);
          setError(err.message || String(err));
        }
      })
      .catch((err) => {
        console.error('Error loading Google Maps script:', err);
        setError(err.message || String(err));
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current || !window.google) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new window.google.maps.LatLngBounds();
    let hasValidCoords = false;
    const infoWindow = new window.google.maps.InfoWindow();

    // A nice SVG building icon
    const buildingSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#0a5bd7" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16"/><path d="M14 22v-4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>`;
    const iconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(buildingSvg)}`;

    societies.forEach((s) => {
      if (s.location?.coordinates?.length === 2) {
        hasValidCoords = true;
        const pos = { lat: s.location.coordinates[1], lng: s.location.coordinates[0] };
        bounds.extend(pos);

        const marker = new window.google.maps.Marker({
          position: pos,
          map: mapRef.current,
          title: s.name,
          icon: {
            url: iconUrl,
            scaledSize: new window.google.maps.Size(36, 36),
            anchor: new window.google.maps.Point(18, 36),
          }
        });

        marker.addListener('click', () => {
          const contentString = `
            <div style="padding: 8px; font-family: sans-serif; color: #334155;">
              <h3 style="margin: 0 0 4px; font-size: 16px; font-weight: bold; color: #0f172a;">${s.name}</h3>
              <p style="margin: 0 0 8px; font-size: 12px;">${s.address}</p>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; background: #e2e8f0;">${s.status}</span>
                <a href="/owner/societies/${s._id}" style="color: #0a5bd7; text-decoration: none; font-size: 12px; font-weight: bold;">View Details &rarr;</a>
              </div>
            </div>
          `;
          infoWindow.setContent(contentString);
          infoWindow.open({
            anchor: marker,
            map: mapRef.current,
            shouldFocus: false,
          });
        });

        markersRef.current.push(marker);
      }
    });

    if (hasValidCoords) {
      if (societies.length === 1) {
        mapRef.current.setCenter({ lat: societies[0].location!.coordinates[1], lng: societies[0].location!.coordinates[0] });
        mapRef.current.setZoom(15);
      } else {
        mapRef.current.fitBounds(bounds);
      }
    }
  }, [societies, ready]);

  return (
    <Box sx={{ height, width: '100%', position: 'relative', borderRadius: 4, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-xs gap-1 p-4 text-center bg-slate-50">
          <AlertCircle className="w-6 h-6 text-amber-500" /> Map unavailable: {error}
        </div>
      ) : !ready ? (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400 bg-slate-50">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : null}
      <div ref={mapDivRef} className="w-full h-full" />
    </Box>
  );
}
