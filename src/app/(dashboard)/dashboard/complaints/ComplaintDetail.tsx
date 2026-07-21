'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button, Chip, CircularProgress, TextField, ToggleButton, ToggleButtonGroup, Paper,
} from '@mui/material';
import {
  AlertTriangle, Check, Clock, Lock, MessageSquare, PauseCircle, PlayCircle,
  RefreshCw, Send, ShieldAlert, Star, Users, Wrench, XCircle, CornerUpRight, Copy,
} from 'lucide-react';
import api from '@/lib/api';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import StatusChip from '@/components/common/StatusChip';
import ErrorState from '@/components/common/ErrorState';
import { PhotoGallery, PhotoPicker } from './Photos';
import VerbDialog, { VerbAsk } from './VerbDialog';
import {
  Detail, Options, VERB_REQUEST, PAUSE_LABEL, ESCALATION_RUNG,
  ago, when, pretty, sendVerb, refusal,
} from './shared';

/**
 * One complaint, in full — the same body whether it is opened as a page or
 * glanced at from the list.
 *
 * Two rules run through everything below:
 *
 *   **The server decides which buttons exist.** `detail.can` is the exact list
 *   of verbs the server will accept from this viewer on this ticket right now,
 *   computed from the same table the services enforce. Nothing here adds a
 *   condition of its own — that is precisely how a resident came to be shown
 *   Reply, Put on hold and Work is done, every one of which 403'd.
 *
 *   **There are three channels, and they are named.** A message from the
 *   household, a reply from the staff, and a note the household never sees. The
 *   old screen had one textarea feeding four verbs, so a reply typed and then
 *   sent with "Work is done" became the completion note by accident.
 */

/** Verbs that are their own composer, so they are not also drawn as buttons. */
const COMPOSER_VERBS = ['comment', 'respond', 'note'];

const VERB_ICON: Record<string, React.ReactNode> = {
  workDone: <Wrench className="w-3.5 h-3.5" />,
  resolve: <Check className="w-3.5 h-3.5" />,
  close: <Lock className="w-3.5 h-3.5" />,
  reopen: <RefreshCw className="w-3.5 h-3.5" />,
  pause: <PauseCircle className="w-3.5 h-3.5" />,
  resume: <PlayCircle className="w-3.5 h-3.5" />,
  reject: <XCircle className="w-3.5 h-3.5" />,
  duplicate: <Copy className="w-3.5 h-3.5" />,
  assign: <Users className="w-3.5 h-3.5" />,
  escalate: <CornerUpRight className="w-3.5 h-3.5" />,
  meToo: <Users className="w-3.5 h-3.5" />,
  rate: <Star className="w-3.5 h-3.5" />,
};

/** The two that finish a complaint get the filled button; the rest are outlines. */
const PROMINENT = ['resolve', 'workDone'];

/**
 * What the timeline calls each thing that happened.
 *
 * Appendix A rule 2 — never show an internal value. `pretty('WORK_DONE')` gives
 * "Work done", which is close enough to read but wrong in tone for a resident
 * being asked to confirm something.
 */
const EVENT_LABEL: Record<string, string> = {
  RAISED: 'Reported',
  ASSIGNED: 'Given to somebody',
  REASSIGNED: 'Passed on',
  RESPONDED: 'Reply from the society',
  COMMENT: 'Message',
  NOTE: 'Staff note',
  PAUSED: 'Put on hold',
  RESUMED: 'Work started again',
  WORK_DONE: 'Work reported finished',
  RESOLVED: 'Confirmed fixed',
  CLOSED: 'Closed',
  REOPENED: 'Opened again',
  REJECTED: 'Not taken forward',
  ESCALATED: 'Sent up',
  ME_TOO: 'Somebody else has the same problem',
  RATED: 'Rated',
};

export default function ComplaintDetail({
  id, options, onChanged,
}: {
  id: string;
  options: Options | null;
  /** So the list, the board and the statistics behind them can catch up. */
  onChanged?: () => void;
}) {
  const { showToast } = useToastConfirm();
  const [data, setData] = useState<Detail | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [ask, setAsk] = useState<VerbAsk | null>(null);

  // The composer, which is deliberately not shared with anything else.
  const [channel, setChannel] = useState<string>('');
  const [message, setMessage] = useState('');
  const [messagePhotos, setMessagePhotos] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  // Bumped after anything that could add a photograph, so the gallery refetches
  // its signed links rather than showing a stale set.
  const [photoEpoch, setPhotoEpoch] = useState(0);

  const load = useCallback(async () => {
    setFailed(null);
    try {
      const res = await api.get(`/complaints/${id}`);
      setData(res.data?.data || null);
    } catch (e: unknown) {
      setData(null);
      setFailed(refusal(e, 'That complaint could not be opened'));
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const c = data?.complaint;
  const can = useMemo(() => data?.can || [], [data]);

  /** Which message boxes this viewer actually has. */
  const channels = useMemo(() => COMPOSER_VERBS.filter(v => can.includes(v)), [can]);
  useEffect(() => {
    setChannel(prev => (channels.includes(prev) ? prev : channels[0] || ''));
  }, [channels]);

  const run = async (verb: string, body: Record<string, unknown> = {}) => {
    try {
      const done = await sendVerb(id, verb, body);
      showToast(done, 'success');
      await load();
      setPhotoEpoch(e => e + 1);
      onChanged?.();
    } catch (e: unknown) {
      // The server writes better refusals than we do — "You reported the work
      // as done; the flat confirms it is fixed, not you" explains a design
      // decision, where "Could not do that" reads as a fault in the software.
      showToast(refusal(e), 'error');
      throw e;
    }
  };

  const send = async () => {
    if (!message.trim() || !channel) return;
    setSending(true);
    try {
      await run(channel, { note: message.trim(), ...(messagePhotos.length ? { photoKeys: messagePhotos } : {}) });
      setMessage(''); setMessagePhotos([]);
    } catch { /* the toast has already said why; the text stays so it is not lost */ }
    finally { setSending(false); }
  };

  if (failed) {
    return <ErrorState title="This complaint could not be opened"
      message={failed}
      hint="If you were sent a link to somebody else's complaint, you will not be able to open it."
      onRetry={load} />;
  }
  if (!data || !c) return <div className="flex justify-center py-16"><CircularProgress size={28} /></div>;

  const buttons = can.filter(v => !COMPOSER_VERBS.includes(v) && VERB_REQUEST[v]);

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------ where it stands */}
      <div className="flex items-center gap-2 flex-wrap">
        <StatusChip status={c.status} />
        {c.kind === 'CONDUCT' && (
          <Chip size="small" icon={<ShieldAlert className="w-3 h-3" />} label="About someone's behaviour"
            sx={{ bgcolor: 'error.light', color: 'error.contrastText' }} />
        )}
        {c.priority === 'EMERGENCY' && (
          <Chip size="small" label="Emergency" color="error" />
        )}
        {c.pausedAt && (
          <Chip size="small" icon={<PauseCircle className="w-3 h-3" />}
            label={PAUSE_LABEL[c.pauseReason || ''] || 'Paused'}
            sx={{ bgcolor: 'warning.light', color: 'warning.contrastText' }} />
        )}
        {c.reopenCount > 0 && (
          <Chip size="small" icon={<RefreshCw className="w-3 h-3" />} label={`Opened again ${c.reopenCount}×`}
            sx={{ bgcolor: 'error.light', color: 'error.contrastText' }} />
        )}
        {(c.assigneeName || c.assigneeVendorName)
          ? <span className="text-xs text-slate-500">with {c.assigneeName || c.assigneeVendorName}</span>
          : <span className="text-xs font-bold text-rose-600">nobody assigned yet</span>}
      </div>

      {c.description && <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{c.description}</p>}

      <PhotoGallery complaintId={id} reloadKey={photoEpoch} />

      {/* --------------------------------------------------------------- the clocks */}
      {!['RESOLVED', 'CLOSED', 'REJECTED'].includes(c.status) && (c.firstResponseDueAt || c.resolutionDueAt) && (
        <Paper elevation={0} className="rounded-xl border border-slate-200 p-3 space-y-1">
          {c.firstResponseDueAt && !c.firstRespondedAt && (
            <p className="text-xs text-slate-600 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              First reply by <strong>{when(c.firstResponseDueAt)}</strong>
            </p>
          )}
          {c.resolutionDueAt && (
            <p className="text-xs text-slate-600 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Fix by <strong>{when(c.resolutionDueAt)}</strong>
              {c.pausedAt && ' — the clock is stopped while this is on hold'}
            </p>
          )}
          {options?.workingHours && (
            <p className="text-[11px] text-slate-400">{options.workingHours}</p>
          )}
          {(c.escalationLevel ?? 0) > 0 && (
            <p className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {ESCALATION_RUNG[c.escalationLevel ?? 0] || `Sent up to level ${c.escalationLevel}`}
            </p>
          )}
        </Paper>
      )}

      {c.status === 'REJECTED' && c.rejectionReason && (
        <Paper elevation={0} className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs text-slate-600"><strong>Not taken forward:</strong> {c.rejectionReason}</p>
        </Paper>
      )}

      {/* ------------------------------------------------------------- what happened */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">What has happened</p>
        <div className="space-y-2.5">
          {data.events.map(e => (
            <div key={e._id} className="flex gap-2.5">
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${e.isInternal ? 'bg-amber-400' : 'bg-slate-300'}`} />
              <div className="min-w-0">
                <p className="text-xs text-slate-700">
                  <span className="font-semibold">{EVENT_LABEL[e.type] || pretty(e.type)}</span>
                  {/* The only place the internal channel is visible at all, and
                      only to somebody the server already decided may read it —
                      residents never receive these events in the first place. */}
                  {e.isInternal && (
                    <Chip size="small" label="Staff only" className="ml-1.5"
                      sx={{ height: 16, fontSize: 10, bgcolor: 'warning.light', color: 'warning.contrastText' }} />
                  )}
                  {e.note && <span className="text-slate-600"> — {e.note}</span>}
                </p>
                <p className="text-[10px] text-slate-400">{e.byName} · {ago(e.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---------------------------------------------------------------- composer */}
      {channels.length > 0 && (
        <Paper elevation={0} className="rounded-xl border border-slate-200 p-3 space-y-2">
          {channels.length > 1 && (
            <ToggleButtonGroup exclusive size="small" value={channel}
              onChange={(_, v) => v && setChannel(v)}>
              {channels.map(v => (
                <ToggleButton key={v} value={v} sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}>
                  {v === 'respond' ? 'Reply to the flat' : v === 'note' ? 'Staff only' : 'Add a message'}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}
          <TextField fullWidth size="small" multiline minRows={2}
            placeholder={channel === 'note'
              ? 'The household never sees this…'
              : channel === 'respond'
                ? 'The household sees this, and it records that somebody answered…'
                : 'Ask a question, or tell them something useful…'}
            value={message} onChange={e => setMessage(e.target.value)} />
          <PhotoPicker value={messagePhotos} onChange={setMessagePhotos}
            limit={options?.photoLimit || 6} />
          <div className="flex justify-between items-center gap-2">
            <p className="text-[11px] text-slate-400">
              {channel === 'note'
                ? 'Kept between the staff and the committee.'
                : 'Everyone working on this complaint can see it.'}
            </p>
            <Button size="small" variant="contained" startIcon={<Send className="w-3.5 h-3.5" />}
              disabled={sending || !message.trim()} onClick={send}>
              {sending ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </Paper>
      )}

      {/* ----------------------------------------------------------------- the verbs */}
      {buttons.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {buttons.map(v => (
            <Button key={v} size="small"
              variant={PROMINENT.includes(v) ? 'contained' : 'outlined'}
              color={v === 'reject' ? 'error' : v === 'pause' ? 'warning' : 'primary'}
              startIcon={VERB_ICON[v]}
              // Everything goes through the dialog, including the verbs that
              // need no input: `resolve` and `close` are the two that feel
              // irreversible, and a mis-tap on a phone should not finish
              // somebody else's complaint without a sentence in between.
              onClick={() => setAsk({ verb: v, complaint: c })}>
              {v === 'escalate'
                ? (ESCALATION_RUNG[(c.escalationLevel ?? 0) + 1] || options?.verbs?.[v] || 'Send it up')
                : options?.verbs?.[v] || pretty(v)}
            </Button>
          ))}
        </div>
      )}

      {c.status === 'WORK_DONE' && data.viewerIs?.isResident && (
        <p className="text-[11px] text-slate-500">
          Only you can say it is actually fixed — whoever did the work cannot close it.
        </p>
      )}

      {typeof c.rating === 'number' && (
        <p className="text-[11px] text-slate-500">Rated {c.rating} out of 5{c.feedback ? ` — “${c.feedback}”` : ''}.</p>
      )}

      <VerbDialog ask={ask} options={options} onClose={() => setAsk(null)}
        onSend={(verb, body) => run(verb, body)} />
    </div>
  );
}
