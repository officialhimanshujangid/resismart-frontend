'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import VerifiedBadge from '@/components/marketplace/VerifiedBadge';
import { useCompare } from '@/components/marketplace/CompareButton';
import SkeletonCard from '@/components/marketplace/SkeletonCard';
import { ArrowLeft, X, ImageOff, ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';

const inr = (p: number) => `₹${(p / 100).toLocaleString('en-IN')}`;

interface Listing {
  _id: string; slug: string; title: string; kind: string;
  pricePaise: number; priceType: string; bedrooms?: number; sizeLabel?: string;
  furnishing?: string; city?: string; amenities?: string[];
  photos?: { url: string; isCover?: boolean }[];
  verification?: { status?: string };
}

const FURNISHING_LABEL: Record<string, string> = {
  UNFURNISHED: 'Unfurnished', SEMI_FURNISHED: 'Semi-furnished', FURNISHED: 'Furnished',
};

const ROW_DEFS = [
  { key: 'type', label: 'Type', render: (l: Listing) => l.kind === 'RENT' ? 'For Rent' : 'For Sale' },
  { key: 'price', label: 'Price', render: (l: Listing) => `${inr(l.pricePaise)}${l.priceType === 'PER_MONTH' ? '/mo' : ''}` },
  { key: 'bedrooms', label: 'Bedrooms', render: (l: Listing) => l.bedrooms != null ? `${l.bedrooms} BHK` : '—' },
  { key: 'size', label: 'Size', render: (l: Listing) => l.sizeLabel || '—' },
  { key: 'furnishing', label: 'Furnishing', render: (l: Listing) => l.furnishing ? FURNISHING_LABEL[l.furnishing] || l.furnishing : '—' },
  { key: 'city', label: 'Location', render: (l: Listing) => l.city || '—' },
  { key: 'verification', label: 'Verification', render: (_l: Listing, el?: React.ReactNode) => el },
  { key: 'amenities', label: 'Amenities', render: (l: Listing) => l.amenities?.join(', ') || '—' },
];

function CompareContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { ids: trayIds, toggle, clear } = useCompare();

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);

  // Use URL ids if present, otherwise fall back to tray
  const urlIds = searchParams.get('ids')?.split(',').filter(Boolean) || [];
  const activeIds = urlIds.length ? urlIds : trayIds;

  useEffect(() => {
    if (!activeIds.length) { setListings([]); return; }
    setLoading(true);
    api.get('/public/marketplace/compare', { params: { ids: activeIds.join(',') } })
      .then((res) => setListings(res.data.listings || []))
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, [activeIds.join(',')]);

  const removeFromCompare = (id: string) => {
    toggle(id);
    if (urlIds.length) {
      const remaining = urlIds.filter((x) => x !== id).join(',');
      router.replace(remaining ? `/property-marketplace/compare?ids=${remaining}` : '/property-marketplace/compare');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/property-marketplace" className="flex items-center gap-1.5 text-sm font-semibold hover:underline" style={{ color: 'var(--mkt-ink-soft)' }}>
            <ArrowLeft className="w-4 h-4" /> Browse
          </Link>
          <span style={{ color: 'var(--mkt-line)' }}>|</span>
          <h1 className="text-xl font-black" style={{ color: 'var(--mkt-ink)' }}>Compare Properties</h1>
        </div>
        {listings.length > 0 && (
          <button onClick={clear}
            className="text-xs px-3 py-1.5 rounded-lg border font-semibold transition-colors hover:bg-red-50 hover:border-red-300 hover:text-red-600"
            style={{ borderColor: 'var(--mkt-line)', color: 'var(--mkt-muted)' }}>
            Clear all
          </button>
        )}
      </div>

      {/* Empty state */}
      {!loading && listings.length === 0 && (
        <div className="text-center py-24" style={{ color: 'var(--mkt-muted)' }}>
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'var(--mkt-primary-soft)' }}>
            <ExternalLink className="w-8 h-8" style={{ color: 'var(--mkt-primary)' }} />
          </div>
          <p className="font-bold text-lg" style={{ color: 'var(--mkt-ink)' }}>No properties to compare</p>
          <p className="text-sm mt-1 mb-4">Add up to 4 properties from the browse page using the ⇄ Compare button.</p>
          <Link href="/property-marketplace"
            className="inline-block px-4 py-2 rounded-xl text-white font-semibold text-sm"
            style={{ background: 'var(--mkt-primary)' }}>
            Browse properties
          </Link>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${activeIds.length}, 1fr)` }}>
          {activeIds.map((id) => <SkeletonCard key={id} />)}
        </div>
      )}

      {/* Comparison table */}
      {!loading && listings.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--mkt-line)' }}>
          <table className="w-full min-w-max" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr>
                {/* Row label column */}
                <th className="w-32 min-w-[120px] p-4 text-left text-xs font-semibold sticky left-0 bg-white border-b"
                  style={{ borderColor: 'var(--mkt-line)', color: 'var(--mkt-muted)' }}>
                  Property
                </th>
                {listings.map((l) => (
                  <th key={l._id} className="p-4 border-b border-l text-left min-w-[200px]"
                    style={{ borderColor: 'var(--mkt-line)' }}>
                    <div className="relative">
                      {/* Remove button */}
                      <button
                        onClick={() => removeFromCompare(l._id)}
                        className="absolute top-0 right-0 w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-100 transition-colors"
                        aria-label={`Remove ${l.title} from compare`}
                        style={{ color: 'var(--mkt-muted)' }}>
                        <X className="w-3.5 h-3.5" />
                      </button>

                      {/* Cover photo */}
                      <div className="h-32 rounded-xl overflow-hidden bg-slate-100 mb-3">
                        {(() => {
                          const cover = l.photos?.find((p) => p.isCover) || l.photos?.[0];
                          return cover
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={cover.url} alt={l.title} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageOff className="w-6 h-6" /></div>;
                        })()}
                      </div>
                      <Link href={`/property-marketplace/${l.slug}`}
                        className="font-bold text-sm hover:underline line-clamp-2"
                        style={{ color: 'var(--mkt-ink)' }}>
                        {l.title}
                      </Link>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROW_DEFS.map((row, ri) => (
                <tr key={row.key} className={ri % 2 === 0 ? '' : ''} style={{ background: ri % 2 === 0 ? 'var(--mkt-surface-2)' : 'white' }}>
                  {/* Row label */}
                  <td className="p-4 text-xs font-semibold sticky left-0 border-b"
                    style={{ borderColor: 'var(--mkt-line)', color: 'var(--mkt-muted)', background: ri % 2 === 0 ? 'var(--mkt-surface-2)' : 'white' }}>
                    {row.label}
                  </td>
                  {listings.map((l) => (
                    <td key={l._id} className="p-4 text-sm border-b border-l"
                      style={{ borderColor: 'var(--mkt-line)', color: 'var(--mkt-ink)' }}>
                      {row.key === 'verification'
                        ? <VerifiedBadge status={l.verification?.status} />
                        : row.render(l)}
                    </td>
                  ))}
                </tr>
              ))}
              {/* CTA row */}
              <tr>
                <td className="p-4 sticky left-0 bg-white" />
                {listings.map((l) => (
                  <td key={l._id} className="p-4 border-l" style={{ borderColor: 'var(--mkt-line)' }}>
                    <Link href={`/property-marketplace/${l.slug}`}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold"
                      style={{ background: 'var(--mkt-primary)' }}>
                      View listing <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center" style={{ color: 'var(--mkt-muted)' }}>Loading comparison...</div>}>
      <CompareContent />
    </Suspense>
  );
}
