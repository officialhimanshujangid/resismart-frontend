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
  const { login, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // If already logged in, redirect to dashboard
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isLoading, isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await login(email, password);
      
      if (!result.success) {
        setError(result.error || 'Invalid credentials');
      } else {
        if (result.requiresContextSelection) {
          router.push('/select-context');
        } else {
          router.push('/dashboard');
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEmailValid = email.includes('@') && email.includes('.');

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
              ResiSmart
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

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-semibold animate-in fade-in duration-200">
                  {error}
                </div>
              )}

              {/* Email Input */}
              <div className="space-y-1.5 relative">
                <Label htmlFor="email" className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                  E-mail Address
                </Label>
                <div className="relative group">
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border border-slate-200 bg-slate-50 rounded-xl px-4 py-6 focus:border-[#0a5bd7] focus:ring-2 focus:ring-[#0a5bd7]/20 transition-all text-slate-800 placeholder:text-slate-400 text-sm w-full font-medium"
                    disabled={isSubmitting}
                  />
                  {/* Validation Icon */}
                  {isEmailValid ? (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center animate-in scale-in duration-200">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                  ) : email.length > 0 ? (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">typing</span>
                  ) : null}
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5 relative">
                <Label htmlFor="password" className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                  Password
                </Label>
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
                  
                  {/* Status checklist and show/hide */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1.5">
                    {password.length >= 6 && (
                      <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center animate-in scale-in duration-200">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Remember Me / Forgot Password */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="remember"
                    className="w-4 h-4 rounded text-[#0a5bd7] border-slate-300 focus:ring-[#0a5bd7] focus:ring-offset-0 cursor-pointer"
                  />
                  <Label htmlFor="remember" className="text-xs text-slate-500 font-medium cursor-pointer">
                    Keep me signed in
                  </Label>
                </div>
                <Link href="/forgot-password" className="text-xs text-[#0a5bd7] font-semibold hover:text-[#0952c3] hover:underline transition-colors">
                  Forgot Password?
                </Link>
              </div>

              {/* Buttons: Sign In (Filled) */}
              <div className="pt-4">
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-[#0a5bd7] to-[#2691f5] hover:from-[#0952c3] hover:to-[#1f80dc] text-white rounded-xl py-6 font-bold shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-1.5"
                  loading={isSubmitting}
                >
                  {!isSubmitting && <span>Sign In</span>}
                </Button>
              </div>
            </form>
          </div>

        </div>

      </div>
    </div>
  );
}
