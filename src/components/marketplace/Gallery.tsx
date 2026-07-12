'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';

interface Photo {
  url: string;
  isCover?: boolean;
  blurhash?: string;
}

interface GalleryProps {
  photos: Photo[];
  title?: string;
}

/** Full-featured photo gallery with thumbnail strip + lightbox modal (keyboard accessible). */
export default function Gallery({ photos, title = 'Property' }: GalleryProps) {
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  // Sort: cover first
  const sorted = [...photos].sort((a, b) => (b.isCover ? 1 : 0) - (a.isCover ? 1 : 0));

  const prev = useCallback(() => setActive((i) => (i === 0 ? sorted.length - 1 : i - 1)), [sorted.length]);
  const next = useCallback(() => setActive((i) => (i === sorted.length - 1 ? 0 : i + 1)), [sorted.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'Escape') setLightbox(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightbox, prev, next]);

  // Trap body scroll while lightbox open
  useEffect(() => {
    document.body.style.overflow = lightbox ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [lightbox]);

  if (!sorted.length) {
    return (
      <div className="h-64 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-300">
        <div className="text-center">
          <ZoomIn className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No photos available</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Main image */}
      <div className="relative rounded-2xl overflow-hidden bg-slate-900 group cursor-zoom-in"
        onClick={() => setLightbox(true)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={sorted[active].url}
          alt={`${title} — photo ${active + 1}`}
          className="w-full h-72 md:h-96 object-cover transition-opacity duration-300"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <span className="absolute bottom-3 right-3 text-xs font-semibold px-2 py-1 rounded-lg bg-black/50 text-white">
          {active + 1} / {sorted.length}
        </span>
        {sorted.length > 1 && (
          <>
            <button onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow-md transition-all"
              aria-label="Previous photo">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow-md transition-all"
              aria-label="Next photo">
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {sorted.length > 1 && (
        <div className="flex gap-2 overflow-x-auto mt-2 pb-1">
          {sorted.map((p, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${i === active ? 'border-teal-500 opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`}
              aria-label={`View photo ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox modal */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Photo lightbox"
          onClick={() => setLightbox(false)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
            onClick={() => setLightbox(false)}
            aria-label="Close lightbox"
          >
            <X className="w-5 h-5" />
          </button>

          {sorted.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
                aria-label="Previous photo">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
                aria-label="Next photo">
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          <div onClick={(e) => e.stopPropagation()} className="max-w-5xl max-h-[90vh] px-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sorted[active].url}
              alt={`${title} — photo ${active + 1}`}
              className="max-w-full max-h-[85vh] object-contain rounded-xl"
            />
            <p className="text-center text-white/60 text-sm mt-2">{active + 1} / {sorted.length}</p>
          </div>
        </div>
      )}
    </>
  );
}
