'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import VerifiedBadge from '@/components/marketplace/VerifiedBadge';
import OtpVerifyField from '@/components/common/OtpVerifyField';
import Gallery from '@/components/marketplace/Gallery';
import ListingCard, { type ListingCardData } from '@/components/marketplace/ListingCard';
import ReportListingModal from '@/components/marketplace/ReportListingModal';
import { CompareButton } from '@/components/marketplace/CompareButton';
import SkeletonCard from '@/components/marketplace/SkeletonCard';
import {
  ArrowLeft, MapPin, BedDouble, Ruler, Sofa, Phone, CheckCircle2,
  Heart, Rocket, Home, ChevronRight,
} from 'lucide-react';
import { Chip } from '@mui/material';

const inr = (p: number) => `₹${(p / 100).toLocaleString('en-IN')}`;

const FURNISHING_LABEL: Record<string, string> = {
  UNFURNISHED: 'Unfurnished', SEMI_FURNISHED: 'Semi-furnished', FURNISHED: 'Furnished',
};

export default function PublicListingDetail() {
  const { slug } = useParams() as { slug: string };

  const [listing, setListing] = useState<any | null>(null);
  const [similar, setSimilar] = useState<ListingCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Lead form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [sending, setSending] = useState(false);
  const [revealed, setRevealed] = useState<{ name: string; phone: string | null } | null>(null);
  const [leadError, setLeadError] = useState('');

  // Favorite state
  const [isFavorited, setIsFavorited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    api.get(`/public/marketplace/listings/${slug}`)
      .then(async (res) => {
        const l = res.data.listing;
        setListing(l);
        // Fetch similar + favorite status in parallel
        const [simRes] = await Promise.all([
          l?._id ? api.get(`/public/marketplace/listings/${l._id}/similar`).catch(() => null) : null,
        ]);
        setSimilar(simRes?.data?.listings || []);
        // Check favorite status (auth optional)
        try {
          const favRes = await api.get('/marketplace/favorites/ids');
          setIsFavorited((favRes.data.ids || []).includes(l._id));
        } catch { /* not authenticated */ }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  const sendLead = async () => {
    setLeadError('');
    if (!name.trim()) { setLeadError('Enter your name'); return; }
    if (!otpToken) { setLeadError('Verify your phone number first'); return; }
    setSending(true);
    try {
      const res = await api.post('/public/marketplace/leads', { listingId: listing._id, name, phone, message, otpToken });
      setRevealed(res.data.contact);
    } catch (err: any) {
      setLeadError(err.response?.data?.error || 'Could not send inquiry. Please try again.');
    } finally { setSending(false); }
  };

  const toggleFavorite = async () => {
    if (favLoading) return;
    setFavLoading(true);
    try {
      const res = await api.post(`/marketplace/favorites/${listing._id}`);
      setIsFavorited(res.data.favorited);
    } catch { /* not authenticated */ } finally { setFavLoading(false); }
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-4 w-24 bg-slate-200 rounded-full animate-pulse" />
        <div className="h-80 bg-slate-200 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-6 w-3/4 bg-slate-200 rounded-full animate-pulse" />
            <div className="h-4 w-1/2 bg-slate-200 rounded-full animate-pulse" />
            <div className="h-32 bg-slate-200 rounded-xl animate-pulse" />
          </div>
          <div className="h-64 bg-slate-200 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (notFound || !listing) {
    return (
      <div className="text-center py-24" style={{ color: 'var(--mkt-muted)' }}>
        <Home className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="font-bold text-lg" style={{ color: 'var(--mkt-ink)' }}>Listing not found</p>
        <p className="text-sm mt-1">It may have been sold, rented, or removed.</p>
        <Link href="/property-marketplace" className="mt-4 inline-block px-4 py-2 rounded-xl text-white font-semibold text-sm" style={{ background: 'var(--mkt-primary)' }}>
          Browse properties
        </Link>
      </div>
    );
  }

  const specs = [
    listing.bedrooms != null && { icon: <BedDouble className="w-4 h-4" />, label: `${listing.bedrooms} BHK` },
    listing.sizeLabel && { icon: <Ruler className="w-4 h-4" />, label: listing.sizeLabel },
    listing.furnishing && { icon: <Sofa className="w-4 h-4" />, label: FURNISHING_LABEL[listing.furnishing] || listing.furnishing },
  ].filter(Boolean) as { icon: React.ReactNode; label: string }[];

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--mkt-muted)' }} aria-label="Breadcrumb">
        <Link href="/property-marketplace" className="hover:underline" style={{ color: 'var(--mkt-primary)' }}>Browse</Link>
        <ChevronRight className="w-3 h-3" />
        {listing.city && <><span>{listing.city}</span><ChevronRight className="w-3 h-3" /></>}
        <span className="line-clamp-1" style={{ color: 'var(--mkt-ink-soft)' }}>{listing.title}</span>
      </nav>

      {/* Gallery */}
      <Gallery photos={listing.photos || []} title={listing.title} />

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — details */}
        <div className="lg:col-span-2 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Chip size="small" label={listing.kind === 'RENT' ? 'For Rent' : 'For Sale'}
                  sx={{ bgcolor: 'var(--mkt-primary-soft)', color: 'var(--mkt-primary-strong)', fontWeight: 700 }} />
                <VerifiedBadge status={listing.verification?.status} size="md" />
                {listing.boost?.topPlacement && (
                  <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ background: 'var(--mkt-accent)' }}>
                    <Rocket className="w-3 h-3" /> Featured
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-black" style={{ color: 'var(--mkt-ink)' }}>{listing.title}</h1>
              {(listing.city || listing.societyId?.name) && (
                <p className="text-sm flex items-center gap-1 mt-1" style={{ color: 'var(--mkt-muted)' }}>
                  <MapPin className="w-4 h-4 flex-shrink-0" />
                  {[listing.societyId?.name, listing.city].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>

            {/* Price + actions */}
            <div className="text-right flex-shrink-0">
              <div className="text-2xl font-black" style={{ color: 'var(--mkt-primary)' }}>
                {inr(listing.pricePaise)}
                {listing.priceType === 'PER_MONTH' && (
                  <span className="text-sm font-medium" style={{ color: 'var(--mkt-muted)' }}>/mo</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2 justify-end">
                {/* Favorite */}
                <button
                  onClick={toggleFavorite}
                  disabled={favLoading}
                  className="w-9 h-9 rounded-full border flex items-center justify-center transition-all hover:scale-110 disabled:opacity-50"
                  style={{ borderColor: isFavorited ? 'var(--mkt-danger)' : 'var(--mkt-line)', background: isFavorited ? '#fff1f2' : '#fff' }}
                  aria-label={isFavorited ? 'Remove from favorites' : 'Save to favorites'}
                >
                  <Heart
                    className="w-4 h-4"
                    fill={isFavorited ? 'var(--mkt-danger)' : 'none'}
                    stroke={isFavorited ? 'var(--mkt-danger)' : 'var(--mkt-muted)'}
                  />
                </button>
                {/* Compare */}
                <CompareButton listingId={listing._id} size="md" />
              </div>
            </div>
          </div>

          {/* Specs */}
          {specs.length > 0 && (
            <div className="flex flex-wrap gap-4 py-4 border-y" style={{ borderColor: 'var(--mkt-line)' }}>
              {specs.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--mkt-ink-soft)' }}>
                  {s.icon} <span className="capitalize">{s.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Description */}
          {listing.description && (
            <div>
              <h2 className="text-base font-bold mb-2" style={{ color: 'var(--mkt-ink)' }}>About this property</h2>
              <p className="text-sm whitespace-pre-line leading-relaxed" style={{ color: 'var(--mkt-ink-soft)' }}>
                {listing.description}
              </p>
            </div>
          )}

          {/* Amenities */}
          {listing.amenities?.length > 0 && (
            <div>
              <h2 className="text-base font-bold mb-2" style={{ color: 'var(--mkt-ink)' }}>Amenities</h2>
              <div className="flex flex-wrap gap-2">
                {listing.amenities.map((a: string, i: number) => (
                  <Chip key={i} size="small" label={a} variant="outlined" />
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="flex gap-4 text-xs" style={{ color: 'var(--mkt-muted)' }}>
            <span>{listing.viewsCount || 0} views</span>
            <span>{listing.leadsCount || 0} inquiries</span>
            <span>{listing.favoritesCount || 0} saved</span>
            {listing.publishedAt && (
              <span>Listed {new Date(listing.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            )}
          </div>

          {/* Report listing */}
          <div className="pt-2">
            <ReportListingModal listingId={listing._id} listingTitle={listing.title} />
          </div>
        </div>

        {/* Right column — sticky contact card */}
        <div className="rounded-2xl border p-5 h-fit lg:sticky lg:top-24 bg-white shadow-sm" style={{ borderColor: 'var(--mkt-line)' }}>
          {revealed ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2" style={{ color: 'var(--mkt-verified)' }} />
              <p className="font-bold" style={{ color: 'var(--mkt-ink)' }}>Inquiry sent!</p>
              <p className="text-sm mt-1" style={{ color: 'var(--mkt-ink-soft)' }}>
                Contact <strong>{revealed.name}</strong>
              </p>
              {revealed.phone && (
                <a href={`tel:${revealed.phone}`}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-white font-semibold text-sm"
                  style={{ background: 'var(--mkt-primary)' }}>
                  <Phone className="w-4 h-4" /> {revealed.phone}
                </a>
              )}
            </div>
          ) : (
            <>
              <h3 className="font-black mb-1 text-lg" style={{ color: 'var(--mkt-ink)' }}>Interested?</h3>
              <p className="text-xs mb-4" style={{ color: 'var(--mkt-muted)' }}>
                Verify your phone to see the owner&apos;s contact.
              </p>
              <div className="space-y-3">
                <input
                  value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Your name" id="lead-name"
                  className="w-full text-sm border rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-teal-500"
                  style={{ borderColor: 'var(--mkt-line)' }}
                  aria-label="Your name"
                />
                <input
                  value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="Your phone" id="lead-phone" type="tel"
                  className="w-full text-sm border rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-teal-500"
                  style={{ borderColor: 'var(--mkt-line)' }}
                  aria-label="Your phone number"
                />
                {phone.replace(/\D/g, '').length >= 6 && (
                  <OtpVerifyField
                    channel="PHONE"
                    target={phone}
                    purpose="GENERIC"
                    onVerified={(t) => setOtpToken(t)}
                    onReset={() => setOtpToken('')}
                  />
                )}
                <textarea
                  value={message} onChange={(e) => setMessage(e.target.value)}
                  placeholder="Message (optional)" rows={2} id="lead-message"
                  className="w-full text-sm border rounded-xl px-3 py-2.5 outline-none resize-none"
                  style={{ borderColor: 'var(--mkt-line)' }}
                  aria-label="Optional message"
                />
                {leadError && <p className="text-xs text-rose-600" role="alert">{leadError}</p>}
                <button
                  onClick={sendLead}
                  disabled={sending || !otpToken}
                  className="w-full py-3 rounded-xl text-white font-bold text-sm transition-all disabled:opacity-50 hover:shadow-lg hover:scale-[1.01]"
                  style={{ background: 'var(--mkt-primary)' }}
                >
                  {sending ? 'Sending…' : 'Send inquiry & reveal contact'}
                </button>
                <p className="text-xs text-center" style={{ color: 'var(--mkt-muted)' }}>
                  Phone verified via OTP — no spam.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Similar properties */}
      {similar.length > 0 && (
        <div className="pt-4 border-t" style={{ borderColor: 'var(--mkt-line)' }}>
          <h2 className="text-xl font-black mb-4" style={{ color: 'var(--mkt-ink)' }}>Similar properties</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {similar.map((l) => <ListingCard key={l._id} listing={l} />)}
          </div>
        </div>
      )}
    </div>
  );
}
