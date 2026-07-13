'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, X } from 'lucide-react';
import { useJsApiLoader } from '@react-google-maps/api';

interface CityOption { city: string; placeId?: string; count?: number }

interface Props {
  value: string;
  onChange: (city: string) => void;
  onSelect?: (city: string, lat?: number, lng?: number) => void;
  placeholder?: string;
}

const libraries: ('places')[] = ['places'];

/**
 * City search box with a live suggestions dropdown. Suggestions come from
 * `/public/marketplace/cities` — only cities that currently have active listings, so a
 * pick always yields results. Keyboard-navigable (↑/↓/Enter/Esc) and click-outside aware.
 */
export default function CityAutocomplete({ value, onChange, onSelect, placeholder = 'Search locality...' }: Props) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  const [options, setOptions] = useState<CityOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);

  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const geocoder = useRef<google.maps.Geocoder | null>(null);

  const boxRef = useRef<HTMLDivElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCities = useCallback((q: string) => {
    if (!q || !isLoaded || !window.google) {
      setOptions([]);
      return;
    }
    if (!autocompleteService.current) {
      autocompleteService.current = new window.google.maps.places.AutocompleteService();
    }
    setLoading(true);
    autocompleteService.current?.getPlacePredictions(
      { input: q, componentRestrictions: { country: 'in' } },
      (predictions, status) => {
        setLoading(false);
        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
          setOptions(predictions.map((p) => ({ city: p.description, placeId: p.place_id })));
        } else {
          setOptions([]);
        }
      }
    );
  }, [isLoaded]);

  // Debounced fetch on query change while the menu is open.
  useEffect(() => {
    if (!open) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => fetchCities(value), 300);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [value, open, fetchCities]);

  // Click-outside closes the menu.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (opt: CityOption) => {
    onChange(opt.city);
    setOpen(false);
    setActive(-1);
    
    if (opt.placeId && isLoaded) {
      if (!geocoder.current) geocoder.current = new window.google.maps.Geocoder();
      geocoder.current?.geocode({ placeId: opt.placeId }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const lat = results[0].geometry.location.lat();
          const lng = results[0].geometry.location.lng();
          onSelect?.(opt.city, lat, lng);
        } else {
          onSelect?.(opt.city);
        }
      });
    } else {
      onSelect?.(opt.city);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { setOpen(true); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, options.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') {
      if (active >= 0 && options[active]) pick(options[active]);
      else { setOpen(false); onSelect?.(value); }
    } else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative flex-1 min-w-[160px]">
      <div className="flex items-center gap-2 px-3">
        <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <input
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => { setOpen(true); if (!options.length) fetchCities(value); }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="py-2 w-full outline-none text-sm bg-transparent"
          aria-label="Search by city"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls="city-suggest-list"
        />
        {value && (
          <button
            onClick={() => { onChange(''); onSelect?.(''); fetchCities(''); }}
            className="text-slate-300 hover:text-slate-500"
            aria-label="Clear city"
            type="button"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div
          id="city-suggest-list"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 rounded-2xl border bg-white shadow-2xl overflow-hidden max-h-72 overflow-y-auto"
          style={{ borderColor: 'var(--mkt-line)' }}
        >
          {loading && options.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-400">Searching cities…</div>
          ) : options.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-400">
              {value ? `No cities matching “${value}”` : 'Start typing a city name'}
            </div>
          ) : (
            options.map((o, i) => (
              <button
                key={o.placeId || o.city}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o)}
                className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors"
                style={{ background: i === active ? 'var(--mkt-primary-soft)' : 'transparent' }}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--mkt-primary)' }} />
                  <span className="font-semibold text-sm truncate" style={{ color: 'var(--mkt-ink)' }}>{o.city}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
