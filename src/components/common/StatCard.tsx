'use client';

import React from 'react';

type Tone = 'blue' | 'emerald' | 'amber' | 'violet' | 'rose' | 'slate';

const TONES: Record<Tone, { bg: string; fg: string; ring: string }> = {
  blue: { bg: 'bg-blue-50', fg: 'text-blue-600', ring: 'ring-blue-100' },
  emerald: { bg: 'bg-emerald-50', fg: 'text-emerald-600', ring: 'ring-emerald-100' },
  amber: { bg: 'bg-amber-50', fg: 'text-amber-600', ring: 'ring-amber-100' },
  violet: { bg: 'bg-violet-50', fg: 'text-violet-600', ring: 'ring-violet-100' },
  rose: { bg: 'bg-rose-50', fg: 'text-rose-600', ring: 'ring-rose-100' },
  slate: { bg: 'bg-slate-100', fg: 'text-slate-600', ring: 'ring-slate-100' },
};

export default function StatCard({
  label, value, icon, tone = 'blue', sub, loading,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  tone?: Tone;
  sub?: string;
  loading?: boolean;
}) {
  const t = TONES[tone];
  return (
    <div className="group relative bg-white border border-slate-200/70 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full ${t.bg} opacity-50 group-hover:scale-110 transition-transform duration-500`} />
      <div className="relative flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</p>
          {loading ? (
            <div className="h-8 w-16 mt-2 rounded-lg bg-slate-100 animate-pulse" />
          ) : (
            <p className="text-3xl font-black text-slate-800 mt-1 tracking-tight tabular-nums">{value}</p>
          )}
          {sub && <p className="text-[11px] font-semibold text-slate-400 mt-1">{sub}</p>}
        </div>
        <div className={`shrink-0 w-11 h-11 rounded-xl ${t.bg} ${t.fg} ring-4 ${t.ring} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
