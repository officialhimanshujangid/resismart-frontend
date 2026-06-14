'use client';

import React, { useState } from 'react';
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
  User, 
  Eye, 
  EyeOff, 
  Check 
} from 'lucide-react';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!name || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await register(name, email, password);

      if (!result.success) {
        setError(result.error || 'Registration failed');
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push('/login');
        }, 3000);
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
          
          <div className="w-full max-w-md mx-auto space-y-6">
            {/* Header Title */}
            <div className="space-y-1">
              <h2 className="text-2xl lg:text-3xl font-extrabold text-slate-800 tracking-tight animate-in fade-in duration-200">
                Create your account
              </h2>
              <p className="text-slate-400 text-sm">
                Sign up to request access to societies or shops
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-semibold animate-in fade-in duration-200">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-sm font-semibold animate-in fade-in duration-200">
                  Registration successful! Redirecting to login...
                </div>
              )}

              {/* Full Name Input */}
              <div className="space-y-1.5 relative">
                <Label htmlFor="name" className="text-sm font-bold text-slate-800">
                  Name
                </Label>
                <div className="relative">
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="border-t-0 border-l-0 border-r-0 border-b border-slate-200 rounded-none bg-transparent px-0 pb-2 focus:border-[#0a5bd7] focus:ring-0 focus-visible:ring-0 focus:bg-transparent shadow-none text-slate-800 placeholder:text-slate-400 text-sm w-full"
                    disabled={isSubmitting || success}
                  />
                  {name.trim().length >= 2 && (
                    <Check className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 animate-in scale-in duration-200" />
                  )}
                </div>
              </div>

              {/* Email Input */}
              <div className="space-y-1.5 relative">
                <Label htmlFor="email" className="text-sm font-bold text-slate-800">
                  E-mail Address
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border-t-0 border-l-0 border-r-0 border-b border-slate-200 rounded-none bg-transparent px-0 pb-2 focus:border-[#0a5bd7] focus:ring-0 focus-visible:ring-0 focus:bg-transparent shadow-none text-slate-800 placeholder:text-slate-400 text-sm w-full"
                    disabled={isSubmitting || success}
                  />
                  {isEmailValid && (
                    <Check className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 animate-in scale-in duration-200" />
                  )}
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5 relative">
                <Label htmlFor="password" className="text-sm font-bold text-slate-800">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="border-t-0 border-l-0 border-r-0 border-b border-slate-200 rounded-none bg-transparent px-0 pr-8 pb-2 focus:border-[#0a5bd7] focus:ring-0 focus-visible:ring-0 focus:bg-transparent shadow-none text-slate-800 placeholder:text-slate-400 text-sm w-full"
                    disabled={isSubmitting || success}
                  />
                  
                  {/* Status checkbox and eye toggle */}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                    {password.length >= 6 && (
                      <Check className="w-4 h-4 text-emerald-500 animate-in scale-in duration-200" />
                    )}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 text-slate-400 hover:text-slate-700 transition-colors"
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

              {/* Terms Checkbox */}
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="agree"
                  required
                  className="w-4 h-4 rounded text-[#0a5bd7] border-slate-300 focus:ring-[#0a5bd7] focus:ring-offset-0 cursor-pointer"
                  disabled={isSubmitting || success}
                />
                <Label htmlFor="agree" className="text-xs text-slate-500 font-medium cursor-pointer leading-normal">
                  By Signing Up, I agree with <a href="#" className="text-[#0a5bd7] hover:underline font-semibold">Terms & Conditions</a>
                </Label>
              </div>

              {/* Buttons: Sign Up (Filled) & Sign In (Outlined) */}
              <div className="flex items-center space-x-4 pt-4">
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-[#0a5bd7] to-[#2691f5] hover:from-[#0952c3] hover:to-[#1f80dc] text-white rounded-full px-8 py-2.5 font-bold shadow-md shadow-blue-500/20 active:scale-[0.98] transition-all text-sm min-w-[120px] flex items-center justify-center gap-1.5"
                  loading={isSubmitting}
                  disabled={success}
                >
                  {!isSubmitting && <span>Sign Up</span>}
                </Button>

                <Link
                  href="/login"
                  className="border border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-slate-500 rounded-full px-8 py-2.5 font-bold transition-all text-sm text-center min-w-[120px] inline-block"
                >
                  Sign In
                </Link>
              </div>
            </form>
          </div>

        </div>

      </div>
    </div>
  );
}
