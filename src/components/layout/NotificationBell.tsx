'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import api, { getAccessTokenInMemory } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Popover, Badge, IconButton, CircularProgress, Button, Tooltip, Switch } from '@mui/material';
import { Bell, BellOff, Check, Wifi, WifiOff } from 'lucide-react';
import { enablePush, disablePush, pushEnabled, pushSupported, PushStatus } from '@/lib/push';

/**
 * The notification centre, and the live connection behind it.
 *
 * Two decisions worth stating, because both look like the wrong choice at first
 * glance:
 *
 * **`fetch` with a reader, not `EventSource`.** EventSource cannot set headers,
 * and this app keeps its access token in memory rather than a cookie — so the
 * only way to authenticate an EventSource would be to put a JWT in the query
 * string, where it lands in every proxy and server access log. Reading the
 * stream by hand costs about thirty lines and avoids that entirely.
 *
 * **The list is fetched even when the stream is up.** The stream only carries
 * what happened while you were watching; anything that arrived overnight, or
 * while the laptop was asleep, exists only as a record. The badge would
 * otherwise be confidently wrong every morning.
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

const ago = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export function NotificationBell() {
  const { activeContext } = useAuth();
  const router = useRouter();

  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);

  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushNote, setPushNote] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const retryRef = useRef(0);
  const stoppedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/notifications?limit=30');
      setItems(res.data?.data?.items || []);
      setUnread(res.data?.data?.unread || 0);
    } catch {
      // A failed poll is not worth a toast — the bell simply shows what it last
      // knew, and the next tick or the stream will correct it.
    } finally { setLoading(false); }
  }, []);

  // ------------------------------------------------------------- the stream
  const connect = useCallback(async () => {
    if (stoppedRef.current) return;
    const token = getAccessTokenInMemory();
    if (!token) return;

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const base = process.env.NEXT_PUBLIC_API_URL || 'https://resismart-backend.onrender.com/api/v1';
      const res = await fetch(`${base}/notifications/stream`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);

      setLive(true);
      retryRef.current = 0;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Frames are separated by a blank line. Anything after the last one is
        // a partial frame and stays in the buffer until the rest arrives —
        // dropping it is how you lose exactly the notification that was split
        // across two TCP packets.
        const frames = buffer.split('\n\n');
        buffer = frames.pop() || '';

        for (const frame of frames) {
          if (!frame.trim() || frame.startsWith(':')) continue;   // heartbeat
          const event = /^event: (.+)$/m.exec(frame)?.[1];
          const data = /^data: (.+)$/m.exec(frame)?.[1];
          if (!event || !data) continue;
          try {
            const parsed = JSON.parse(data);

            if (event === 'notification') {
              const n: Item = parsed;
              setItems(prev => prev.some(p => p._id === n._id) ? prev : [n, ...prev].slice(0, 50));
              setUnread(u => u + 1);
            }

            // Everything else is re-broadcast as a window event so any screen
            // can listen without opening a second stream of its own. The bell
            // is the only SSE connection in the app, deliberately — one
            // connection per tab, not one per page that wants live data.
            window.dispatchEvent(new CustomEvent(event, { detail: parsed }));
          } catch { /* a frame we cannot read is not worth breaking the loop for */ }
        }
      }
    } catch {
      // Falls through to the reconnect below. Includes the abort we cause
      // ourselves on unmount, which stoppedRef then short-circuits.
    } finally {
      setLive(false);
      if (!stoppedRef.current) {
        // Backing off matters: a backend restart otherwise means every open tab
        // hammering it once a second exactly when it is least able to cope.
        const wait = Math.min(30_000, 2_000 * 2 ** retryRef.current++);
        setTimeout(connect, wait);
      }
    }
  }, []);

  useEffect(() => {
    if (!activeContext) return;
    stoppedRef.current = false;
    load();
    connect();

    // The safety net for everything the stream cannot cover: a sleeping laptop,
    // a dropped connection that has not noticed yet, a phone that switched
    // networks. Cheap, and it makes the badge trustworthy.
    const poll = setInterval(load, 120_000);

    return () => {
      stoppedRef.current = true;
      clearInterval(poll);
      abortRef.current?.abort();
    };
  }, [activeContext, load, connect]);

  // Only asked when the panel opens: checking on mount would register the
  // service worker for every visitor whether or not they ever look.
  useEffect(() => {
    if (anchor) pushEnabled().then(setPushOn);
  }, [anchor]);

  const EXPLAIN: Record<PushStatus, string> = {
    ENABLED: '',
    BLOCKED: 'Your browser is blocking notifications for this site. You can allow them from the padlock in the address bar.',
    UNSUPPORTED: 'This browser cannot show notifications. Try Chrome, Edge or Firefox — or Safari 16.4 and later.',
    UNAVAILABLE: 'Notifications are not set up on this server yet.',
    DISMISSED: 'No answer given — you can try again whenever you like.',
    FAILED: 'Something went wrong turning those on. Please try again.',
  };

  const togglePush = async (want: boolean) => {
    setPushBusy(true); setPushNote('');
    try {
      if (want) {
        const status = await enablePush();
        setPushOn(status === 'ENABLED');
        setPushNote(EXPLAIN[status]);
      } else {
        await disablePush();
        setPushOn(false);
      }
    } finally { setPushBusy(false); }
  };

  const markAllRead = async () => {
    // Optimistic: the request is reliable enough that waiting to clear a badge
    // reads as lag, and a failure self-corrects on the next poll.
    setUnread(0);
    setItems(prev => prev.map(i => ({ ...i, readAt: i.readAt || new Date().toISOString() })));
    try { await api.post('/notifications/read', {}); } catch { load(); }
  };

  const open = (n: Item) => {
    setAnchor(null);
    if (!n.readAt) {
      setUnread(u => Math.max(0, u - 1));
      setItems(prev => prev.map(i => i._id === n._id ? { ...i, readAt: new Date().toISOString() } : i));
      api.post('/notifications/read', { ids: [n._id] }).catch(() => {});
    }
    if (n.link) router.push(n.link);
  };

  if (!activeContext) return null;

  return (
    <>
      <Tooltip title={live ? 'Connected — updates arrive instantly' : 'Reconnecting…'}>
        <IconButton onClick={e => setAnchor(e.currentTarget)} size="small" className="!text-slate-600">
          <Badge badgeContent={unread} color="error" max={99}
            slotProps={{ badge: { className: '!text-[10px] !font-bold !min-w-[16px] !h-4' } }}>
            <Bell className="w-5 h-5" />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { className: '!rounded-2xl !mt-2 w-[min(92vw,380px)] !shadow-xl border border-slate-200' } }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="font-black text-slate-900">Notifications</span>
            {live
              ? <Wifi className="w-3 h-3 text-emerald-500" aria-label="live" />
              : <WifiOff className="w-3 h-3 text-slate-300" aria-label="reconnecting" />}
          </div>
          {unread > 0 && (
            <Button size="small" startIcon={<Check className="w-3 h-3" />} onClick={markAllRead}
              className="!normal-case !font-bold !text-xs">
              Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10"><CircularProgress size={22} /></div>
          ) : items.length === 0 ? (
            <div className="text-center py-10 px-6">
              <BellOff className="w-7 h-7 text-slate-300 mx-auto" />
              <p className="mt-2 text-sm font-bold text-slate-700">Nothing yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Complaints, gate arrivals and anything needing your decision will land here.
              </p>
            </div>
          ) : items.map(n => (
            <button key={n._id} onClick={() => open(n)}
              className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                n.readAt ? '' : 'bg-blue-50/40'}`}>
              <div className="flex items-start gap-2">
                {!n.readAt && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm truncate ${n.readAt ? 'font-semibold text-slate-700' : 'font-bold text-slate-900'}`}>
                    {n.priority === 'HIGH' && <span className="text-red-500 mr-1">●</span>}
                    {n.title}
                  </p>
                  <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">{n.body}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{ago(n.createdAt)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {pushSupported() && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/60">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800">Notify me on this device</p>
                <p className="text-[11px] text-slate-500">
                  Reach you even when ResiSmart is closed.
                </p>
              </div>
              <Switch size="small" checked={pushOn} disabled={pushBusy}
                onChange={e => togglePush(e.target.checked)} />
            </div>
            {pushNote && <p className="text-[11px] text-amber-700 mt-2">{pushNote}</p>}
          </div>
        )}
      </Popover>
    </>
  );
}

export default NotificationBell;
