'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Inbox, Phone, ExternalLink, Search, Clock, Users, MessageSquare } from 'lucide-react';

interface Lead {
  _id: string;
  from: { name: string; phone: string; phoneVerified?: boolean };
  message?: string;
  source: string;
  createdAt: string;
  listingId?: { _id: string; title: string; kind: string; slug: string; city?: string; pricePaise?: number } | null;
  societyId?: { _id: string; name: string; city?: string } | null;
}

const money = (p?: number) => (p != null ? `₹${(p / 100).toLocaleString('en-IN')}` : '');

export default function OwnerLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<{ total: number; last24h: number }>({ total: 0, last24h: 0 });

  // Debounce search box.
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/marketplace/owner/leads', {
        params: { search: debounced || undefined, source: source || undefined, page, pageSize: 20 },
      });
      setLeads(res.data.leads || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
      setStats(res.data.stats || { total: 0, last24h: 0 });
    } catch { setLeads([]); } finally { setLoading(false); }
  }, [debounced, source, page]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0f766e] to-[#14b8a6] p-6 shadow-lg">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <Inbox className="w-6 h-6 text-white" />
            <h1 className="text-2xl font-black text-white tracking-tight">Enquiries &amp; Callbacks</h1>
          </div>
          <p className="text-sm text-teal-50 mt-1">Every contact-form submission across Resismart Housing.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatTile icon={<Users className="w-5 h-5" />} label="Total enquiries" value={stats.total.toLocaleString()} />
        <StatTile icon={<Clock className="w-5 h-5" />} label="Last 24 hours" value={stats.last24h.toLocaleString()} />
        <StatTile icon={<MessageSquare className="w-5 h-5" />} label="Showing page" value={`${page} / ${totalPages}`} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        {[{ v: '', l: 'All sources' }, { v: 'PUBLIC', l: 'Public portal' }, { v: 'IN_APP', l: 'In-app' }].map((s) => (
          <button
            key={s.v || 'all'}
            onClick={() => { setSource(s.v); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${source === s.v ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            {s.l}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : leads.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Inbox className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="font-semibold">No enquiries yet</p>
          <p className="text-sm">Submissions from the public property portal will appear here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50/60">
                <th className="px-4 py-3 font-semibold">Enquirer</th>
                <th className="px-4 py-3 font-semibold">Property</th>
                <th className="px-4 py-3 font-semibold">Society</th>
                <th className="px-4 py-3 font-semibold">When</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((ld) => (
                <tr key={ld._id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 align-top">
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-800">{ld.from?.name}</div>
                    <a href={`tel:${ld.from?.phone}`} className="text-teal-700 flex items-center gap-1 mt-0.5 text-xs font-semibold">
                      <Phone className="w-3 h-3" /> {ld.from?.phone}
                    </a>
                    {ld.message && <p className="text-xs text-slate-500 mt-1 max-w-[240px]">&ldquo;{ld.message}&rdquo;</p>}
                    <span className={`inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${ld.source === 'PUBLIC' ? 'bg-blue-50 text-blue-600' : 'bg-violet-50 text-violet-600'}`}>{ld.source}</span>
                  </td>
                  <td className="px-4 py-3">
                    {ld.listingId ? (
                      <div>
                        <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                          <span className="line-clamp-1 max-w-[200px]">{ld.listingId.title}</span>
                          <Link href={`/property-marketplace/${ld.listingId.slug}`} target="_blank" className="text-teal-600 flex-shrink-0" aria-label="Open listing">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                        <div className="text-xs text-slate-400">
                          {ld.listingId.kind === 'RENT' ? 'Rent' : 'Sale'}{ld.listingId.pricePaise ? ` · ${money(ld.listingId.pricePaise)}` : ''}
                        </div>
                      </div>
                    ) : <span className="text-slate-400 italic text-xs">Listing removed</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {ld.societyId?.name || '—'}
                    {ld.societyId?.city && <div className="text-xs text-slate-400">{ld.societyId.city}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                    {new Date(ld.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    <div>{new Date(ld.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
