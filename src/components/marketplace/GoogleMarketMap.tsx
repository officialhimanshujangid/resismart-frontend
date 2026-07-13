'use client';

import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, OverlayView, Marker, Circle } from '@react-google-maps/api';
import { Rocket, X, MapPin, Crosshair, Search } from 'lucide-react';
import ListingCard, { type ListingCardData } from './ListingCard';

interface ListingProps {
  _id: string;
  pricePaise: number;
  priceType: string;
  title: string;
  kind: string;
  bedrooms?: number;
  sizeLabel?: string;
  photos?: { url: string; isCover?: boolean }[];
  boost?: { active?: boolean; topPlacement?: boolean };
  location?: { coordinates: number[] };
  verification?: { status?: string };
}

interface MapProps {
  listings: ListingProps[];
  highlightedId?: string | null;
  onHover?: (id: string | null) => void;
  onSelect?: (id: string) => void;
  centerCoords?: [number, number];
  /** Preferred unified callback: fires on map click, pin drag, or "search this area".
   *  `label` is the reverse-geocoded locality name (undefined if it couldn't be resolved). */
  onPickLocation?: (coords: [number, number], label?: string) => void;
  /** Legacy callbacks — used by the in-app dashboard browse which has no search box. */
  onSearchArea?: (center: { lat: number; lng: number }) => void;
  onMapClick?: (coords: [number, number]) => void;
  viewer?: [number, number];
  distanceKm?: number;
  onDistanceChange?: (km: number) => void;
  publicMode?: boolean;
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '16px',
};

const defaultCenter = { lat: 26.9124, lng: 75.7873 }; // Jaipur default

const libraries: ('places')[] = ['places'];

const RADIUS_CHIPS = [5, 25, 50, 100, 300];
const RADIUS_MIN = 1;
const RADIUS_MAX = 300;

/** Great-circle distance in metres. */
function metersBetween(a: google.maps.LatLngLiteral, b: google.maps.LatLngLiteral) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Fractional Google-Maps zoom level at which a circle of `radiusKm` (plus padding)
 * fits inside a viewport `viewportPx` tall. Derived from the Web-Mercator relation
 * metres-per-pixel = 156543.03 · cos(lat) / 2^zoom.
 */
function zoomForRadius(radiusKm: number, lat: number, viewportPx: number) {
  const diameterMeters = radiusKm * 2000 * 1.25; // 25% breathing room around the circle
  const equatorMeters = 40075016.686;
  const mppAtZoom0 = (equatorMeters * Math.cos((lat * Math.PI) / 180)) / 256;
  const targetMpp = diameterMeters / Math.max(viewportPx, 160);
  const zoom = Math.log2(mppAtZoom0 / targetMpp);
  return Math.max(3, Math.min(18, zoom));
}

export default function GoogleMarketMap({
  listings, highlightedId, onHover, onSelect, centerCoords, onPickLocation, onSearchArea,
  onMapClick, viewer, distanceKm, onDistanceChange, publicMode = true,
}: MapProps) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedListing, setSelectedListing] = useState<string | null>(null);
  const [showSearchArea, setShowSearchArea] = useState(false);
  const geocoder = useRef<google.maps.Geocoder | null>(null);
  const interacted = useRef(false);

  // Pin (search anchor) as primitive lng/lat so effects have stable deps.
  const pinLng = centerCoords?.[0] ?? viewer?.[0];
  const pinLat = centerCoords?.[1] ?? viewer?.[1];
  const hasPin = pinLat !== undefined && pinLng !== undefined;

  const initialCenter = useMemo<google.maps.LatLngLiteral>(() => {
    if (hasPin) return { lat: pinLat!, lng: pinLng! };
    if (listings[0]?.location?.coordinates) {
      return { lat: listings[0].location.coordinates[1], lng: listings[0].location.coordinates[0] };
    }
    return defaultCenter;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Controlled center + zoom, kept in sync with user gestures so they never snap back.
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>(initialCenter);
  const [zoom, setZoom] = useState<number>(13);

  const viewportPx = () => map?.getDiv()?.clientHeight || 480;

  // Reverse-geocode a point to a human locality label.
  const reverseGeocode = useCallback((lat: number, lng: number, cb: (label?: string) => void) => {
    if (!window.google) return cb(undefined);
    const gc = geocoder.current ?? (geocoder.current = new window.google.maps.Geocoder());
    gc.geocode({ location: { lat, lng } }, (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
      if (status === 'OK' && results && results[0]) {
        const comp = results[0].address_components;
        const pick = (t: string) => comp.find((c: google.maps.GeocoderAddressComponent) => c.types.includes(t))?.long_name;
        cb(
          pick('locality') || pick('sublocality') || pick('sublocality_level_1') ||
          pick('administrative_area_level_2') || pick('administrative_area_level_1') ||
          results[0].formatted_address
        );
      } else cb(undefined);
    });
  }, []);

  // Single entry point for "the user chose this location".
  const pickLocation = useCallback((lng: number, lat: number) => {
    setShowSearchArea(false);
    if (onPickLocation) {
      reverseGeocode(lat, lng, (label) => onPickLocation([lng, lat], label));
    } else {
      onMapClick?.([lng, lat]);
      onSearchArea?.({ lat, lng });
    }
  }, [onPickLocation, onMapClick, onSearchArea, reverseGeocode]);

  const onLoad = useCallback((m: google.maps.Map) => setMap(m), []);
  const onUnmount = useCallback(() => setMap(null), []);

  // Recenter + refit zoom whenever the pin moves or the radius changes.
  useEffect(() => {
    if (!map || !hasPin) return;
    setMapCenter({ lat: pinLat!, lng: pinLng! });
    if (distanceKm !== undefined) {
      setZoom(zoomForRadius(distanceKm, pinLat!, viewportPx()));
    }
    setShowSearchArea(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, pinLat, pinLng, distanceKm]);

  // Keep controlled state in sync with user gestures.
  const handleZoomChanged = () => {
    const z = map?.getZoom();
    if (z != null) setZoom(z);
  };

  const handleIdle = () => {
    if (!map) return;
    const c = map.getCenter();
    if (!c) return;
    const next = { lat: c.lat(), lng: c.lng() };
    setMapCenter(next);
    // Offer "Search this area" once the user has panned meaningfully off the pin.
    if (interacted.current && hasPin) {
      const drift = metersBetween(next, { lat: pinLat!, lng: pinLng! });
      const threshold = (distanceKm ?? 10) * 1000 * 0.3;
      setShowSearchArea(drift > threshold);
    }
  };

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    setSelectedListing(null);
    if (e.latLng) pickLocation(e.latLng.lng(), e.latLng.lat());
  };

  const searchThisArea = () => {
    if (!map) return;
    const c = map.getCenter();
    if (c) pickLocation(c.lng(), c.lat());
  };

  const center = mapCenter;

  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-slate-100 animate-pulse rounded-2xl flex items-center justify-center text-slate-400">
        Loading Map…
      </div>
    );
  }

  return (
    <div className="relative w-full h-full group">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={zoom}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={handleMapClick}
        onDragStart={() => { interacted.current = true; }}
        onZoomChanged={handleZoomChanged}
        onIdle={handleIdle}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER },
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: 'greedy',
        }}
      >
        {/* Listing price-pill markers */}
        {listings.map((l) => {
          if (!l.location?.coordinates) return null;
          const position = { lat: l.location.coordinates[1], lng: l.location.coordinates[0] };
          const isHovered = highlightedId === l._id;
          const isBoosted = l.boost?.active || l.boost?.topPlacement;
          const price = l.pricePaise / 100;
          let priceStr: string;
          if (price >= 10000000) priceStr = `₹${(price / 10000000).toFixed(2).replace(/\.00$/, '')}Cr`;
          else if (price >= 100000) priceStr = `₹${(price / 100000).toFixed(2).replace(/\.00$/, '')}L`;
          else if (price >= 1000) priceStr = `₹${(price / 1000).toFixed(1).replace(/\.0$/, '')}K`;
          else priceStr = `₹${price}`;
          const priceLabel = `${priceStr}${l.priceType === 'PER_MONTH' ? '/mo' : ''}`;

          return (
            <OverlayView
              key={l._id}
              position={position}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              getPixelPositionOffset={(width, height) => ({ x: -(width / 2), y: -height })}
            >
              <div
                onClick={(e) => { e.stopPropagation(); setSelectedListing(l._id); onSelect?.(l._id); }}
                onMouseEnter={() => onHover?.(l._id)}
                onMouseLeave={() => onHover?.(null)}
                className={`cursor-pointer transition-transform duration-200 relative ${isHovered ? 'scale-110 z-30' : 'z-10'}`}
                style={{ paddingBottom: '8px' }}
              >
                <div className={`relative px-3 py-1.5 rounded-full font-bold text-[13px] shadow-xl flex items-center gap-1.5 whitespace-nowrap
                  ${isBoosted
                    ? 'bg-[#22c55e] text-black border-2 border-white'
                    : (isHovered ? 'bg-teal-700 text-white' : 'bg-white text-teal-800 border border-slate-300')
                  }`}
                >
                  {isBoosted && <Rocket className="w-3.5 h-3.5 text-black flex-shrink-0" />}
                  <span className="leading-none">{priceLabel}</span>
                  <div className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45
                    ${isBoosted ? 'bg-[#22c55e]' : (isHovered ? 'bg-teal-700' : 'bg-white border-r border-b border-slate-300')}`}
                  />
                </div>
              </div>
            </OverlayView>
          );
        })}

        {/* Listing preview popover */}
        {selectedListing && (() => {
          const listing = listings.find((l) => l._id === selectedListing);
          if (!listing || !listing.location?.coordinates) return null;
          return (
            <OverlayView
              position={{ lat: listing.location.coordinates[1], lng: listing.location.coordinates[0] }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              getPixelPositionOffset={(width, height) => ({ x: -(width / 2), y: -(height + 40) })}
            >
              <div className="relative w-[300px] z-[100] animate-in fade-in zoom-in-95 duration-200">
                <div className="absolute -top-3 -right-3 z-10">
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedListing(null); }}
                    className="bg-white rounded-full p-1 shadow-md hover:bg-slate-100 border border-slate-200 text-slate-500"
                    aria-label="Close preview"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <ListingCard listing={listing as unknown as ListingCardData} />
              </div>
            </OverlayView>
          );
        })()}

        {/* Search-radius circle */}
        {hasPin && distanceKm !== undefined && (
          <Circle
            center={{ lat: pinLat!, lng: pinLng! }}
            radius={distanceKm * 1000}
            options={{
              fillColor: '#0f766e',
              fillOpacity: 0.08,
              strokeColor: '#0f766e',
              strokeOpacity: 0.5,
              strokeWeight: 2,
              clickable: false,
            }}
          />
        )}

        {/* Draggable search-anchor pin */}
        {hasPin && (
          <Marker
            position={{ lat: pinLat!, lng: pinLng! }}
            draggable
            onDragEnd={(e) => { if (e.latLng) pickLocation(e.latLng.lng(), e.latLng.lat()); }}
            title="Drag to move your search location"
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#0f766e',
              fillOpacity: 1,
              strokeWeight: 3,
              strokeColor: '#ffffff',
            }}
            zIndex={999}
          />
        )}
      </GoogleMap>

      {/* "Search this area" pill */}
      {showSearchArea && (
        <button
          onClick={searchThisArea}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2.5 rounded-full bg-white shadow-lg border border-slate-200 text-sm font-bold text-slate-700 hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all animate-in fade-in slide-in-from-top-2"
        >
          <Search className="w-4 h-4 text-teal-600" /> Search this area
        </button>
      )}

      {/* Recenter to pin */}
      {hasPin && (
        <button
          onClick={() => {
            interacted.current = false;
            setMapCenter({ lat: pinLat!, lng: pinLng! });
            if (distanceKm !== undefined) setZoom(zoomForRadius(distanceKm, pinLat!, viewportPx()));
            setShowSearchArea(false);
          }}
          className="absolute top-4 right-4 z-20 w-11 h-11 rounded-full bg-white shadow-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:text-teal-600 hover:shadow-xl transition-all"
          aria-label="Recenter map on search location"
          title="Recenter"
        >
          <Crosshair className="w-5 h-5" />
        </button>
      )}

      {/* Radius control */}
      {distanceKm !== undefined && onDistanceChange && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md px-5 py-3.5 rounded-2xl shadow-xl border border-slate-200/70 z-20 w-[92%] max-w-md flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-sm font-bold text-slate-700">
            <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-teal-600" /> Search radius</span>
            <span className="text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-lg tabular-nums">{distanceKm} km</span>
          </div>
          <input
            type="range" min={RADIUS_MIN} max={RADIUS_MAX} step={1}
            value={distanceKm}
            onChange={(e) => onDistanceChange(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
            aria-label="Search radius in kilometres"
          />
          <div className="flex items-center justify-between gap-1.5">
            {RADIUS_CHIPS.map((km) => (
              <button
                key={km}
                onClick={() => onDistanceChange(km)}
                className={`flex-1 text-xs font-bold py-1 rounded-lg transition-colors ${
                  distanceKm === km ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {km}km
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
