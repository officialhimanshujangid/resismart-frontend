'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import {
  Rocket,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Check,
  Building
} from 'lucide-react';

export default function LoginPage() {
  const { login, loginOtpRequest, loginOtpVerify, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Default flow changed to password.
  const [mode, setMode] = useState<'otp' | 'password'>('password');
  const [otpStep, setOtpStep] = useState<'identifier' | 'code'>('identifier');
  const [otpCode, setOtpCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.push('/dashboard');
  }, [isLoading, isAuthenticated, router]);

  const resetOtp = () => { setOtpStep('identifier'); setOtpCode(''); setDevCode(null); setInfo(null); };

  const sendCode = async () => {
    setError(null); setInfo(null);
    if (!identifier.trim()) { setError('Enter your email or phone number.'); return; }
    setIsSubmitting(true);
    const res = await loginOtpRequest(identifier.trim());
    setIsSubmitting(false);
    if (!res.success) { setError(res.error || 'Failed to send code'); return; }
    setDevCode(res.devCode || null);
    if (!res.devCode) setInfo(res.channel === 'EMAIL' ? 'If an account exists, a code was emailed to you.' : 'If an account exists, a code was sent.');
    setOtpStep('code');
  };

  const verifyCode = async () => {
    setError(null);
    if (!/^\d{6}$/.test(otpCode)) { setError('Enter the 6-digit code.'); return; }
    setIsSubmitting(true);
    const res = await loginOtpVerify(identifier.trim(), otpCode);
    setIsSubmitting(false);
    if (!res.success) { setError(res.error || 'Verification failed'); return; }
    router.push('/dashboard');
  };

  const passwordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!identifier || !password) { setError('Please fill in all fields.'); return; }
    setIsSubmitting(true);
    const result = await login(identifier.trim(), password);
    setIsSubmitting(false);
    if (result.success) { router.push('/dashboard'); return; }
    if (result.useOtp) { setMode('otp'); resetOtp(); setError('This account signs in with a one-time code — request one above.'); return; }
    setError(result.error || 'Invalid credentials');
  };

  const isEmailEntry = identifier.includes('@');
  const isIdentifierValid = isEmailEntry
    ? identifier.includes('@') && identifier.includes('.')
    : identifier.replace(/[^0-9]/g, '').length >= 10;

  return (
    <div className="min-h-screen bg-slate-200/70 flex items-center justify-center p-4 md:p-8">
      {/* Container Card */}
      <div className="w-full max-w-5xl bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col lg:flex-row relative min-h-[580px] lg:h-[620px] border border-white/60">

        {/* LEFT PANEL: Branding & Visuals (Desktop & Mobile header) */}
        <div className="w-full lg:w-[42%] bg-gradient-to-b from-[#0a5bd7] to-[#2691f5] p-8 lg:p-12 flex flex-col justify-between text-white relative min-h-[260px] lg:min-h-full">

          {/* Subtle radial overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.08),transparent_60%)] pointer-events-none" />

          {/* Top text for desktop / welcome banner */}
          <div className="relative z-10 text-center lg:text-left mt-2 lg:mt-0">
            <span className="text-white/80 font-bold uppercase tracking-wider text-xs lg:text-sm">Welcome to</span>
          </div>

          {/* Centered logo container */}
          <div className="relative z-10 my-auto flex flex-col items-center">
            {/* White Circle Badge with blue Rocket icon */}
            <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-full bg-white flex items-center justify-center shadow-lg transform transition-transform hover:scale-105 duration-300">
              <Rocket className="w-10 h-10 lg:w-12 lg:h-12 text-[#0a5bd7] -rotate-45" />
            </div>
            {/* Brand Title */}
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight mt-4 text-white">
              Resismart
            </h1>
            {/* Tagline */}
            <p className="text-white/70 text-xs lg:text-sm text-center max-w-xs mt-3 leading-relaxed hidden lg:block">
              Manage your residential societies, commercial shops, and committee logs with ease and security.
            </p>
          </div>

          {/* Bottom Footer text */}
          <div className="relative z-10 flex items-center justify-center space-x-4 text-[10px] text-white/50 tracking-wider font-semibold mt-4 lg:mt-0">
            <span>SECURE PORTAL</span>
            <span className="w-[1px] h-3 bg-white/20" />
            <span>COMPLIANCE ENFORCED</span>
          </div>

          {/* SVG Wave Divider (Mobile layout only - horizontal) */}
          <div className="absolute bottom-0 left-0 right-0 h-10 translate-y-1/2 overflow-hidden pointer-events-none z-10 lg:hidden">
            <svg className="w-full h-full" viewBox="0 0 800 100" preserveAspectRatio="none">
              {/* Wave 1 (Back, light blue) */}
              <path
                d="M0,100 C120,70 80,30 240,50 C350,65 420,20 560,40 C670,55 720,25 800,100 Z"
                fill="rgba(38, 145, 245, 0.25)"
              />
              {/* Wave 2 (Middle, medium blue) */}
              <path
                d="M0,100 C90,85 140,45 280,60 C410,75 495,35 610,55 C700,70 740,55 800,100 Z"
                fill="rgba(10, 91, 215, 0.15)"
              />
              {/* Wave 3 (Front, white background) */}
              <path
                d="M0,100 C60,95 180,65 320,80 C450,95 540,55 660,75 C740,90 770,80 800,100 Z"
                fill="#ffffff"
              />
            </svg>
          </div>

          {/* SVG Wave Divider (Desktop layout only - vertical) */}
          <div className="absolute right-0 top-0 bottom-0 w-24 translate-x-1/2 overflow-hidden pointer-events-none z-10 hidden lg:block">
            <svg className="h-full w-full" viewBox="0 0 100 800" preserveAspectRatio="none">
              {/* Wave 1 (Back, light blue) */}
              <path
                d="M0,0 C30,120 70,80 50,240 C35,350 80,420 60,560 C45,670 75,720 0,800 Z"
                fill="rgba(38, 145, 245, 0.25)"
              />
              {/* Wave 2 (Middle, medium blue) */}
              <path
                d="M0,0 C15,90 55,140 40,280 C25,410 65,490 45,610 C30,700 45,740 0,800 Z"
                fill="rgba(10, 91, 215, 0.15)"
              />
              {/* Wave 3 (Front, white background) */}
              <path
                d="M0,0 C5,60 35,180 20,320 C5,450 45,540 25,660 C10,740 20,770 0,800 Z"
                fill="#ffffff"
              />
            </svg>
          </div>

        </div>

        {/* RIGHT PANEL: Form Inputs (Desktop & Mobile bottom) */}
        <div className="flex-1 p-8 md:p-12 lg:p-16 flex flex-col justify-center bg-white relative z-0">

          <div className="w-full max-w-md mx-auto space-y-8">
            {/* Header Title */}
            <div className="space-y-1">
              <h2 className="text-2xl lg:text-3xl font-extrabold text-slate-800 tracking-tight">
                Sign in to your account
              </h2>
              <p className="text-slate-400 text-sm">
                Enter your credentials to access your secure portal
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (mode === 'password') passwordSubmit(e);
                else if (otpStep === 'identifier') sendCode();
                else verifyCode();
              }}
              className="space-y-6"
            >
              {error && (
                <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-semibold animate-in fade-in duration-200">
                  {error}
                </div>
              )}
              {info && (
                <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 text-sm font-semibold animate-in fade-in duration-200">
                  {info}
                </div>
              )}

              {/* Email or Phone Input */}
              <div className="space-y-1.5 relative">
                <Label htmlFor="identifier" className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                  Email or Phone Number
                </Label>
                <div className="relative group">
                  <Input
                    id="identifier"
                    type="text"
                    inputMode="email"
                    autoComplete="username"
                    placeholder="name@example.com or 9876543210"
                    value={identifier}
                    onChange={(e) => { setIdentifier(e.target.value); if (mode === 'otp' && otpStep === 'code') resetOtp(); }}
                    className="border border-slate-200 bg-slate-50 rounded-xl px-4 py-6 focus:border-[#0a5bd7] focus:ring-2 focus:ring-[#0a5bd7]/20 transition-all text-slate-800 placeholder:text-slate-400 text-sm w-full font-medium disabled:opacity-70"
                    disabled={isSubmitting || (mode === 'otp' && otpStep === 'code')}
                  />
                  {isIdentifierValid ? (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center animate-in scale-in duration-200">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                  ) : identifier.length > 0 ? (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">typing</span>
                  ) : null}
                </div>
              </div>

              {/* PASSWORD MODE (owner / staff) */}
              {mode === 'password' && (
                <div className="space-y-1.5 relative">
                  <Label htmlFor="password" className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Password</Label>
                  <div className="relative group">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="border border-slate-200 bg-slate-50 rounded-xl px-4 py-6 pr-12 focus:border-[#0a5bd7] focus:ring-2 focus:ring-[#0a5bd7]/20 transition-all text-slate-800 placeholder:text-slate-400 text-sm w-full font-medium"
                      disabled={isSubmitting}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex justify-end pt-1">
                    <Link href="/forgot-password" className="text-xs text-[#0a5bd7] font-semibold hover:text-[#0952c3] hover:underline transition-colors">Forgot Password?</Link>
                  </div>
                </div>
              )}

              {/* OTP CODE STEP */}
              {mode === 'otp' && otpStep === 'code' && (
                <div className="space-y-2">
                  {devCode && (
                    <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-xs font-semibold text-blue-800">
                      Dev mode (no SMS gateway): your code is <span className="font-black tracking-widest">{devCode}</span>
                    </div>
                  )}
                  <Label htmlFor="otp" className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">One-time code</Label>
                  <Input
                    id="otp"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="6-digit code"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                    className="border border-slate-200 bg-slate-50 rounded-xl px-4 py-6 tracking-[0.4em] font-bold text-slate-800 text-sm w-full"
                    disabled={isSubmitting}
                  />
                  <div className="flex justify-end">
                    <button type="button" onClick={sendCode} disabled={isSubmitting} className="text-xs text-[#0a5bd7] font-semibold hover:underline">Resend code</button>
                  </div>
                </div>
              )}

              {/* Submit */}
              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-[#0a5bd7] to-[#2691f5] hover:from-[#0952c3] hover:to-[#1f80dc] text-white rounded-xl py-6 font-bold shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-1.5"
                  loading={isSubmitting}
                >
                  {!isSubmitting && <span>{mode === 'password' ? 'Sign In' : otpStep === 'identifier' ? 'Send code' : 'Verify & sign in'}</span>}
                </Button>
              </div>

              {/* Mode toggle */}
              <div className="text-center">
                {mode === 'otp' ? (
                  <button type="button" onClick={() => { setMode('password'); setError(null); setInfo(null); }} className="text-xs text-slate-500 hover:text-[#0a5bd7] font-semibold">
                    Sign in with password instead
                  </button>
                ) : (
                  <button type="button" onClick={() => { setMode('otp'); resetOtp(); setError(null); }} className="text-xs text-slate-500 hover:text-[#0a5bd7] font-semibold">
                    Use a one-time code instead
                  </button>
                )}
              </div>
            </form>
          </div>

        </div>

      </div>
    </div>
  );
}
