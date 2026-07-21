'use client';

import React, { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  Paper, Button, CircularProgress, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Tabs, Tab,
} from '@mui/material';
import { ShieldAlert, Check, X, Clock, PackageOpen, TriangleAlert } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { useAuth } from '@/context/AuthContext';

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

export default function GateApprovalsPage() {
  const { showToast } = useToastConfirm();
  const { activeProfile } = useAuth();
  const isStaff = !!activeProfile?.role?.startsWith('SOCIETY_');

  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<Request[]>([]);
  const [mine, setMine] = useState<Request[]>([]);
  const [overrideOf, setOverrideOf] = useState<Request | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  // Purely so the countdown re-renders; the deadline itself lives on the row.
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const calls: Promise<any>[] = [api.get('/gate/approvals/mine')];
      if (isStaff) calls.push(api.get('/gate/approvals/pending'));
      const [mineRes, queueRes] = await Promise.all(calls);
      setMine(mineRes.data?.data || []);
      if (queueRes) setQueue(queueRes.data?.data || []);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not load approvals', 'error');
    } finally { setLoading(false); }
  }, [isStaff, showToast]);

  useEffect(() => {
    load();
    // Short poll: somebody is at a gate, and the SSE stream carries the answer
    // the moment it lands — this is only the safety net for a dropped stream.
    const t = setInterval(load, 15_000);
    const s = setInterval(() => setTick(n => n + 1), 1000);
    return () => { clearInterval(t); clearInterval(s); };
  }, [load]);

  // The stream the backend publishes on when anyone decides.
  useEffect(() => {
    const onDecided = () => load();
    window.addEventListener('gate-approval', onDecided);
    return () => window.removeEventListener('gate-approval', onDecided);
  }, [load]);

  const answer = async (r: Request, allow: boolean, leaveAtGate = false) => {
    setBusy(true);
    try {
      const res = await api.post(`/gate/approvals/${r._id}/decide`, { allow, leaveAtGate });
      showToast(res.data?.message || 'Recorded', 'success');
      await load();
    } catch (e: any) {
      // A 409 here is the interesting case: somebody else answered first, and
      // the message says who. Worth showing plainly rather than as a failure.
      showToast(e.response?.data?.message || 'Could not record that', 'error');
      await load();
    } finally { setBusy(false); }
  };

  const doOverride = async (allow: boolean) => {
    if (!overrideOf) return;
    setBusy(true);
    try {
      await api.post(`/gate/approvals/${overrideOf._id}/override`, { allow, reason });
      showToast('Recorded, and the flat has been told.', 'success');
      setOverrideOf(null); setReason('');
      await load();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not record that', 'error');
    } finally { setBusy(false); }
  };

  if (loading) return <div className="flex justify-center py-24"><CircularProgress /></div>;

  const Card = ({ r, forGuard }: { r: Request; forGuard: boolean }) => {
    const left = secondsLeft(r.expiresAt);
    return (
      <Paper elevation={0} className="rounded-2xl border border-slate-200/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-black text-slate-900 truncate">{r.visitorName}</p>
            <p className="text-xs text-slate-600">
              {r.category.toLowerCase().replace(/_/g, ' ')}
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
          {r.outcome === 'PENDING' ? (
            <Chip size="small" icon={<Clock className="w-3 h-3" />} label={left > 0 ? `${left}s` : 'time up'}
              className={`!font-bold !text-[11px] ${left > 10 ? '!bg-amber-50 !text-amber-800' : '!bg-red-50 !text-red-700'}`} />
          ) : (
            <Chip size="small" label={r.outcome.toLowerCase().replace(/_/g, ' ')}
              className="!font-bold !text-[11px] !bg-slate-100 !text-slate-600" />
          )}
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
                  startIcon={<Check className="w-3.5 h-3.5" />} onClick={() => answer(r, true)}
                  className="!rounded-xl !normal-case !font-bold !text-xs">Let them in</Button>
                <Button size="small" variant="outlined" color="error" disabled={busy}
                  startIcon={<X className="w-3.5 h-3.5" />} onClick={() => answer(r, false)}
                  className="!rounded-xl !normal-case !font-bold !text-xs">Not now</Button>
                <Button size="small" variant="outlined" disabled={busy}
                  startIcon={<PackageOpen className="w-3.5 h-3.5" />} onClick={() => answer(r, false, true)}
                  className="!rounded-xl !normal-case !font-bold !text-xs">Leave at gate</Button>
              </>
            )}
            {forGuard && (
              <Button size="small" variant="outlined" color="warning" disabled={busy}
                startIcon={<TriangleAlert className="w-3.5 h-3.5" />} onClick={() => setOverrideOf(r)}
                className="!rounded-xl !normal-case !font-bold !text-xs">
                Decide without waiting
              </Button>
            )}
          </div>
        )}
      </Paper>
    );
  };

  return (
    <div className="space-y-4 pb-24">
      <div>
        <h1 className="text-xl font-black text-slate-900">Gate approvals</h1>
        <p className="text-sm text-slate-600 mt-1">
          Somebody is at the gate and the flat has been asked.
        </p>
      </div>

      {isStaff && (
        <Tabs value={tab} onChange={(_, v) => setTab(v)} className="border-b border-slate-200">
          <Tab label={`Waiting at the gate (${queue.length})`} className="!normal-case !font-bold" />
          <Tab label={`Asked of me (${mine.length})`} className="!normal-case !font-bold" />
        </Tabs>
      )}

      {(isStaff && tab === 0 ? queue : mine).length === 0 ? (
        <Paper elevation={0} className="rounded-2xl border border-slate-200/70 p-10 text-center">
          <ShieldAlert className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="mt-3 font-bold text-slate-700">Nothing waiting</p>
          <p className="text-sm text-slate-500 mt-1">
            {isStaff && tab === 0
              ? 'Every visitor has been answered for.'
              : 'Nobody has come to the gate for you.'}
          </p>
        </Paper>
      ) : (
        <div className="grid gap-2">
          {(isStaff && tab === 0 ? queue : mine).map(r => (
            <Card key={r._id} r={r} forGuard={isStaff && tab === 0} />
          ))}
        </div>
      )}

      <Dialog open={!!overrideOf} onClose={() => setOverrideOf(null)} fullWidth maxWidth="xs"
        slotProps={{ paper: { className: '!rounded-2xl' } }}>
        <DialogTitle className="!font-black !text-slate-900">Decide without waiting</DialogTitle>
        <DialogContent dividers className="space-y-3">
          <p className="text-sm text-slate-600">
            {overrideOf?.flatLabel || 'The flat'} has not answered about <b>{overrideOf?.visitorName}</b>.
          </p>
          <TextField autoFocus fullWidth multiline minRows={2} size="small" label="Why?"
            value={reason} onChange={e => setReason(e.target.value)}
            helperText="This goes on the record and is sent to the flat straight away." />
        </DialogContent>
        <DialogActions className="!px-6 !py-3">
          <Button onClick={() => setOverrideOf(null)} className="!normal-case !font-bold">Cancel</Button>
          <Button color="error" onClick={() => doOverride(false)} disabled={busy}
            className="!normal-case !font-bold">Turn away</Button>
          <Button variant="contained" onClick={() => doOverride(true)} disabled={busy}
            className="!rounded-xl !normal-case !font-bold">Let in</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
