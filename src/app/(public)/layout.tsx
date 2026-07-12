'use client';

import Link from 'next/link';
import { Home } from 'lucide-react';
import { CompareBadge } from '@/components/marketplace/CompareButton';
import '@/components/marketplace/theme.css';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mkt min-h-screen" style={{ background: 'var(--mkt-bg)' }}>
      {/* Sticky branded header */}
      <header className="sticky top-0 z-40 backdrop-blur-md border-b"
        style={{ background: 'rgba(255,255,255,0.85)', borderColor: 'var(--mkt-line)' }}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/property-marketplace" className="flex items-center gap-2.5 font-black text-lg flex-shrink-0" style={{ color: 'var(--mkt-primary)' }}>
            <span className="w-8 h-8 rounded-xl flex items-center justify-center text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--mkt-primary), var(--mkt-primary-strong))' }}>
              <Home className="w-4 h-4" />
            </span>
            ResiSmart <span className="font-semibold hidden sm:inline" style={{ color: 'var(--mkt-ink-soft)' }}>Homes</span>
          </Link>

          {/* Nav */}
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/property-marketplace" className="font-semibold hidden sm:block hover:underline" style={{ color: 'var(--mkt-ink-soft)' }}>
              Browse
            </Link>
            <CompareBadge />
            <Link
              href="/login"
              className="px-4 py-2 rounded-full text-white font-semibold transition-all hover:opacity-90 hover:shadow-md text-sm flex-shrink-0"
              style={{ background: 'var(--mkt-primary)' }}
            >
              List property
            </Link>
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>

      {/* Footer */}
      <footer className="border-t mt-16 py-10" style={{ borderColor: 'var(--mkt-line)', background: 'var(--mkt-surface)' }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 font-black text-base mb-2" style={{ color: 'var(--mkt-primary)' }}>
                <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white" style={{ background: 'var(--mkt-primary)' }}>
                  <Home className="w-3.5 h-3.5" />
                </span>
                ResiSmart Homes
              </div>
              <p className="text-sm" style={{ color: 'var(--mkt-muted)' }}>
                Verified flats from trusted residential societies.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <Link href="/property-marketplace" className="hover:underline font-medium" style={{ color: 'var(--mkt-ink-soft)' }}>Property Marketplace</Link>
              <Link href="/property-marketplace/compare" className="hover:underline font-medium" style={{ color: 'var(--mkt-ink-soft)' }}>Compare</Link>
              <Link href="/login" className="hover:underline font-medium" style={{ color: 'var(--mkt-ink-soft)' }}>List your property</Link>
              <Link href="/login" className="hover:underline font-medium" style={{ color: 'var(--mkt-ink-soft)' }}>Sign in</Link>
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
