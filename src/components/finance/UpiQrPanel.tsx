'use client';

import React, { useState, useEffect } from 'react';
import { Button, CircularProgress } from '@mui/material';
import { Info, Copy, Check } from 'lucide-react';
import QRCode from 'qrcode';

const rupees = (p?: number) => `₹${((p || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const VPA_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

/** UPI apps reject notes/names with punctuation; keep to alphanumerics + spaces, 50 chars. */
const upiSafe = (s: string) => s.replace(/[^a-zA-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50);

/** Build an NPCI `upi://pay` deep link. `am` is omitted when 0 so the payer can key it in. */
export const buildUpiUri = (upiId: string, payeeName: string | undefined, amountPaise: number, note?: string) => {
  const enc = encodeURIComponent;
  const parts = [`pa=${enc(upiId)}`];
  const pn = upiSafe(payeeName || '');
  if (pn) parts.push(`pn=${enc(pn)}`);
  parts.push('cu=INR');
  if (amountPaise > 0) parts.push(`am=${(amountPaise / 100).toFixed(2)}`);
  const tn = upiSafe(note || '');
  if (tn) parts.push(`tn=${enc(tn)}`);
  return `upi://pay?${parts.join('&')}`;
};

interface Props { upiId: string; payeeName?: string; amountPaise: number; note?: string; }

/**
 * Scannable UPI QR for resident dues. The intent settles bank-to-bank with no
 * gateway webhook, so the caller still has to collect a UTR and route it through
 * the committee-confirmation flow — this only pre-fills the payer's UPI app.
 */
export default function UpiQrPanel({ upiId, payeeName, amountPaise, note }: Props) {
  const [dataUrl, setDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const trimmed = upiId.trim();
  const valid = VPA_RE.test(trimmed);
  const uri = React.useMemo(
    () => buildUpiUri(trimmed, payeeName, amountPaise, note),
    [trimmed, payeeName, amountPaise, note],
  );

  useEffect(() => {
    if (!valid) { setDataUrl(''); return; }
    let cancelled = false;
    QRCode.toDataURL(uri, { width: 320, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0f172a', light: '#ffffff' } })
      .then(u => { if (!cancelled) setDataUrl(u); })
      .catch(() => { if (!cancelled) setDataUrl(''); });
    return () => { cancelled = true; };
  }, [uri, valid]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(trimmed); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { /* clipboard blocked — the VPA is on screen anyway */ }
  };

  if (!valid) {
    return (
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800 flex gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        Your society&apos;s UPI ID (<span className="font-mono font-bold">{trimmed || '—'}</span>) isn&apos;t a valid UPI ID, so a QR can&apos;t be generated. Please ask your committee to correct it.
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col items-center gap-3">
      <div className="h-[200px] w-[200px] flex items-center justify-center">
        {dataUrl
          ? <img src={dataUrl} alt={`UPI QR code to pay ${rupees(amountPaise)} to ${trimmed}`} className="h-[200px] w-[200px] rounded-lg" />
          : <CircularProgress size={24} />}
      </div>
      <div className="text-center">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Scan with any UPI app</p>
        <p className="text-2xl font-black text-slate-800 mt-0.5">{amountPaise > 0 ? rupees(amountPaise) : 'Enter an amount'}</p>
        {payeeName && <p className="text-xs text-slate-500 font-semibold mt-0.5">to {payeeName}</p>}
      </div>
      <button onClick={copy} className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-1.5 font-mono">
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
        {trimmed}
      </button>
      <Button href={uri} variant="outlined" size="small" fullWidth className="font-bold sm:hidden">Open in UPI app</Button>
    </div>
  );
}
