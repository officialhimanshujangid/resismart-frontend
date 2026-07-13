'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Scale } from 'lucide-react';

const MAX_COMPARE = 4;
const STORAGE_KEY = 'mkt_compare_ids';

export function useCompare() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setIds(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < MAX_COMPARE ? [...prev, id] : prev;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setIds([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  const isInCompare = (id: string) => ids.includes(id);

  return { ids, toggle, clear, isInCompare, count: ids.length };
}

/** Inline compare button — adds/removes a listing from the local compare tray. */
export function CompareButton({ listingId, size = 'sm' }: { listingId: string; size?: 'sm' | 'md' }) {
  const { toggle, isInCompare } = useCompare();
  const inTray = isInCompare(listingId);

  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(listingId); }}
      title={inTray ? 'Remove from compare' : 'Add to compare'}
      className={`flex items-center gap-1 font-semibold rounded-full border transition-all ${
        size === 'md' ? 'px-3 py-1.5 text-sm' : 'px-2 py-1 text-xs'
      } ${inTray ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600'}`}
      style={{ backdropFilter: 'blur(4px)' }}
    >
      <Scale className={size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
      {size === 'md' && <span>{inTray ? 'In compare' : 'Compare'}</span>}
    </button>
  );
}

/** Nav badge showing current compare tray count + link to compare page. */
export function CompareBadge() {
  const { count } = useCompare();
  const router = useRouter();
  if (count === 0) return null;

  return (
    <button
      onClick={() => router.push('/property-marketplace/compare')}
      aria-label={`Compare (${count})`}
      className="relative flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-sm font-semibold text-white transition-all hover:scale-105"
      style={{ background: 'var(--mkt-primary)' }}
    >
      <Scale className="w-4 h-4" />
      <span className="hidden sm:inline">Compare</span>
      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-xs font-black flex items-center justify-center"
        style={{ background: 'var(--mkt-accent)', color: '#fff' }}>
        {count}
      </span>
    </button>
  );
}
