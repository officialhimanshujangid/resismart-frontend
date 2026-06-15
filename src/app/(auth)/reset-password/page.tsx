'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Rocket, Check, ArrowLeft, Eye, EyeOff } from 'lucide-react';

function ResetPasswordForm() {
  const { resetPassword } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token. Please request a new password reset link.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!token) {
      setError('Invalid or missing reset token.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await resetPassword(token, password);
      
      if (!result.success) {
        setError(result.error || 'Failed to reset password');
      } else {
        setSuccessMessage(result.message || 'Password has been reset successfully.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPasswordValid = password.length >= 6;
  const isConfirmValid = confirmPassword.length > 0 && password === confirmPassword;

  return (
    <div className="min-h-screen bg-slate-200/70 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden border border-white/60">
        
        <div className="p-8 md:p-12">
          {/* Header */}
          <div className="flex flex-col items-center text-center space-y-4 mb-8">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center shadow-inner border border-slate-100">
              <Rocket className="w-8 h-8 text-[#0a5bd7] -rotate-45" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">
                Create New Password
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                Enter your new password below.
              </p>
            </div>
          </div>

          {successMessage ? (
            <div className="space-y-6 animate-in fade-in zoom-in duration-300">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-medium text-center flex flex-col items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Check className="w-5 h-5 text-emerald-600" />
                </div>
                {successMessage}
              </div>
              <div className="text-center">
                <Link href="/login" className="text-sm font-bold text-[#0a5bd7] hover:text-[#0952c3] transition-colors flex items-center justify-center gap-2">
                   Proceed to Login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-semibold animate-in fade-in duration-200">
                  {error}
                </div>
              )}

              {/* Password Input */}
              <div className="space-y-1.5 relative">
                <Label htmlFor="password" className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                  New Password
                </Label>
                <div className="relative group">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="border border-slate-200 bg-slate-50 rounded-xl px-4 py-6 pr-12 focus:border-[#0a5bd7] focus:ring-2 focus:ring-[#0a5bd7]/20 transition-all text-slate-800 placeholder:text-slate-400 text-sm w-full font-medium"
                    disabled={isSubmitting || !token}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1.5">
                    {isPasswordValid && (
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
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Confirm Password Input */}
              <div className="space-y-1.5 relative">
                <Label htmlFor="confirmPassword" className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                  Confirm Password
                </Label>
                <div className="relative group">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="border border-slate-200 bg-slate-50 rounded-xl px-4 py-6 pr-12 focus:border-[#0a5bd7] focus:ring-2 focus:ring-[#0a5bd7]/20 transition-all text-slate-800 placeholder:text-slate-400 text-sm w-full font-medium"
                    disabled={isSubmitting || !token}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1.5">
                    {isConfirmValid && (
                      <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center animate-in scale-in duration-200">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={!token}
                  className="w-full bg-gradient-to-r from-[#0a5bd7] to-[#2691f5] hover:from-[#0952c3] hover:to-[#1f80dc] text-white rounded-xl py-6 font-bold shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  loading={isSubmitting}
                >
                  {!isSubmitting && <span>Reset Password</span>}
                </Button>
              </div>

              <div className="text-center pt-2">
                <Link href="/login" className="text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center gap-2">
                  <ArrowLeft className="w-4 h-4" /> Back to Login
                </Link>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-200/70 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-lg bg-white rounded-[32px] shadow-2xl p-12 flex flex-col items-center justify-center border border-white/60">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-pulse" />
            <div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          </div>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
