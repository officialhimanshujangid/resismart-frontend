'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  Paper, Button, Chip, TextField, Tabs, Tab,
} from '@mui/material';
import { ShieldAlert, Check, X, Clock, PackageOpen, TriangleAlert } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { useAuth } from '@/context/AuthContext';
import PageHeader from '@/components/common/PageHeader';
import PageSkeleton from '@/components/common/PageSkeleton';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import AppDialog from '@/components/common/AppDialog';
import StatusChip from '@/components/common/StatusChip';
import useUrlState from '@/lib/use-url-state';

/**
 * Two audiences, one screen, because they are two halves of one conversation.
 *
 * A guard sees everything still waiting and can override with a reason. A
 * resident sees only what they personally were asked about — and that list
 * comes from the server, scoped by the snapshot taken when the request was
 * made, not by anything this page decides.
 */

interface Request {
  _id: string;
  visitorName: string;
  visitorPhone?: string;
  category: string;
  flatLabel?: string;
  askedVia: string;
  outcome: string;
  decidedByName?: string;
  reason?: string;
  createdAt: string;
  expiresAt: string;
}

const secondsLeft = (iso: string) => Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000));

const CATEGORY_LABEL: Record<string, string> = {
  GUEST: 'Guest', DELIVERY: 'Delivery', CAB: 'Cab',
  HOUSEHOLD_STAFF: 'Daily help', CONTRACTOR: 'Contractor', OTHER: 'Someone else',
  RESIDENT: 'Resident',
};

/**
 * Why THIS person is being asked.
 *
 * `askedVia` has been stored on every request since the module was written and
 * no screen ever showed it — which is how a resident of A-102 came to see a
 * request for A-103 with no explanation at all and reasonably concluded their
 * neighbour's visitors were leaking to them. The rule was sound; it was simply
 * never stated. A question about somebody else's front door must always say
 * why it is being put to you.
 */
const WHY_ASKED: Record<string, string> = {
  OWNER_OCCUPIED: 'You live here',
  RENTED_TENANT_ONLY: 'You are the tenant here',
  VACANT_COMMITTEE: 'This flat is empty and you are on the committee',
  NO_FLAT: 'No flat was named, so the committee was asked',
};

/**
 * The seconds ticking down, and the ONLY thing on this screen that re-renders
 * every second.
 *
 * The page used to hold a 1000ms `setTick` and declare the whole request card
 * as a function inside its own body — so React saw a brand-new component type
 * on every tick and threw away and rebuilt the entire subtree once a second,
 * losing focus and restarting every transition on a screen a guard is trying
 * to press buttons on. The countdown is the only part that changes, so it is
 * the only part that gets a timer.
 */
function Countdown({ expiresAt }: { expiresAt: string }) {
  const [left, setLeft] = useState(() => secondsLeft(expiresAt));

  useEffect(() => {
    const t = setInterval(() => setLeft(secondsLeft(expiresAt)), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  return (
    <Chip
      size="small"
      icon={<Clock className="w-3 h-3" />}
      label={left > 0 ? `${left}s` : 'time up'}
      sx={{
        bgcolor: left > 10 ? '#fffbeb' : '#fff1f2',
        color: left > 10 ? '#92400e' : '#be123c',
        '& .MuiChip-icon': { color: 'inherit' },
      }}
    />
  );
}

/**
 * One request, as a card.
 *
 * Declared at module level so its identity is stable across renders. This is
 * the fix for the remount-per-second bug, not a stylistic preference.
 */
function RequestCard({
  r, forGuard, busy, onAnswer, onOverride,
}: {
  r: Request;
  forGuard: boolean;
  busy: boolean;
  onAnswer: (r: Request, allow: boolean, leaveAtGate?: boolean) => void;
  onOverride: (r: Request) => void;
}) {
  return (
    <Paper elevation={0} className="rounded-2xl border border-slate-200/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-black text-slate-900 truncate">{r.visitorName}</p>
          <p className="text-xs text-slate-600">
            {CATEGORY_LABEL[r.category] || r.category.toLowerCase().replace(/_/g, ' ')}
            {r.flatLabel && ` · for ${r.flatLabel}`}
            {r.visitorPhone && ` · ${r.visitorPhone}`}
          </p>
          {/* Never shown before, and its absence is exactly what made a
              request about a neighbour's flat look like a leak. */}
          {!forGuard && WHY_ASKED[r.askedVia] && (
            <p className="text-[11px] text-slate-400 mt-1">
              Asked of you because: {WHY_ASKED[r.askedVia]}
            </p>
          )}
        </div>
        {r.outcome === 'PENDING'
          ? <Countdown expiresAt={r.expiresAt} />
          : <StatusChip status={r.outcome} />}
      </div>

      {r.outcome !== 'PENDING' && r.decidedByName && (
        <p className="text-[11px] text-slate-500 mt-2">
          {r.decidedByName}{r.reason && ` — "${r.reason}"`}
        </p>
      )}

      {r.outcome === 'PENDING' && (
        <div className="flex flex-wrap gap-2 mt-3">
          {!forGuard && (
            <>
              <Button size="small" variant="contained" disabled={busy}
                startIcon={<Check className="w-3.5 h-3.5" />} onClick={() => onAnswer(r, true)}>
                Let them in
              </Button>
              <Button size="small" variant="outlined" color="error" disabled={busy}
                startIcon={<X className="w-3.5 h-3.5" />} onClick={() => onAnswer(r, false)}>
                Not now
              </Button>
              <Button size="small" variant="outlined" disabled={busy}
                startIcon={<PackageOpen className="w-3.5 h-3.5" />} onClick={() => onAnswer(r, false, true)}>
                Leave it at the gate
              </Button>
            </>
          )}
          {forGuard && (
            <Button size="small" variant="outlined" color="warning" disabled={busy}
              startIcon={<TriangleAlert className="w-3.5 h-3.5" />} onClick={() => onOverride(r)}>
              Decide without waiting
            </Button>
          )}
        </div>
      )}
    </Paper>
  );
}

function VisitorApprovals() {
  const { showToast } = useToastConfirm();
  const { activeProfile } = useAuth();
  const isStaff = !!activeProfile?.role?.startsWith('SOCIETY_');

  const url = useUrlState({ show: 'waiting' });
  // The URL is the source of truth for which list is open, so a guard can keep
  // "waiting at the gate" pinned in a tab and a reload does not throw them back.
  const showMine = url.get('show') === 'mine' || !isStaff;

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [queue, setQueue] = useState<Request[]>([]);
  const [mine, setMine] = useState<Request[]>([]);
  const [overrideOf, setOverrideOf] = useState<Request | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const calls: Promise<any>[] = [api.get('/visitors/approvals/mine')];
      if (isStaff) calls.push(api.get('/visitors/approvals/pending'));
      const [mineRes, queueRes] = await Promise.all(calls);
      setMine(mineRes.data?.data || []);
      if (queueRes) setQueue(queueRes.data?.data || []);
      setFailed(false);
    } catch (e: any) {
      setFailed(true);
      showToast(e.response?.data?.message || 'Could not load who is waiting', 'error');
    } finally { setLoading(false); }
  }, [isStaff, showToast]);

  useEffect(() => {
    load();
    // Short poll: somebody is at a gate, and the SSE stream carries the answer
    // the moment it lands — this is only the safety net for a dropped stream.
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  /**
   * The live answer.
   *
   * `gate-approval` is a real event: the backend publishes it over SSE
   * (gate-approval.service `liveUpdate`) and NotificationBell re-broadcasts
   * every SSE frame as a window event of the same name, because the bell holds
   * the only stream in the tab. This listener is what makes the queue empty
   * itself the instant a resident answers, rather than up to 15s later.
   */
  useEffect(() => {
    const onDecided = () => load();
    window.addEventListener('gate-approval', onDecided);
    return () => window.removeEventListener('gate-approval', onDecided);
  }, [load]);

  const answer = useCallback(async (r: Request, allow: boolean, leaveAtGate = false) => {
    setBusy(true);
    try {
      const res = await api.post(`/visitors/approvals/${r._id}/decide`, { allow, leaveAtGate });
      showToast(res.data?.message || 'Recorded', 'success');
      await load();
    } catch (e: any) {
      // A 409 here is the interesting case: somebody else answered first, and
      // the message says who. Worth showing plainly rather than as a failure.
      showToast(e.response?.data?.message || 'Could not record that', 'error');
      await load();
    } finally { setBusy(false); }
  }, [load, showToast]);

  const doOverride = async (allow: boolean) => {
    if (!overrideOf) return;
    setBusy(true);
    try {
      await api.post(`/visitors/approvals/${overrideOf._id}/override`, { allow, reason });
      showToast('Recorded, and the flat has been told.', 'success');
      setOverrideOf(null); setReason('');
      await load();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not record that', 'error');
    } finally { setBusy(false); }
  };

  if (loading) return <PageSkeleton label="Loading who is waiting" />;

  const rows = showMine ? mine : queue;

  return (
    <div className="space-y-4 pb-24">
      <PageHeader
        breadcrumb="Visitor Management"
        title="Visitor approvals"
        icon={<ShieldAlert className="w-4.5 h-4.5" />}
        subtitle="Somebody is at the gate and the flat has been asked."
      />

      {failed ? (
        <ErrorState message="The waiting list did not load, so this page may be out of date." onRetry={load} />
      ) : (
        <>
          {isStaff && (
            <Tabs value={showMine ? 1 : 0}
              onChange={(_, v) => url.set({ show: v === 1 ? 'mine' : 'waiting' })}>
              <Tab label={`Waiting at the gate (${queue.length})`} />
              <Tab label={`Asked of me (${mine.length})`} />
            </Tabs>
          )}

          {rows.length === 0 ? (
            <EmptyState
              title="Nothing waiting"
              icon={<ShieldAlert className="w-6 h-6" />}
              message={isStaff && !showMine
                ? 'Every visitor has been answered for.'
                : 'Nobody has come to the gate for you.'}
            />
          ) : (
            <div className="grid gap-2">
              {rows.map(r => (
                <RequestCard key={r._id} r={r} forGuard={isStaff && !showMine} busy={busy}
                  onAnswer={answer} onOverride={setOverrideOf} />
              ))}
            </div>
          )}
        </>
      )}

      <AppDialog
        open={!!overrideOf}
        onClose={() => { setOverrideOf(null); setReason(''); }}
        title="Decide without waiting"
        busy={busy}
        extraActions={
          <Button color="error" onClick={() => doOverride(false)} disabled={busy}>Turn away</Button>
        }
        confirmText="Let in"
        onConfirm={() => doOverride(true)}
      >
        <p className="text-sm text-slate-600">
          {overrideOf?.flatLabel || 'The flat'} has not answered about <b>{overrideOf?.visitorName}</b>.
        </p>
        <TextField autoFocus fullWidth multiline minRows={2} label="Why?"
          value={reason} onChange={e => setReason(e.target.value)}
          helperText="This goes on the record and is sent to the flat straight away." />
      </AppDialog>
    </div>
  );
}

// `useSearchParams` needs a boundary above it or the production build refuses
// to prerender the route. See node_modules/next/dist/docs — use-search-params.
export default function GateApprovalsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <VisitorApprovals />
    </Suspense>
  );
}
