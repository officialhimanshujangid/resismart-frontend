'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { PhoneCall, Phone, ExternalLink, Search, Eye, Clock, Megaphone } from 'lucide-react';

interface Lead {
  _id: string;
  from: { name: string; phone: string };
  message?: string;
  createdAt: string;
  listingId?: { _id: string; title: string; kind: string; slug: string; city?: string; pricePaise?: number } | null;
}

const money = (p?: number) => (p != null ? `₹${(p / 100).toLocaleString('en-IN')}` : '');

export default function MyLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<{ total: number; last7d: number; listings: number }>({ total: 0, last7d: 0, listings: 0 });

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/marketplace/my-leads', { params: { search: debounced || undefined, page, pageSize: 20 } });
      setLeads(res.data.leads || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
      setStats(res.data.stats || { total: 0, last7d: 0, listings: 0 });
    } catch { setLeads([]); } finally { setLoading(false); }
  }, [debounced, page]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0f766e] to-[#14b8a6] p-6 shadow-lg">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <PhoneCall className="w-6 h-6 text-white" />
            <h1 className="text-2xl font-black text-white tracking-tight">Who viewed my number</h1>
          </div>
          <p className="text-sm text-teal-50 mt-1">People who requested your contact from your listings — call them back.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatTile icon={<Eye className="w-5 h-5" />} label="Total views" value={stats.total.toLocaleString()} />
        <StatTile icon={<Clock className="w-5 h-5" />} label="Last 7 days" value={stats.last7d.toLocaleString()} />
        <StatTile icon={<Megaphone className="w-5 h-5" />} label="Your listings" value={stats.listings.toLocaleString()} />
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone…"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : leads.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <PhoneCall className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="font-semibold">No contact requests yet</p>
          <p className="text-sm">When someone views your number on the public portal, they&apos;ll show up here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {leads.map((ld) => (
            <div key={ld._id} className="rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-black text-slate-800">{ld.from?.name}</div>
                  {ld.listingId ? (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                      <span className="line-clamp-1">{ld.listingId.title}</span>
                      <Link href={`/property-marketplace/${ld.listingId.slug}`} target="_blank" className="text-teal-600 flex-shrink-0" aria-label="Open listing">
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  ) : <span className="text-xs text-slate-400 italic">Listing removed</span>}
                </div>
                <span className="text-[11px] text-slate-400 whitespace-nowrap flex-shrink-0">
                  {new Date(ld.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              </div>
              {ld.message && <p className="text-sm text-slate-600 mt-2 bg-slate-50 rounded-lg px-3 py-2">&ldquo;{ld.message}&rdquo;</p>}
              <a href={`tel:${ld.from?.phone}`}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 transition-colors">
                <Phone className="w-4 h-4" /> Call {ld.from?.phone}
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 text-sm rounded-lg border disabled:opacity-40 hover:bg-slate-50">← Prev</button>
          <span className="text-sm text-slate-500">Page {page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 text-sm rounded-lg border disabled:opacity-40 hover:bg-slate-50">Next →</button>
        </div>
      )}
    </div>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0">{icon}</div>
      <div>
        <div className="text-xl font-black text-slate-800 leading-none">{value}</div>
        <div className="text-xs text-slate-500 mt-1">{label}</div>
      </div>
    </div>
  );
}
