'use client';

import React from 'react';

interface BrandLoaderProps {
  label?: string;
  /** `page` = full-screen centered; `inline` = fills its parent. */
  variant?: 'page' | 'inline';
}

/**
 * The single, on-brand loading indicator for the app. Replaces the ad-hoc spinners
 * (dark/violet ProtectedRoute loader, bare CircularProgress, etc.) so every waiting
 * state reads as the same product. Brand blue #0a5bd7 on a light surface.
 */
export const BrandLoader: React.FC<BrandLoaderProps> = ({ label = 'Loading…', variant = 'page' }) => {
  const wrap =
    variant === 'page'
      ? 'min-h-screen bg-[#f8fafc]'
      : 'w-full h-full min-h-[240px]';
  return (
    <div className={`${wrap} flex flex-col items-center justify-center gap-4`}>
      <div className="relative w-14 h-14" role="status" aria-live="polite" aria-label={label}>
        <div className="absolute inset-0 rounded-full border-4 border-[#0a5bd7]/15" />
        <div className="absolute inset-0 rounded-full border-4 border-t-[#0a5bd7] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
      </div>
      {label && <p className="text-sm text-slate-500 font-semibold tracking-wide">{label}</p>}
    </div>
  );
};

export default BrandLoader;
