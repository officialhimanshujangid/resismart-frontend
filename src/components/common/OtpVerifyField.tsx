'use client';

import React, { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { ShieldCheck, CheckCircle2, KeyRound, Loader2, AlertCircle } from 'lucide-react';

type Channel = 'PHONE' | 'EMAIL';

interface Props {
  channel: Channel;
  target: string;             // the email address or phone number to verify
  purpose: string;            // SOCIETY_REGISTRATION | FLAT_REGISTRATION | SHOP_REGISTRATION
  /** Called with the verification token once the code is confirmed. */
  onVerified: (token: string) => void;
  /** Called when the previously-verified state is invalidated (target changed / reset). */
  onReset?: () => void;
  minDigits?: number;         // client-side sanity check before sending (phone)
  disabled?: boolean;
}

/**
 * Self-contained OTP verify widget. Sits beneath the email/phone field it
 * verifies. PHONE shows the dev code on screen (no SMS gateway); EMAIL tells
 * the user to check their inbox (code is never returned by the API).
 */
export default function OtpVerifyField({ channel, target, purpose, onVerified, onReset, minDigits = 6, disabled }: Props) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const verifiedTarget = useRef<string | null>(null);

  // Invalidate verification if the target value changes after verifying.
  useEffect(() => {
    if (verified && target.trim() !== verifiedTarget.current) {
      setVerified(false);
      setSent(false);
      setCode('');
      setDevCode(null);
      setError('');
      onReset?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const isEmail = channel === 'EMAIL';
  const targetValid = isEmail
    ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target.trim())
    : target.replace(/[^0-9]/g, '').length >= minDigits;

  const send = async () => {
    setError('');
    if (!targetValid) { setError(isEmail ? 'Enter a valid email first.' : 'Enter a valid phone number first.'); return; }
    setBusy(true);
    try {
      const res = await api.post('/auth/otp/request', { channel, target: target.trim(), purpose });
      setSent(true);
      setDevCode(res.data.devCode || null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send code.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setError('');
    if (!/^\d{6}$/.test(code)) { setError('Enter the 6-digit code.'); return; }
    setBusy(true);
    try {
      const res = await api.post('/auth/otp/verify', { channel, target: target.trim(), purpose, code });
      verifiedTarget.current = target.trim();
      setVerified(true);
      onVerified(res.data.verificationToken);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Verification failed.');
    } finally {
      setBusy(false);
    }
  };

  if (verified) {
    return (
      <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold mt-1">
        <CheckCircle2 className="w-4 h-4" /> {isEmail ? 'Email verified' : 'Phone verified'}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      {!sent ? (
        <button
          type="button"
          onClick={send}
          disabled={busy || disabled || !targetValid}
          className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
          {isEmail ? 'Send email code' : 'Send OTP'}
        </button>
      ) : (
        <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 space-y-2">
          {isEmail ? (
            <p className="text-xs font-semibold text-blue-800">A 6-digit code was emailed to <span className="font-bold">{target.trim()}</span>. Enter it below.</p>
          ) : devCode ? (
            <p className="text-xs font-semibold text-blue-800">Dev mode (no SMS): OTP is <span className="font-black tracking-widest">{devCode}</span></p>
          ) : (
            <p className="text-xs font-semibold text-blue-800">Enter the 6-digit code sent to your number.</p>
          )}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                className="w-full pl-9 pr-3 h-10 rounded-lg border border-slate-200 text-sm tracking-[0.3em] font-bold outline-none focus:border-[#0a5bd7]"
              />
            </div>
            <button type="button" onClick={verify} disabled={busy}
              className="px-4 h-10 rounded-lg text-sm font-bold bg-[#0a5bd7] text-white hover:bg-[#094cb0] disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
            </button>
            <button type="button" onClick={send} disabled={busy}
              className="px-3 h-10 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100">
              Resend
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-600 font-semibold flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {error}</p>}
    </div>
  );
}
