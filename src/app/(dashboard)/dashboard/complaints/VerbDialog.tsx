'use client';

import React, { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  TextField, FormControl, InputLabel, Select, MenuItem, Rating,
} from '@mui/material';
import AppDialog from '@/components/common/AppDialog';
import { PhotoPicker } from './Photos';
import {
  Complaint, Options, VERB_REQUEST, VerbNeed, PAUSE_LABEL, pretty,
} from './shared';

/**
 * The one place a verb asks for what it needs.
 *
 * Before this there was a single shared textarea feeding four different verbs,
 * so typing a reply and then pressing "Work is done" silently filed the reply
 * as the completion note (§IV-1.6). Each verb now opens its own question, with
 * its own words, and sends only what that verb takes.
 *
 * It is also what makes the board's drag-and-drop honest: dropping a card into
 * "Paused" cannot send anything until somebody says why, because a hold with no
 * reason is the quietest way in the product to bury a complaint.
 */

export interface VerbAsk {
  verb: string;
  complaint: Complaint;
  /** The board passes the column it was dropped on; the buttons do not. */
  label?: string;
}

const TITLES: Record<string, { title: string; subtitle: string; confirm: string }> = {
  respond: {
    title: 'Reply to the flat',
    subtitle: 'They see this. It also records that somebody has answered, which is the promise residents judge a society by.',
    confirm: 'Send the reply',
  },
  comment: {
    title: 'Add a message',
    subtitle: 'Goes to whoever is dealing with this. Everything you write here is visible to the people working on it.',
    confirm: 'Send',
  },
  note: {
    title: 'Note for the staff only',
    subtitle: 'The household never sees this. Use it for the things that would be unhelpful for them to read.',
    confirm: 'Save the note',
  },
  workDone: {
    title: 'Report the work as finished',
    subtitle: 'The flat is then asked to confirm. You cannot mark it fixed yourself — that is deliberate.',
    confirm: 'It is done',
  },
  pause: {
    title: 'Put the work on hold',
    subtitle: 'The clock stops and the household is told why. Holds are counted and capped, because a ticket held over and over is a ticket being buried.',
    confirm: 'Put on hold',
  },
  reopen: {
    title: 'It is still not fixed',
    subtitle: 'This is counted, so the committee can see how often work comes back. The clocks start again from now.',
    confirm: 'Open it again',
  },
  reject: {
    title: 'Do not take this forward',
    subtitle: 'Say why in words the person who filed it will understand — a rejection nobody understands sends them to the office door.',
    confirm: 'Reject it',
  },
  duplicate: {
    title: 'Same as another complaint',
    subtitle: 'Everybody waiting on this one is moved across, so they still hear when it is fixed.',
    confirm: 'Join them up',
  },
  assign: {
    title: 'Give it to somebody',
    subtitle: 'They are told straight away, by app and by email if they have no device.',
    confirm: 'Give it to them',
  },
  rate: {
    title: 'Was it sorted properly?',
    subtitle: 'This is what tells the committee which work is actually landing.',
    confirm: 'Send',
  },
};

export default function VerbDialog({
  ask, options, onClose, onSend,
}: {
  ask: VerbAsk | null;
  options: Options | null;
  onClose: () => void;
  /** Returns once the request has finished; throwing keeps the dialog open. */
  onSend: (verb: string, body: Record<string, unknown>) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [choice, setChoice] = useState('');
  const [photoKeys, setPhotoKeys] = useState<string[]>([]);
  const [rating, setRating] = useState(0);
  const [busy, setBusy] = useState(false);
  const [siblings, setSiblings] = useState<Complaint[]>([]);

  const need: VerbNeed = ask ? VERB_REQUEST[ask.verb]?.needs ?? null : null;

  useEffect(() => {
    setText(''); setChoice(''); setPhotoKeys([]); setRating(ask?.complaint.rating || 0);
  }, [ask]);

  /**
   * The candidates for "same as another complaint".
   *
   * Fetched only when that dialog opens. Loading every open complaint on every
   * page in case somebody merges one is exactly the kind of speculative request
   * that made nine clicks cost thirty-six of them.
   */
  const loadSiblings = useCallback(async (exceptId: string) => {
    try {
      const res = await api.get('/complaints?open=true&pageSize=100');
      setSiblings((res.data?.rows || []).filter((r: Complaint) => r._id !== exceptId));
    } catch { setSiblings([]); }
  }, []);

  useEffect(() => {
    if (ask && need === 'ticket') loadSiblings(ask.complaint._id);
  }, [ask, need, loadSiblings]);

  if (!ask) return null;

  const words = TITLES[ask.verb] || {
    title: options?.verbs?.[ask.verb] || ask.label || 'Confirm',
    subtitle: '',
    confirm: 'Do it',
  };

  const body = (): Record<string, unknown> => {
    switch (need) {
      case 'note': return { note: text.trim(), ...(photoKeys.length ? { photoKeys } : {}) };
      case 'reason': return { reason: text.trim() };
      case 'pauseReason': return { reason: choice };
      case 'staff': return { staffId: choice || null };
      case 'ticket': return { ofId: choice };
      case 'rating': return { rating, feedback: text.trim() || undefined };
      case 'level': return { level: (ask.complaint.escalationLevel ?? 0) + 1 };
      default: return {};
    }
  };

  // `workDone` is the one verb whose note is genuinely optional — a technician
  // with nothing to add should not be forced to type "done".
  const ready = (() => {
    if (need === 'note') return ask.verb === 'workDone' ? true : !!text.trim();
    if (need === 'reason') return !!text.trim();
    if (need === 'pauseReason' || need === 'ticket') return !!choice;
    if (need === 'rating') return rating > 0;
    return true;
  })();

  const submit = async () => {
    setBusy(true);
    try {
      await onSend(ask.verb, body());
      onClose();
    } finally { setBusy(false); }
  };

  return (
    <AppDialog
      open
      onClose={onClose}
      title={words.title}
      subtitle={words.subtitle || undefined}
      confirmText={words.confirm}
      confirmColor={ask.verb === 'reject' ? 'error' : ask.verb === 'pause' ? 'warning' : 'primary'}
      confirmDisabled={!ready}
      busy={busy}
      onConfirm={submit}
    >
      <div className="flex flex-col gap-3 pt-1">
        {need === 'note' && (
          <>
            <TextField autoFocus fullWidth size="small" multiline minRows={3}
              label={ask.verb === 'note' ? 'What should the staff know?' : 'What do you want to say?'}
              value={text} onChange={e => setText(e.target.value)} />
            <PhotoPicker value={photoKeys} onChange={setPhotoKeys} limit={options?.photoLimit || 6}
              label={ask.verb === 'workDone' ? 'Show the finished work' : 'Add a photo'} />
          </>
        )}

        {need === 'reason' && (
          <TextField autoFocus fullWidth size="small" multiline minRows={3}
            label={ask.verb === 'reject' ? 'Why is this not being taken forward?' : 'What is still wrong?'}
            value={text} onChange={e => setText(e.target.value)} />
        )}

        {need === 'pauseReason' && (
          <FormControl fullWidth size="small">
            <InputLabel>Why is the work stopping?</InputLabel>
            <Select label="Why is the work stopping?" value={choice}
              onChange={e => setChoice(String(e.target.value))}>
              {(options?.pauseReasons || []).map(r => (
                <MenuItem key={r} value={r}>{PAUSE_LABEL[r] || pretty(r)}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {need === 'staff' && (
          <FormControl fullWidth size="small">
            <InputLabel>Who is doing it?</InputLabel>
            <Select label="Who is doing it?" value={choice}
              onChange={e => setChoice(String(e.target.value))}>
              {(options?.staff || []).map(st => (
                <MenuItem key={st._id} value={st._id}>
                  {st.person.name} · {pretty(st.designation)}
                </MenuItem>
              ))}
              {ask.complaint.assigneeName && (
                <MenuItem value="">Take it off {ask.complaint.assigneeName}</MenuItem>
              )}
            </Select>
          </FormControl>
        )}

        {need === 'ticket' && (
          <FormControl fullWidth size="small">
            <InputLabel>Which complaint is this the same as?</InputLabel>
            <Select label="Which complaint is this the same as?" value={choice}
              onChange={e => setChoice(String(e.target.value))}>
              {siblings.map(s => (
                <MenuItem key={s._id} value={s._id}>
                  Complaint no. {s.ticketCode} — {s.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {need === 'rating' && (
          <div className="space-y-2">
            <Rating value={rating} onChange={(_, v) => setRating(v || 0)} size="large" />
            <TextField fullWidth size="small" multiline minRows={2} label="Anything to add (optional)"
              value={text} onChange={e => setText(e.target.value)} />
          </div>
        )}

        {need === 'level' && (
          <p className="text-sm text-slate-600">
            This tells the committee. Sending it up is recorded against the complaint.
          </p>
        )}

        {need === null && (
          <p className="text-sm text-slate-600">
            {ask.verb === 'resolve'
              ? 'You are confirming the problem is actually gone. Whoever did the work cannot say this — only you or the office can.'
              : ask.verb === 'close'
                ? 'Closing is final. It can still be opened again if the problem comes back.'
                : 'This is recorded against the complaint.'}
          </p>
        )}
      </div>
    </AppDialog>
  );
}
