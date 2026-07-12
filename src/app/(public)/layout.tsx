import Link from 'next/link';
import { Home } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ResiSmart Homes — Rent & Buy Properties',
  description: 'Browse verified flats to rent and buy in trusted residential societies near you.',
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mkt min-h-screen" style={{ background: 'var(--mkt-bg)' }}>
      <header className="sticky top-0 z-40 backdrop-blur bg-white/80 border-b" style={{ borderColor: 'var(--mkt-line)' }}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/marketplace" className="flex items-center gap-2 font-black text-lg" style={{ color: 'var(--mkt-primary)' }}>
            <span className="w-8 h-8 rounded-xl flex items-center justify-center text-white" style={{ background: 'var(--mkt-primary)' }}><Home className="w-4 h-4" /></span>
            ResiSmart <span className="font-semibold" style={{ color: 'var(--mkt-ink-soft)' }}>Homes</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm font-semibold">
            <Link href="/marketplace" style={{ color: 'var(--mkt-ink-soft)' }}>Browse</Link>
            <Link href="/login" className="px-4 py-2 rounded-full text-white" style={{ background: 'var(--mkt-primary)' }}>List your property</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
      <footer className="border-t mt-12 py-8 text-center text-xs" style={{ borderColor: 'var(--mkt-line)', color: 'var(--mkt-muted)' }}>
        © ResiSmart Homes · Verified society listings
      </footer>
    </div>
  );
}
