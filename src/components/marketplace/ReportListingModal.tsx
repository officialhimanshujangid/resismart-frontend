'use client';

import { useState } from 'react';
import { Flag, X } from 'lucide-react';
import api from '@/lib/api';

const REASONS = [
  { value: 'WRONG_INFO', label: 'Incorrect information' },
  { value: 'SPAM', label: 'Spam or duplicate listing' },
  { value: 'SCAM', label: 'Scam or fraudulent' },
  { value: 'INAPPROPRIATE', label: 'Inappropriate content' },
  { value: 'OTHER', label: 'Other' },
];

interface Props {
  listingId: string;
  listingTitle: string;
}

/** Modal to report a listing for abuse — honeypot-protected on the backend. */
export default function ReportListingModal({ listingId, listingTitle }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!reason) { setError('Please select a reason'); return; }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/public/marketplace/reports', { listingId, reason, details });
      setDone(true);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => { setOpen(false); setDone(false); setReason(''); setDetails(''); setError(''); };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors hover:bg-red-50 hover:border-red-300 hover:text-red-600"
        style={{ borderColor: 'var(--mkt-line)', color: 'var(--mkt-muted)' }}
      >
        <Flag className="w-3.5 h-3.5" />
        Report listing
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
          role="dialog" aria-modal="true" aria-label="Report listing">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" style={{ color: 'var(--mkt-ink)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-lg flex items-center gap-2">
                <Flag className="w-5 h-5 text-red-500" />
                Report listing
              </h2>
              <button onClick={close} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            {done ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                  <Flag className="w-6 h-6 text-green-600" />
                </div>
                <p className="font-semibold">Report submitted</p>
                <p className="text-sm mt-1" style={{ color: 'var(--mkt-muted)' }}>
                  Thank you for helping keep listings trustworthy.
                </p>
                <button onClick={close} className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--mkt-primary)' }}>Close</button>
              </div>
            ) : (
              <>
                <p className="text-sm mb-4" style={{ color: 'var(--mkt-muted)' }}>
                  Reporting: <strong style={{ color: 'var(--mkt-ink)' }}>{listingTitle}</strong>
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-semibold mb-1.5" htmlFor="report-reason">Reason *</label>
                    <select
                      id="report-reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-500"
                      style={{ borderColor: 'var(--mkt-line)' }}
                    >
                      <option value="">Select a reason…</option>
                      {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1.5" htmlFor="report-details">Details (optional)</label>
                    <textarea
                      id="report-details"
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      placeholder="Describe the issue in a few words…"
                      rows={3}
                      maxLength={500}
                      className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                      style={{ borderColor: 'var(--mkt-line)' }}
                    />
                  </div>

                  {/* Honeypot — hidden from humans */}
                  <input type="text" name="_hp" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" />

                  {error && <p className="text-xs text-red-600">{error}</p>}

                  <div className="flex gap-2 pt-1">
                    <button onClick={close} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-slate-50" style={{ borderColor: 'var(--mkt-line)' }}>
                      Cancel
                    </button>
                    <button
                      onClick={submit}
                      disabled={submitting}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                      style={{ background: '#e11d48' }}
                    >
                      {submitting ? 'Submitting…' : 'Submit report'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
