'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Button, CircularProgress, Chip, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { Bell, BellOff, Check, ChevronDown } from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import { useToastConfirm } from '@/context/ToastConfirmContext';

/**
 * Everything that has been sent to you.
 *
 * The bell in the header holds thirty and has no "see all" — so anything older
 * than about a day was written, delivered and then unreachable. This is the
 * history, paged backwards through `?before=`, which the API supported from the
 * first commit and nothing ever called.
 *
 * Deliberately NOT a table. These are messages, read top to bottom, and a grid
 * of columns would make the one thing that matters — the sentence — the
 * narrowest cell on the screen.
 */

interface Item {
  _id: string;
  kind: string;
  title: string;
  body: string;
  link?: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH';
  readAt?: string;
  createdAt: string;
}

const PAGE = 40;

const dayOf = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(Date.now() - 86_400_000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return 'Today';
  if (same(d, yest)) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
};

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

export default function NotificationsPage() {
  const router = useRouter();
  const { showToast } = useToastConfirm();

  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const load = useCallback(async (before?: string) => {
    const first = !before;
    first ? setLoading(true) : setMore(true);
    try {
      const qs = new URLSearchParams({ limit: String(PAGE) });
      if (before) qs.set('before', before);
      if (filter === 'unread') qs.set('unread', 'true');
      const res = await api.get(`/notifications?${qs}`);
      const batch: Item[] = res.data?.data?.items || [];
      setUnread(res.data?.data?.unread || 0);
      // A short page means there is nothing older — the cursor is exhausted, and
      // saying so is kinder than a Load-more button that returns nothing.
      setExhausted(batch.length < PAGE);
      setItems(prev => first ? batch : [...prev, ...batch.filter(b => !prev.some(p => p._id === b._id))]);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not load your notifications', 'error');
    } finally { setLoading(false); setMore(false); }
  }, [filter, showToast]);

  useEffect(() => { load(); }, [load]);

  const markAllRead = async () => {
    setUnread(0);
    setItems(prev => prev.map(i => ({ ...i, readAt: i.readAt || new Date().toISOString() })));
    try { await api.post('/notifications/read', {}); } catch { load(); }
  };

  const open = (n: Item) => {
    if (!n.readAt) {
      setUnread(u => Math.max(0, u - 1));
      setItems(prev => prev.map(i => i._id === n._id ? { ...i, readAt: new Date().toISOString() } : i));
      api.post('/notifications/read', { ids: [n._id] }).catch(() => {});
    }
    if (n.link) router.push(n.link);
  };

  // Grouped by day as we render, rather than sorted into buckets first — the
  // list already arrives newest-first, so a running marker is enough.
  let lastDay = '';

  return (
    <div className="space-y-4 pb-24 max-w-3xl">
      <PageHeader
        title="Notifications"
        icon={<Bell className="w-4.5 h-4.5" />}
        subtitle="Everything the society has sent you — gate arrivals waiting on your answer, complaints, dues and committee decisions."
        actions={unread > 0 ? (
          <Button variant="outlined" startIcon={<Check className="w-4 h-4" />} onClick={markAllRead}
            className="!rounded-xl !normal-case !font-bold">Mark all read</Button>
        ) : undefined}
      />

      <ToggleButtonGroup size="small" exclusive value={filter}
        onChange={(_, v) => v && setFilter(v)} className="!rounded-xl">
        <ToggleButton value="all" className="!rounded-l-xl !normal-case !font-bold !text-xs !px-4">All</ToggleButton>
        <ToggleButton value="unread" className="!rounded-r-xl !normal-case !font-bold !text-xs !px-4">
          Unread{unread > 0 && <Chip size="small" label={unread} className="!ml-1.5 !h-4 !text-[10px] !bg-blue-100 !text-blue-700 !font-bold" />}
        </ToggleButton>
      </ToggleButtonGroup>

      {loading ? (
        <div className="flex justify-center py-24"><CircularProgress /></div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<BellOff className="w-6 h-6" />}
          title={filter === 'unread' ? 'Nothing unread' : 'Nothing yet'}
          message={filter === 'unread'
            ? 'You are up to date.'
            : 'Gate arrivals, complaints and anything needing your decision will appear here.'}
        />
      ) : (
        <div className="space-y-4">
          {items.map(n => {
            const day = dayOf(n.createdAt);
            const heading = day !== lastDay ? day : null;
            lastDay = day;
            return (
              <React.Fragment key={n._id}>
                {heading && (
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 pt-2">{heading}</p>
                )}
                <button onClick={() => open(n)}
                  className={`w-full text-left rounded-2xl border p-4 transition-all ${
                    n.readAt
                      ? 'bg-white border-slate-200/70 hover:border-slate-300'
                      : 'bg-blue-50/50 border-blue-200/70 hover:border-blue-300'
                  } ${n.link ? 'cursor-pointer' : 'cursor-default'}`}>
                  <div className="flex items-start gap-3">
                    <span className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${n.readAt ? 'bg-transparent' : 'bg-blue-500'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className={`text-sm ${n.readAt ? 'font-semibold text-slate-700' : 'font-black text-slate-900'}`}>
                          {n.priority === 'HIGH' && <span className="text-rose-500 mr-1">●</span>}
                          {n.title}
                        </p>
                        <span className="text-[11px] text-slate-400 shrink-0 tabular-nums">{timeOf(n.createdAt)}</span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">{n.body}</p>
                      {n.link && <p className="text-[11px] text-blue-600 font-bold mt-1.5">Open →</p>}
                    </div>
                  </div>
                </button>
              </React.Fragment>
            );
          })}

          {!exhausted && (
            <div className="flex justify-center pt-2">
              <Button variant="outlined" disabled={more}
                startIcon={more ? <CircularProgress size={14} /> : <ChevronDown className="w-4 h-4" />}
                onClick={() => load(items[items.length - 1]?.createdAt)}
                className="!rounded-xl !normal-case !font-bold">
                {more ? 'Loading…' : 'Show older'}
              </Button>
            </div>
          )}
          {exhausted && items.length > PAGE && (
            <p className="text-center text-[11px] text-slate-400 pt-2">That is everything.</p>
          )}
        </div>
      )}
    </div>
  );
}
