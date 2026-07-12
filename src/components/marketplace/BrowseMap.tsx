'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';

interface Pin {
  _id: string;
  slug: string;
  title?: string;
  pricePaise?: number;
  kind?: string;
  location?: { type: string; coordinates: number[] };
  boost?: { topPlacement?: boolean };
}

interface Props {
  listings: Pin[];
  highlightedId?: string | null;
  onHover?: (id: string | null) => void;
  centerCoords?: [number, number];
  onSearchArea?: (center: { lng: number; lat: number }) => void;
}

const inr = (p: number) => `₹${(p / 100).toLocaleString('en-IN')}`;

const mapContainerStyle = { width: '100%', height: '100%', minHeight: '400px' };

export default function BrowseMap({ listings, highlightedId, onHover, centerCoords, onSearchArea }: Props) {
  const [mapRef, setMapRef] = useState<google.maps.Map | null>(null);
  const [openPopupId, setOpenPopupId] = useState<string | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
  });

  const center = centerCoords ? { lat: centerCoords[1], lng: centerCoords[0] } : { lat: 20.5937, lng: 78.9629 };

  const handleSearchArea = () => {
    if (!mapRef || !onSearchArea) return;
    const c = mapRef.getCenter();
    if (c) {
      onSearchArea({ lng: c.lng(), lat: c.lat() });
    }
  };

  useEffect(() => {
    if (highlightedId) setOpenPopupId(highlightedId);
  }, [highlightedId]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.5)', pointerEvents: 'none' }}>
           <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #fca5a5', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
             <p style={{ color: '#dc2626', fontWeight: 'bold', margin: 0 }}>Missing Google Maps API Key</p>
           </div>
        </div>
      )}
      {isLoaded ? (
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={centerCoords ? 13 : 5}
          onLoad={(map) => setMapRef(map)}
          options={{ disableDefaultUI: false }}
        >
          {listings.map((listing) => {
            const coords = listing.location?.coordinates;
            if (!coords || coords.length < 2) return null;
            const [lng, lat] = coords;

            const isBoosted = listing.boost?.topPlacement;
            const isHighlighted = listing._id === highlightedId || listing._id === openPopupId;
            const iconColor = isBoosted ? 'yellow' : 'green';

            return (
              <Marker
                key={listing._id}
                position={{ lat, lng }}
                icon={{ url: `http://maps.google.com/mapfiles/ms/icons/${iconColor}-dot.png` }}
                onMouseOver={() => onHover?.(listing._id)}
                onMouseOut={() => onHover?.(null)}
                onClick={() => setOpenPopupId(listing._id)}
              >
                {isHighlighted && (
                  <InfoWindow onCloseClick={() => { setOpenPopupId(null); onHover?.(null); }}>
                    <div style={{ minWidth: 140, fontFamily: 'sans-serif' }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{listing.title || 'Property'}</div>
                      <div style={{ color: '#0f766e', fontWeight: 800 }}>{listing.pricePaise ? inr(listing.pricePaise) : ''}</div>
                      <a href={`/property-marketplace/${listing.slug}`} style={{ display: 'block', marginTop: 8, textAlign: 'center', background: '#0f766e', color: 'white', padding: '4px 8px', borderRadius: 6, textDecoration: 'none', fontSize: 12, fontWeight: 600 }}>View →</a>
                    </div>
                  </InfoWindow>
                )}
              </Marker>
            );
          })}
        </GoogleMap>
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading Map...</div>
      )}

      {/* Custom Search Area Button Overlay */}
      {onSearchArea && (
        <button
          onClick={handleSearchArea}
          style={{
            position: 'absolute', top: 12, right: 60, zIndex: 1, // avoiding default map controls
            background: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            color: '#0f766e'
          }}
          title="Search listings in the current map area"
        >
          🔍 Search this area
        </button>
      )}
    </div>
  );
}
