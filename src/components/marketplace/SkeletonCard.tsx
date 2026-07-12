'use client';

/** Animated shimmer skeleton card — shown while listings are loading. */
export default function SkeletonCard() {
  return (
    <div className="rounded-2xl bg-white overflow-hidden border animate-pulse" style={{ borderColor: 'var(--mkt-line)' }}>
      <div className="h-48 bg-slate-200" />
      <div className="p-4 space-y-3">
        <div className="h-3 w-16 bg-slate-200 rounded-full" />
        <div className="h-4 w-3/4 bg-slate-200 rounded-full" />
        <div className="h-3 w-1/2 bg-slate-200 rounded-full" />
        <div className="h-6 w-1/3 bg-slate-200 rounded-full mt-2" />
      </div>
    </div>
  );
}
