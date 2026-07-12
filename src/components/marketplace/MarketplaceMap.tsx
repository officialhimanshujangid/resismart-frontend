'use client';

import React, { useEffect, useRef, useState } from 'react';

interface Pin {
  _id: string; title: string; pricePaise: number; priceType: string;
  location?: { coordinates: number[] }; boost?: { topPlacement?: boolean };
}

let leafletPromise: Promise<any> | null = null;
function loadLeaflet(): Promise<any> {
  if ((window as any).L) return Promise.resolve((window as any).L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = () => resolve((window as any).L);
    s.onerror = reject;
    document.body.appendChild(s);
  });
  return leafletPromise;
}

const inr = (p: number) => `₹${(p / 100).toLocaleString('en-IN')}`;

/** OpenStreetMap (Leaflet) map with a pin per listing and the viewer's location. */
export default function MarketplaceMap({ viewer, pins, onSelect }: {
  viewer: [number, number]; pins: Pin[]; onSelect?: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current).setView([viewer[1], viewer[0]], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap', maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
    }).catch(() => setFailed(true));
    return () => { cancelled = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapRef.current || !layerRef.current) return;
    layerRef.current.clearLayers();

    // Viewer marker
    L.circleMarker([viewer[1], viewer[0]], { radius: 7, color: '#0f766e', fillColor: '#14b8a6', fillOpacity: 0.9 })
      .addTo(layerRef.current).bindPopup('You are here');

    const withLoc = pins.filter((p) => p.location?.coordinates?.length === 2);
    withLoc.forEach((p) => {
      const [lng, lat] = p.location!.coordinates;
      const boosted = p.boost?.topPlacement;
      L.marker([lat, lng], boosted ? {
        icon: L.divIcon({ className: '', html: `<div style="background:#f59e0b;width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`, iconSize: [16, 16] }),
      } : {
        icon: L.divIcon({ className: '', html: `<div style="background:#0f766e;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`, iconSize: [14, 14] }),
      })
        .addTo(layerRef.current)
        .bindPopup(`<strong>${p.title}</strong><br/>${inr(p.pricePaise)}${p.priceType === 'PER_MONTH' ? '/mo' : ''}`)
        .on('click', () => onSelect?.(p._id));
    });

    if (withLoc.length) {
      const pts = withLoc.map((p) => [p.location!.coordinates[1], p.location!.coordinates[0]]);
      pts.push([viewer[1], viewer[0]]);
      try { mapRef.current.fitBounds(pts, { padding: [40, 40], maxZoom: 15 }); } catch { /* single point */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, viewer]);

  if (failed) return <div className="h-full flex items-center justify-center text-sm text-slate-400">Map could not be loaded.</div>;
  return <div ref={containerRef} className="w-full h-full rounded-2xl overflow-hidden" style={{ minHeight: 420, zIndex: 0 }} />;
}
