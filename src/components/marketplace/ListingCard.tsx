'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Heart, ImageOff, Rocket, KeyRound, Home, Phone } from 'lucide-react';
import VerifiedBadge from './VerifiedBadge';
import { CompareButton } from './CompareButton';
import ContactRevealModal from './ContactRevealModal';

interface Photo { url: string; isCover?: boolean }

export interface ListingCardData {
  _id: string;
  slug: string;
  title: string;
  kind: 'SALE' | 'RENT';
  pricePaise: number;
  priceType: 'TOTAL' | 'PER_MONTH';
  bedrooms?: number;
  sizeLabel?: string;
  city?: string;
  distanceKm?: number;
  photos?: Photo[];
  verification?: { status?: string };
  boost?: { topPlacement?: boolean; active?: boolean };
}

interface Props {
  listing: ListingCardData;
  isFavorited?: boolean;
  onToggleFavorite?: (id: string) => void;
  highlighted?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

const inr = (p: number) => `₹${(p / 100).toLocaleString('en-IN')}`;

/** Unified listing card — used by browse grid, similar carousel, and favorites. */
export default function ListingCard({
  listing: l, isFavorited = false, onToggleFavorite, highlighted, onMouseEnter, onMouseLeave,
}: Props) {
  const cover = l.photos?.find((p) => p.isCover) || l.photos?.[0];
  const [showContact, setShowContact] = useState(false);

  return (
    <div
      className={`group rounded-2xl bg-white overflow-hidden border transition-all duration-200 flex flex-col ${highlighted ? 'shadow-xl ring-2 scale-[1.01]' : 'hover:shadow-xl'}`}
      style={{
        borderColor: highlighted ? 'var(--mkt-primary)' : 'var(--mkt-line)',
        ...(highlighted ? { '--tw-ring-color': 'var(--mkt-primary)' } as React.CSSProperties : {}),
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <Link href={`/property-marketplace/${l.slug}`} className="block">
        {/* Image */}
        <div className="relative h-48 bg-slate-100 overflow-hidden">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover.url}
              alt={l.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <ImageOff className="w-8 h-8" />
            </div>
          )}

          {/* Boost ribbon */}
          {l.boost?.topPlacement && (
            <span className="absolute top-2 left-2 text-[11px] font-bold text-white px-2 py-0.5 rounded-full flex items-center gap-1 z-10"
              style={{ background: 'var(--mkt-accent)' }}>
              <Rocket className="w-3 h-3" /> Featured
            </span>
          )}

          {/* Verified badge */}
          <div className="absolute top-2 right-2 z-10">
            <VerifiedBadge status={l.verification?.status} />
          </div>

          {/* Favorite button overlay */}
          {onToggleFavorite && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(l._id); }}
              className="absolute bottom-2 right-2 z-10 w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-md transition-all"
              aria-label={isFavorited ? 'Remove from favorites' : 'Save to favorites'}
            >
              <Heart
                className="w-4 h-4 transition-colors"
                fill={isFavorited ? 'var(--mkt-danger)' : 'none'}
                stroke={isFavorited ? 'var(--mkt-danger)' : 'currentColor'}
                style={{ color: isFavorited ? 'var(--mkt-danger)' : 'var(--mkt-muted)' }}
              />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-4">
          <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: 'var(--mkt-muted)' }}>
            {l.kind === 'RENT' ? <KeyRound className="w-3.5 h-3.5" /> : <Home className="w-3.5 h-3.5" />}
            {l.kind === 'RENT' ? 'For Rent' : 'For Sale'}
            {l.distanceKm != null ? ` · ${l.distanceKm} km away` : l.city ? ` · ${l.city}` : ''}
          </div>
          <h3 className="font-bold line-clamp-1" style={{ color: 'var(--mkt-ink)' }}>{l.title}</h3>
          <div className="text-xs mt-0.5" style={{ color: 'var(--mkt-muted)' }}>
            {[l.bedrooms ? `${l.bedrooms} BHK` : '', l.sizeLabel].filter(Boolean).join(' · ')}
          </div>
          <div className="mt-2 flex items-end justify-between">
            <div className="text-xl font-black" style={{ color: 'var(--mkt-primary)' }}>
              {inr(l.pricePaise)}
              {l.priceType === 'PER_MONTH' && (
                <span className="text-xs font-medium" style={{ color: 'var(--mkt-muted)' }}>/mo</span>
              )}
            </div>
            <CompareButton listingId={l._id} size="sm" />
          </div>
        </div>
      </Link>

      {/* Contact CTA — sibling of the Link so it never triggers navigation */}
      <div className="px-4 pb-4 mt-auto">
        <button
          onClick={() => setShowContact(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border transition-colors hover:shadow-sm"
          style={{ borderColor: 'var(--mkt-primary)', color: 'var(--mkt-primary-strong)', background: 'var(--mkt-primary-soft)' }}
        >
          <Phone className="w-4 h-4" /> View Contact
        </button>
      </div>

      <ContactRevealModal
        open={showContact}
        onClose={() => setShowContact(false)}
        listingId={l._id}
        listingTitle={l.title}
      />
    </div>
  );
}
