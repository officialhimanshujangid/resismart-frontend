'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Rocket, Check, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email) {
      setError('Please enter your email address.');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await forgotPassword(email);
      
      if (!result.success) {
        setError(result.error || 'Failed to send reset email');
      } else {
        setSuccessMessage(result.message || 'If an account exists, an email has been sent.');
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
      <div className="w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden border border-white/60">
        
        <div className="p-8 md:p-12">
          {/* Header */}
          <div className="flex flex-col items-center text-center space-y-4 mb-8">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center shadow-inner border border-slate-100">
              <Rocket className="w-8 h-8 text-[#0a5bd7] -rotate-45" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">
                Reset Password
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                Enter your email address and we'll send you a link to reset your password.
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
                  <ArrowLeft className="w-4 h-4" /> Back to Login
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
                  {isEmailValid ? (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center animate-in scale-in duration-200">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                  ) : email.length > 0 ? (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">typing</span>
                  ) : null}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-[#0a5bd7] to-[#2691f5] hover:from-[#0952c3] hover:to-[#1f80dc] text-white rounded-xl py-6 font-bold shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-1.5"
                  loading={isSubmitting}
                >
                  {!isSubmitting && <span>Send Reset Link</span>}
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
