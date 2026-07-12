'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Flag, CheckCircle2, ExternalLink, ShieldOff, AlertTriangle } from 'lucide-react';

interface Report {
  _id: string;
  reason: string;
  details?: string;
  status: string;
  source: string;
  ip?: string;
  createdAt: string;
  listingId?: { _id: string; title: string; kind: string; status: string; slug: string } | null;
}

const REASON_LABELS: Record<string, string> = {
  WRONG_INFO: 'Wrong information',
  SPAM: 'Spam / duplicate',
  SCAM: 'Scam / fraud',
  INAPPROPRIATE: 'Inappropriate',
  OTHER: 'Other',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  REVIEWED: 'bg-blue-100 text-blue-700',
  DISMISSED: 'bg-slate-100 text-slate-500',
};

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [takedownReason, setTakedownReason] = useState('');

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/marketplace/owner/reports', { params: { status: statusFilter || undefined, page, pageSize: 20 } });
      setReports(res.data.reports || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
      setTotal(res.data.pagination?.total || 0);
    } catch { setReports([]); } finally { setLoading(false); }
  }, [statusFilter, page]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const dismiss = async (id: string) => {
    setActionLoading(id + '_dismiss');
    try {
      await api.post(`/marketplace/owner/reports/${id}/dismiss`);
      setReports((prev) => prev.map((r) => r._id === id ? { ...r, status: 'DISMISSED' } : r));
    } catch { /* silent */ } finally { setActionLoading(null); }
  };

  const takedown = async (listingId: string, reportId: string) => {
    if (!takedownReason.trim()) { alert('Enter a takedown reason'); return; }
    setActionLoading(reportId + '_takedown');
    try {
      await api.post(`/marketplace/owner/listings/${listingId}/takedown`, { reason: takedownReason });
      await api.post(`/marketplace/owner/reports/${reportId}/dismiss`);
      setReports((prev) => prev.map((r) => r._id === reportId ? { ...r, status: 'DISMISSED' } : r));
      setTakedownReason('');
    } catch { /* silent */ } finally { setActionLoading(null); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Flag className="w-6 h-6 text-red-500" /> Listing Reports
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Review user-submitted reports and take moderation action.</p>
        </div>
        <span className="text-sm text-slate-500">{total} report{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['PENDING', 'DISMISSED', ''].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${statusFilter === s ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            {s === 'PENDING' ? 'Pending' : s === 'DISMISSED' ? 'Reviewed' : 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="font-semibold">No reports found</p>
          <p className="text-sm">No reports match the current filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r._id} className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] || 'bg-slate-100 text-slate-600'}`}>
                      {r.status}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700">
                      {REASON_LABELS[r.reason] || r.reason}
                    </span>
                    <span className="text-xs text-slate-400">{r.source}</span>
                  </div>

                  {r.listingId ? (
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <span className="truncate">{r.listingId.title}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${r.listingId.status === 'TAKEN_DOWN' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                        {r.listingId.status}
                      </span>
                      <Link href={`/property-marketplace/${r.listingId.slug}`} target="_blank"
                        className="text-teal-600 hover:text-teal-800 flex-shrink-0" aria-label="View listing">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 italic">Listing removed</p>
                  )}

                  {r.details && <p className="text-xs text-slate-500 mt-1">&ldquo;{r.details}&rdquo;</p>}
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {r.ip && <span className="ml-2">IP: {r.ip}</span>}
                  </p>
                </div>

                {/* Actions */}
                {r.status === 'PENDING' && (
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => dismiss(r._id)}
                      disabled={actionLoading === r._id + '_dismiss'}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {actionLoading === r._id + '_dismiss' ? 'Dismissing…' : 'Dismiss'}
                    </button>

                    {r.listingId && r.listingId.status !== 'TAKEN_DOWN' && (
                      <div className="flex gap-1">
                        <input
                          value={takedownReason}
                          onChange={(e) => setTakedownReason(e.target.value)}
                          placeholder="Reason…"
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1 outline-none w-24"
                        />
                        <button
                          onClick={() => takedown(r.listingId!._id, r._id)}
                          disabled={!!actionLoading}
                          className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
                          title="Take down listing"
                        >
                          <ShieldOff className="w-3 h-3" />
                          Takedown
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
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

      {/* Legend */}
      <div className="flex items-center gap-2 text-xs text-slate-400 p-3 bg-amber-50 rounded-xl border border-amber-200">
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
        Taking down a listing removes it from public view and notifies the listing author by email.
      </div>
    </div>
  );
}
