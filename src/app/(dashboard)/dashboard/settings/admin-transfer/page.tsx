'use client';

import React, { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  Paper, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel, Chip, Alert,
} from '@mui/material';
import { KeyRound, ShieldAlert, Clock, ArrowRight, TriangleAlert } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { useAuth } from '@/context/AuthContext';

/**
 * Handing over a society, and the emergency door beside it.
 *
 * The screen's main job is to be honest about what has and has not happened.
 * Every incumbent's version of this is two destructive buttons with no state in
 * between; here the pending state is the loudest thing on the page, because an
 * outgoing admin who thinks they have already handed over will stop doing the
 * job days before anyone has taken it on.
 */

interface Transfer {
  _id: string;
  fromName: string; toName: string; fromBecomes: string;
  successorKind: string; status: string; reason?: string;
  isBreakGlass: boolean; approvedByNames: string[];
  objectionDeadline?: string; objectedAt?: string; objectionNote?: string;
  expiresAt: string; acceptedAt?: string; createdAt: string;
}

const BECOMES = [
  { v: 'SOCIETY_COMMITTEE', l: 'Stays on as a committee member' },
  { v: 'RESIDENT_OWNER', l: 'Goes back to being a resident owner' },
  { v: 'RESIDENT_TENANT', l: 'Goes back to being a tenant' },
  { v: 'NONE', l: 'Leaves the society entirely' },
];

export default function AdminTransferPage() {
  const { showToast, confirm } = useToastConfirm();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState<Transfer | null>(null);
  const [past, setPast] = useState<Transfer[]>([]);
  const [busy, setBusy] = useState(false);

  const [startOpen, setStartOpen] = useState(false);
  const [form, setForm] = useState<any>({ successorKind: 'EXISTING_MEMBER', fromBecomes: 'SOCIETY_COMMITTEE' });
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin-transfer');
      setLive(res.data?.data?.current || null);
      setPast(res.data?.data?.history || []);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not load handovers', 'error');
    } finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const start = async () => {
    setBusy(true);
    try {
      const res = await api.post('/admin-transfer', form);
      showToast(res.data?.message || 'Sent', 'success');
      setStartOpen(false);
      await load();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not start that handover', 'error');
    } finally { setBusy(false); }
  };

  const requestCode = async () => {
    setBusy(true);
    try {
      const res = await api.post('/admin-transfer/send-code', {});
      setDevCode(res.data?.data?.devCode || '');
      setCodeOpen(true);
      showToast('A code has been sent.', 'success');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not send that code', 'error');
    } finally { setBusy(false); }
  };

  const acceptIt = async () => {
    setBusy(true);
    try {
      const res = await api.post('/admin-transfer/accept', { code });
      showToast(res.data?.message || 'Done', 'success');
      setCodeOpen(false); setCode('');
      await load();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not accept that', 'error');
    } finally { setBusy(false); }
  };

  const act = async (path: string, question: string) => {
    if (!(await confirm({ title: 'Are you sure?', message: question }))) return;
    setBusy(true);
    try {
      const res = await api.post(`/admin-transfer/${path}`, {});
      showToast(res.data?.message || 'Done', 'success');
      await load();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'That did not work', 'error');
    } finally { setBusy(false); }
  };

  if (loading) return <div className="flex justify-center py-24"><CircularProgress /></div>;

  const iAmSuccessor = live && user && live.toName === user.name;

  return (
    <div className="space-y-4 pb-24 max-w-2xl">
      <div>
        <h1 className="text-xl font-black text-slate-900">Handing over the admin role</h1>
        <p className="text-sm text-slate-600 mt-1">
          A society should never be one person&apos;s phone away from being stuck.
        </p>
      </div>

      {live ? (
        <Paper elevation={0} className="rounded-2xl border-2 border-amber-300 bg-amber-50/50 p-4">
          <div className="flex items-start gap-2.5">
            <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-black text-slate-900">Waiting for {live.toName}</p>
              <p className="text-sm text-slate-700 mt-1">
                {live.fromName} <ArrowRight className="w-3 h-3 inline mx-1" /> {live.toName}
              </p>
              <Alert severity="info" className="!mt-3 !rounded-xl !text-xs">
                <b>Nothing has changed yet.</b> {live.fromName} is still the admin until this is accepted.
              </Alert>
              <p className="text-[11px] text-slate-500 mt-2">
                The invitation lapses on {new Date(live.expiresAt).toLocaleDateString('en-IN')}.
                Afterwards, {BECOMES.find(b => b.v === live.fromBecomes)?.l.toLowerCase()}.
              </p>

              <div className="flex flex-wrap gap-2 mt-3">
                {iAmSuccessor ? (
                  <>
                    <Button size="small" variant="contained" disabled={busy} onClick={requestCode}
                      className="!rounded-xl !normal-case !font-bold !text-xs">Accept — send me a code</Button>
                    <Button size="small" variant="outlined" color="error" disabled={busy}
                      onClick={() => act('decline', 'Decline the admin role? The current admin stays in place.')}
                      className="!rounded-xl !normal-case !font-bold !text-xs">Decline</Button>
                  </>
                ) : (
                  <Button size="small" variant="outlined" color="error" disabled={busy}
                    onClick={() => act('cancel', 'Withdraw this handover? You remain the admin.')}
                    className="!rounded-xl !normal-case !font-bold !text-xs">Withdraw</Button>
                )}
              </div>
            </div>
          </div>
        </Paper>
      ) : (
        <Paper elevation={0} className="rounded-2xl border border-slate-200/70 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-slate-800">No handover under way</p>
              <p className="text-sm text-slate-600 mt-1">
                Name a successor and they confirm with a code sent to their own email or phone.
              </p>
            </div>
            <Button variant="contained" startIcon={<KeyRound className="w-4 h-4" />}
              onClick={() => setStartOpen(true)}
              className="!rounded-xl !normal-case !font-bold shrink-0">Hand over</Button>
          </div>
        </Paper>
      )}

      <Paper elevation={0} className="rounded-2xl border border-slate-200/70 p-4">
        <div className="flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-slate-500 mt-0.5" />
          <div>
            <p className="font-bold text-slate-800 text-sm">If the admin cannot hand over</p>
            <p className="text-xs text-slate-600 mt-1">
              When they have left, or simply stopped answering, the committee can take the role
              back — the Chairman and at least three serving members, with a written reason.
              The displaced admin is told immediately and has 72 hours to object.
            </p>
            <p className="text-[11px] text-slate-400 mt-2">
              Start this from the Committee screen, where the members who are agreeing to it can be named.
            </p>
          </div>
        </div>
      </Paper>

      {past.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">History</p>
          <div className="grid gap-2">
            {past.map(t => (
              <Paper key={t._id} elevation={0} className="rounded-2xl border border-slate-200/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate">
                      {t.fromName} <ArrowRight className="w-3 h-3 inline mx-1 text-slate-400" /> {t.toName}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {new Date(t.createdAt).toLocaleDateString('en-IN')}
                      {t.reason && ` · ${t.reason}`}
                    </p>
                    {t.isBreakGlass && (
                      <p className="text-[11px] text-amber-700 mt-1">
                        Emergency takeover, authorised by {t.approvedByNames.join(', ')}
                      </p>
                    )}
                    {t.objectedAt && (
                      <div className="flex items-start gap-1.5 mt-1.5 p-2 rounded-xl bg-red-50 border border-red-200">
                        <TriangleAlert className="w-3 h-3 text-red-600 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-red-800">
                          Disputed: {t.objectionNote || 'no reason given'} — to be settled at the next meeting.
                        </p>
                      </div>
                    )}
                  </div>
                  <Chip size="small" label={t.status.toLowerCase()}
                    className={`!font-bold !text-[11px] shrink-0 ${
                      t.status === 'ACCEPTED' ? '!bg-emerald-50 !text-emerald-700' : '!bg-slate-100 !text-slate-600'}`} />
                </div>
              </Paper>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- start */}
      <Dialog open={startOpen} onClose={() => setStartOpen(false)} fullWidth maxWidth="xs"
        slotProps={{ paper: { className: '!rounded-2xl' } }}>
        <DialogTitle className="!font-black !text-slate-900">Hand over the admin role</DialogTitle>
        <DialogContent dividers className="space-y-3">
          <TextField autoFocus fullWidth size="small" label="Their user ID"
            value={form.toUserId || ''} onChange={e => setForm({ ...form, toUserId: e.target.value })}
            helperText="From the members list. They confirm with a code sent to their own contact." />
          <FormControl fullWidth size="small">
            <InputLabel>Who are they</InputLabel>
            <Select label="Who are they" value={form.successorKind}
              onChange={e => setForm({ ...form, successorKind: e.target.value })}>
              <MenuItem value="EXISTING_MEMBER">A resident here</MenuItem>
              <MenuItem value="COMMITTEE">A committee member</MenuItem>
              <MenuItem value="EXTERNAL">An outside manager, not tied to a flat</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel>And you become</InputLabel>
            <Select label="And you become" value={form.fromBecomes}
              onChange={e => setForm({ ...form, fromBecomes: e.target.value })}>
              {BECOMES.map(b => <MenuItem key={b.v} value={b.v}>{b.l}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField fullWidth size="small" label="Why (optional)" value={form.reason || ''}
            onChange={e => setForm({ ...form, reason: e.target.value })} />
          <Alert severity="info" className="!rounded-xl !text-xs">
            Nothing changes until they accept. You stay the admin until then.
          </Alert>
        </DialogContent>
        <DialogActions className="!px-6 !py-3">
          <Button onClick={() => setStartOpen(false)} className="!normal-case !font-bold">Cancel</Button>
          <Button variant="contained" onClick={start} disabled={busy || !form.toUserId}
            className="!rounded-xl !normal-case !font-bold">Send invitation</Button>
        </DialogActions>
      </Dialog>

      {/* -------------------------------------------------------------- code */}
      <Dialog open={codeOpen} onClose={() => setCodeOpen(false)} fullWidth maxWidth="xs"
        slotProps={{ paper: { className: '!rounded-2xl' } }}>
        <DialogTitle className="!font-black !text-slate-900">Confirm the handover</DialogTitle>
        <DialogContent dividers className="space-y-3">
          <p className="text-sm text-slate-600">
            Enter the code sent to your registered contact.
          </p>
          {devCode && (
            <Alert severity="warning" className="!rounded-xl !text-xs">
              Development mode — your code is <b>{devCode}</b>
            </Alert>
          )}
          <TextField autoFocus fullWidth size="small" label="Code" value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
            slotProps={{ htmlInput: { inputMode: 'numeric', className: 'font-mono tracking-widest' } }} />
          <Alert severity="info" className="!rounded-xl !text-xs">
            You will need to sign in again afterwards to pick up your new access.
          </Alert>
        </DialogContent>
        <DialogActions className="!px-6 !py-3">
          <Button onClick={() => setCodeOpen(false)} className="!normal-case !font-bold">Cancel</Button>
          <Button variant="contained" onClick={acceptIt} disabled={busy || code.length < 4}
            className="!rounded-xl !normal-case !font-bold">Take over as admin</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
