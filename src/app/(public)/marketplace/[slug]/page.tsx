'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import VerifiedBadge from '@/components/marketplace/VerifiedBadge';
import OtpVerifyField from '@/components/common/OtpVerifyField';
import { CircularProgress, Chip } from '@mui/material';
import { ArrowLeft, MapPin, BedDouble, Ruler, Sofa, Phone, CheckCircle2, ImageOff } from 'lucide-react';

const inr = (p: number) => `₹${(p / 100).toLocaleString('en-IN')}`;

export default function PublicListingDetail() {
  const { slug } = useParams();
  const [listing, setListing] = useState<any | null>(null);
  const [similar, setSimilar] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [sending, setSending] = useState(false);
  const [revealed, setRevealed] = useState<{ name: string; phone: string | null } | null>(null);
  const [leadError, setLeadError] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get(`/public/marketplace/listings/${slug}`)
      .then(async (res) => {
        setListing(res.data.listing);
        if (res.data.listing?._id) {
          const sim = await api.get(`/public/marketplace/listings/${res.data.listing._id}/similar`).catch(() => null);
          setSimilar(sim?.data?.listings || []);
        }
      })
      .catch(() => setListing(null))
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
      setLeadError(err.response?.data?.error || 'Could not send inquiry');
    } finally { setSending(false); }
  };

  if (loading) return <div className="flex justify-center py-24"><CircularProgress /></div>;
  if (!listing) return <div className="text-center py-24" style={{ color: 'var(--mkt-muted)' }}>Listing not found. <Link href="/marketplace" className="underline">Back to browse</Link></div>;

  const specs = [
    listing.bedrooms != null && { icon: <BedDouble className="w-4 h-4" />, label: `${listing.bedrooms} BHK` },
    listing.sizeLabel && { icon: <Ruler className="w-4 h-4" />, label: listing.sizeLabel },
    listing.furnishing && { icon: <Sofa className="w-4 h-4" />, label: String(listing.furnishing).replace('_', ' ').toLowerCase() },
  ].filter(Boolean) as { icon: React.ReactNode; label: string }[];

  return (
    <div className="space-y-6">
      <Link href="/marketplace" className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: 'var(--mkt-ink-soft)' }}><ArrowLeft className="w-4 h-4" /> Back to browse</Link>

      {/* Gallery */}
      {listing.photos?.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto rounded-2xl bg-slate-900 p-1">
          {listing.photos.map((p: any, i: number) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={p.url} alt="" className="h-72 rounded-xl object-cover flex-shrink-0" />
          ))}
        </div>
      ) : <div className="h-56 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-300"><ImageOff className="w-10 h-10" /></div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Chip size="small" label={listing.kind === 'RENT' ? 'For Rent' : 'For Sale'} sx={{ bgcolor: 'var(--mkt-primary-soft)', color: 'var(--mkt-primary-strong)', fontWeight: 700 }} />
                <VerifiedBadge status={listing.verification?.status} size="md" />
              </div>
              <h1 className="text-2xl font-black mt-2" style={{ color: 'var(--mkt-ink)' }}>{listing.title}</h1>
              {(listing.city || listing.societyId?.name) && <p className="text-sm flex items-center gap-1 mt-1" style={{ color: 'var(--mkt-muted)' }}><MapPin className="w-4 h-4" /> {[listing.societyId?.name, listing.city].filter(Boolean).join(', ')}</p>}
            </div>
            <div className="text-2xl font-black whitespace-nowrap" style={{ color: 'var(--mkt-primary)' }}>{inr(listing.pricePaise)}{listing.priceType === 'PER_MONTH' ? <span className="text-sm font-medium" style={{ color: 'var(--mkt-muted)' }}>/mo</span> : ''}</div>
          </div>

          {specs.length > 0 && (
            <div className="flex flex-wrap gap-4 py-3 border-y" style={{ borderColor: 'var(--mkt-line)' }}>
              {specs.map((s, i) => <div key={i} className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--mkt-ink-soft)' }}>{s.icon} <span className="capitalize">{s.label}</span></div>)}
            </div>
          )}

          {listing.description && <p className="text-sm whitespace-pre-line" style={{ color: 'var(--mkt-ink-soft)' }}>{listing.description}</p>}
          {listing.amenities?.length > 0 && (
            <div className="flex flex-wrap gap-2">{listing.amenities.map((a: string, i: number) => <Chip key={i} size="small" label={a} variant="outlined" />)}</div>
          )}
        </div>

        {/* Contact / lead card */}
        <div className="rounded-2xl border p-5 h-fit lg:sticky lg:top-20 bg-white" style={{ borderColor: 'var(--mkt-line)' }}>
          {revealed ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2" style={{ color: 'var(--mkt-verified)' }} />
              <p className="font-bold" style={{ color: 'var(--mkt-ink)' }}>Inquiry sent!</p>
              <p className="text-sm mt-2" style={{ color: 'var(--mkt-ink-soft)' }}>Contact <strong>{revealed.name}</strong></p>
              {revealed.phone && <a href={`tel:${revealed.phone}`} className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full text-white font-semibold" style={{ background: 'var(--mkt-primary)' }}><Phone className="w-4 h-4" /> {revealed.phone}</a>}
            </div>
          ) : (
            <>
              <h3 className="font-black mb-1" style={{ color: 'var(--mkt-ink)' }}>Interested?</h3>
              <p className="text-xs mb-4" style={{ color: 'var(--mkt-muted)' }}>Verify your phone to see the owner's contact.</p>
              <div className="space-y-3">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full text-sm border rounded-xl px-3 py-2 outline-none" style={{ borderColor: 'var(--mkt-line)' }} />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Your phone" className="w-full text-sm border rounded-xl px-3 py-2 outline-none" style={{ borderColor: 'var(--mkt-line)' }} />
                {phone.replace(/\D/g, '').length >= 6 && (
                  <OtpVerifyField channel="PHONE" target={phone} purpose="GENERIC" onVerified={(t) => setOtpToken(t)} onReset={() => setOtpToken('')} />
                )}
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message (optional)" rows={2} className="w-full text-sm border rounded-xl px-3 py-2 outline-none resize-none" style={{ borderColor: 'var(--mkt-line)' }} />
                {leadError && <p className="text-xs text-rose-600">{leadError}</p>}
                <button onClick={sendLead} disabled={sending || !otpToken} className="w-full py-2.5 rounded-xl text-white font-bold disabled:opacity-50" style={{ background: 'var(--mkt-primary)' }}>
                  {sending ? 'Sending…' : 'Send inquiry'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Similar */}
      {similar.length > 0 && (
        <div className="pt-4">
          <h2 className="text-lg font-black mb-3" style={{ color: 'var(--mkt-ink)' }}>Similar properties</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {similar.map((l) => {
              const cover = l.photos?.find((p: any) => p.isCover) || l.photos?.[0];
              return (
                <Link key={l._id} href={`/marketplace/${l.slug}`} className="rounded-xl bg-white border overflow-hidden hover:shadow-lg transition-shadow" style={{ borderColor: 'var(--mkt-line)' }}>
                  <div className="h-28 bg-slate-100">{cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover.url} alt="" className="w-full h-full object-cover" />) : null}</div>
                  <div className="p-2.5">
                    <div className="font-bold text-sm line-clamp-1" style={{ color: 'var(--mkt-ink)' }}>{l.title}</div>
                    <div className="text-sm font-black" style={{ color: 'var(--mkt-primary)' }}>{inr(l.pricePaise)}{l.priceType === 'PER_MONTH' ? '/mo' : ''}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
