'use client';

import Link from 'next/link';
import { Home } from 'lucide-react';
import { CompareBadge } from '@/components/marketplace/CompareButton';
import '@/components/marketplace/theme.css';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mkt min-h-screen" style={{ background: 'var(--mkt-bg)' }}>
      {/* Sticky branded header */}
      <header className="sticky top-0 z-50 backdrop-blur-md border-b"
        style={{ background: 'rgba(255,255,255,0.85)', borderColor: 'var(--mkt-line)' }}>
        <div className="max-w-auto mx-auto px-4 h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo */}
          <Link href="/property-marketplace" className="flex items-center gap-1.5 sm:gap-2 font-black text-lg min-w-0" aria-label="ResiSmart Homes">
            <img src="/resismartlogo.png" alt="ResiSmart" className="h-6 sm:h-8 w-auto object-contain shrink-0" />
            <span className="font-semibold text-base sm:text-lg" style={{ color: 'var(--mkt-ink-soft)' }}>Homes</span>
          </Link>

          {/* Nav */}
          <nav className="flex items-center gap-3 text-sm flex-shrink-0">
            <CompareBadge />
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-auto mx-auto px-4 py-6">{children}</main>

      {/* Footer */}
      <footer className="border-t mt-16 py-10" style={{ borderColor: 'var(--mkt-line)', background: 'var(--mkt-surface)' }}>
        <div className="max-w-auto mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 font-black text-base mb-2" style={{ color: 'var(--mkt-ink-soft)' }}>
                <img src="/resismartlogo.png" alt="ResiSmart" className="h-6 w-auto object-contain opacity-90" />
                Homes
              </div>
              <p className="text-sm" style={{ color: 'var(--mkt-muted)' }}>
                Verified flats from trusted residential societies.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <Link href="/property-marketplace" className="hover:underline font-medium" style={{ color: 'var(--mkt-ink-soft)' }}>Resismart Housing</Link>
              <Link href="/property-marketplace/compare" className="hover:underline font-medium" style={{ color: 'var(--mkt-ink-soft)' }}>Compare</Link>
            </div>
          </div>
          <div className="border-t mt-8 pt-4 text-xs text-center" style={{ borderColor: 'var(--mkt-line)', color: 'var(--mkt-muted)' }}>
            © {new Date().getFullYear()} ResiSmart · Verified society listings · All rights reserved
          </div>
        </div>
      </footer>
    </div>
  );
}
