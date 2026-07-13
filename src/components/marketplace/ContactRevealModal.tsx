'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Phone, X, CheckCircle2, ShieldCheck, PhoneCall, Copy, Check } from 'lucide-react';
import api from '@/lib/api';

interface RevealedContact { name: string; phone: string | null }

interface Props {
  open: boolean;
  onClose: () => void;
  listingId: string;
  listingTitle?: string;
  /** Masked hint like ••••••••210, shown before reveal. */
  phoneMasked?: string | null;
  ownerName?: string;
  onSubmitted?: () => void;
}

const LS_NAME = 'rs_lead_name';
const LS_PHONE = 'rs_lead_phone';
const revealKey = (id: string) => `rs_revealed_${id}`;

/** Read a previously-revealed contact for this listing from sessionStorage. */
function readCachedReveal(id: string): RevealedContact | null {
  try {
    const raw = sessionStorage.getItem(revealKey(id));
    return raw ? (JSON.parse(raw) as RevealedContact) : null;
  } catch { return null; }
}

/**
 * "View phone number" form. No sign-in — the visitor leaves a name + phone and the owner's
 * full number is revealed. Name/phone are remembered across ads (localStorage) so repeat
 * visitors reveal in one tap, and each listing's reveal is cached for the session.
 */
export default function ContactRevealModal({
  open, onClose, listingId, listingTitle, phoneMasked, ownerName, onSubmitted,
}: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [hp, setHp] = useState(''); // honeypot
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState<RevealedContact | null>(null);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Prefill from prior submissions + surface any cached reveal for this listing.
  useEffect(() => {
    if (!open) return;
    try {
      setName((n) => n || localStorage.getItem(LS_NAME) || '');
      setPhone((p) => p || localStorage.getItem(LS_PHONE) || '');
    } catch { /* storage blocked */ }
    setRevealed(readCachedReveal(listingId));
    setError('');
  }, [open, listingId]);

  // Lock body scroll + close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  const submit = useCallback(async () => {
    setError('');
    if (!name.trim()) { setError('Please enter your name'); return; }
    if (phone.replace(/\D/g, '').length < 10) { setError('Please enter a valid mobile number'); return; }
    setSending(true);
    try {
      const res = await api.post('/public/marketplace/leads', {
        listingId, name: name.trim(), phone: phone.trim(), message: message.trim() || undefined, _hp: hp,
      });
      const contact: RevealedContact = res.data.contact || { name: ownerName || 'Owner', phone: null };
      setRevealed(contact);
      try {
        localStorage.setItem(LS_NAME, name.trim());
        localStorage.setItem(LS_PHONE, phone.trim());
        sessionStorage.setItem(revealKey(listingId), JSON.stringify(contact));
      } catch { /* storage blocked */ }
      onSubmitted?.();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not reveal the number. Please try again.');
    } finally { setSending(false); }
  }, [name, phone, message, hp, listingId, ownerName, onSubmitted]);

  const copyNumber = () => {
    if (!revealed?.phone) return;
    navigator.clipboard?.writeText(revealed.phone).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="mkt fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(2px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="View owner contact"
    >
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--mkt-primary-soft)', color: 'var(--mkt-primary-strong)' }}>
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-lg leading-tight" style={{ color: 'var(--mkt-ink)' }}>
                {revealed ? 'Owner contact' : 'View phone number'}
              </h3>
              {listingTitle && <p className="text-xs line-clamp-1" style={{ color: 'var(--mkt-muted)' }}>{listingTitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 -mt-1" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pb-5">
          {revealed ? (
            /* ── Revealed state ── */
            <div className="text-center py-2">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2" style={{ color: 'var(--mkt-verified)' }} />
              <p className="text-sm" style={{ color: 'var(--mkt-muted)' }}>Contact</p>
              <p className="font-black text-xl" style={{ color: 'var(--mkt-ink)' }}>{revealed.name}</p>
              {revealed.phone ? (
                <>
                  <div className="mt-4 flex items-center gap-2">
                    <a href={`tel:${revealed.phone}`}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-white font-bold"
                      style={{ background: 'var(--mkt-primary)' }}>
                      <PhoneCall className="w-4 h-4" /> {revealed.phone}
                    </a>
                    <button onClick={copyNumber}
                      className="w-12 h-12 rounded-2xl border flex items-center justify-center flex-shrink-0"
                      style={{ borderColor: 'var(--mkt-line)' }} aria-label="Copy number">
                      {copied ? <Check className="w-4 h-4" style={{ color: 'var(--mkt-verified)' }} /> : <Copy className="w-4 h-4" style={{ color: 'var(--mkt-muted)' }} />}
                    </button>
                  </div>
                  <p className="mt-3 text-xs" style={{ color: 'var(--mkt-muted)' }}>
                    The owner has also been notified that you&apos;re interested.
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm" style={{ color: 'var(--mkt-muted)' }}>
                  Your request was sent. The owner will call you back shortly.
                </p>
              )}
            </div>
          ) : (
            /* ── Form state ── */
            <>
              {phoneMasked && (
                <div className="mb-4 rounded-2xl px-4 py-3 flex items-center justify-between"
                  style={{ background: 'var(--mkt-primary-soft)' }}>
                  <span className="font-mono font-bold tracking-wider text-lg" style={{ color: 'var(--mkt-primary-strong)' }}>
                    {phoneMasked}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--mkt-primary-strong)' }}>Hidden</span>
                </div>
              )}
              <p className="text-sm mb-4" style={{ color: 'var(--mkt-muted)' }}>
                Enter your details to see the full number and get a callback.
              </p>
              <div className="space-y-3">
                <input
                  value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full text-sm border rounded-xl px-3.5 py-3 outline-none focus:ring-2"
                  style={{ borderColor: 'var(--mkt-line)', ['--tw-ring-color' as any]: 'var(--mkt-primary)' }}
                  aria-label="Your name"
                />
                <input
                  value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="Your mobile number" type="tel" inputMode="tel"
                  className="w-full text-sm border rounded-xl px-3.5 py-3 outline-none focus:ring-2"
                  style={{ borderColor: 'var(--mkt-line)', ['--tw-ring-color' as any]: 'var(--mkt-primary)' }}
                  aria-label="Your mobile number"
                  onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                />
                <textarea
                  value={message} onChange={(e) => setMessage(e.target.value)}
                  placeholder="Message (optional)" rows={2}
                  className="w-full text-sm border rounded-xl px-3.5 py-2.5 outline-none resize-none focus:ring-2"
                  style={{ borderColor: 'var(--mkt-line)', ['--tw-ring-color' as any]: 'var(--mkt-primary)' }}
                  aria-label="Optional message"
                />
                {/* Honeypot — visually hidden, off-screen */}
                <input
                  value={hp} onChange={(e) => setHp(e.target.value)}
                  tabIndex={-1} autoComplete="off" aria-hidden="true"
                  className="absolute -left-[9999px] w-px h-px opacity-0"
                  name="company_website"
                />
                {error && <p className="text-xs" style={{ color: 'var(--mkt-danger)' }} role="alert">{error}</p>}
                <button
                  onClick={submit}
                  disabled={sending}
                  className="w-full py-3.5 rounded-2xl text-white font-bold text-sm transition-all disabled:opacity-60 hover:shadow-lg"
                  style={{ background: 'var(--mkt-primary)' }}
                >
                  {sending ? 'Revealing…' : 'View number & request callback'}
                </button>
                <p className="text-[11px] text-center flex items-center justify-center gap-1" style={{ color: 'var(--mkt-muted)' }}>
                  <ShieldCheck className="w-3.5 h-3.5" /> We never share your number publicly.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
