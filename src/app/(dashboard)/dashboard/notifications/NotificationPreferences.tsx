'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { Button, Switch, TextField, CircularProgress } from '@mui/material';
import { BellRing, Mail, Moon, Save, Smartphone, VolumeX } from 'lucide-react';
import { SettingsCard, SettingRow } from '@/components/common/SettingsCard';
import ErrorState from '@/components/common/ErrorState';
import { useToastConfirm } from '@/context/ToastConfirmContext';

/**
 * What this person wants to be told about, and when.
 *
 * Written to make the ONE exception obvious rather than to bury it: nothing on
 * this screen can silence a HIGH-priority message, because a HIGH-priority
 * message means somebody is standing at your gate waiting for an answer. A
 * resident who mutes "visitors", then misses their guest, and only afterwards
 * discovers the switch never applied to that case would stop trusting every
 * other switch on the page. So the page says it up front, in the subtitle, and
 * again next to the quiet hours.
 *
 * The topic list is whatever this person has actually been sent — not a
 * hardcoded catalogue. A fixed list goes stale the week a module is added, and
 * a resident staring at switches for things their society does not use assumes
 * the screen is broken.
 */

interface Preference {
  mutedKinds: string[];
  channels: { inApp: boolean; push: boolean; email: boolean };
  quietHours?: { fromMinute: number; toMinute: number } | null;
  timezone: string;
}

/**
 * Plain society language for the kinds we know about.
 *
 * Anything not listed falls back to a prettified version of the code, which is
 * ugly but honest — far better than hiding a topic the resident is genuinely
 * receiving and therefore cannot switch off.
 */
const KIND_LABEL: Record<string, string> = {
  GATE_APPROVAL: 'Somebody at the gate wanting your approval',
  GATE_ENTRY: 'Visitors who arrived for your flat',
  GATE_OVERSTAY: 'Visitors who have not left yet',
  GATE_OVERRIDE: 'The guard letting somebody in without asking',
  GATE_PASS_OVERUSE: 'A visitor pass used more than once',
  GATE_VACANT_FLAT: 'Somebody arriving for an empty flat',
  COMPLAINT_ASSIGNED: 'Your complaint given to somebody to fix',
  COMPLAINT_COMMENT: 'Replies on your complaint',
  COMPLAINT_WORK_DONE: 'Work reported done on your complaint',
  COMPLAINT_CLOSED: 'Your complaint closed',
  COMPLAINT_REOPENED: 'A complaint reopened',
  COMPLAINT_PAUSED: 'A complaint put on hold',
  COMPLAINT_ESCALATED: 'A complaint that has run past its promise',
  COMPLAINT_CONDUCT_RAISED: 'Conduct matters',
  AMC_EXPIRING: 'Lift, pump and equipment contracts running out',
  STAFF_VERIFICATION_EXPIRING: 'Staff police verification running out',
  OPENING_DUES: 'Opening dues and account setup',
  ADMIN: 'Society administration',
};

const prettify = (kind: string) =>
  kind.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase());

/** Topics that are never actually silenced, so the switch would be a lie. */
const ALWAYS_HIGH = new Set(['GATE_APPROVAL']);

const toHHMM = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

interface Draft {
  muted: string[];
  inApp: boolean;
  push: boolean;
  email: boolean;
  quietOn: boolean;
  quietFrom: string;
  quietTo: string;
}

const toDraft = (p?: Preference): Draft => ({
  muted: p?.mutedKinds || [],
  // `?? true` and never `||`: a stored `false` is exactly what the resident
  // asked for, and `||` would flip every opt-out back on as the page loads.
  inApp: p?.channels?.inApp ?? true,
  push: p?.channels?.push ?? true,
  email: p?.channels?.email ?? true,
  quietOn: !!p?.quietHours,
  quietFrom: p?.quietHours ? toHHMM(p.quietHours.fromMinute) : '22:00',
  quietTo: p?.quietHours ? toHHMM(p.quietHours.toMinute) : '07:00',
});

export default function NotificationPreferences() {
  const { showToast } = useToastConfirm();

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [kinds, setKinds] = useState<string[]>([]);
  const [saved, setSaved] = useState<Draft>(toDraft());
  const [draft, setDraft] = useState<Draft>(toDraft());

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await api.get('/notifications/preferences');
      const d = res.data?.data || {};
      const next = toDraft(d.preference);
      setKinds(d.kinds || []);
      setSaved(next);
      setDraft(next);
    } catch (e: any) {
      setFailed(true);
      showToast(e.response?.data?.message || 'Could not load your notification settings', 'error');
    } finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);

  const toggleKind = (kind: string) => setDraft(d => ({
    ...d,
    muted: d.muted.includes(kind) ? d.muted.filter(k => k !== kind) : [...d.muted, kind],
  }));

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/notifications/preferences', {
        mutedKinds: draft.muted,
        channels: { inApp: draft.inApp, push: draft.push, email: draft.email },
        // null CLEARS the window. Sending nothing would leave the old one in
        // place, so switching quiet hours off would appear to work and then
        // keep holding messages back all night.
        quietHours: draft.quietOn
          ? { fromMinute: toMinutes(draft.quietFrom), toMinute: toMinutes(draft.quietTo) }
          : null,
        // The browser's own zone, so a resident who moves cities does not have
        // to think about why their quiet hours drifted.
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
      });
      setSaved(draft);
      showToast('Your notification settings are saved', 'success');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not save that', 'error');
    } finally { setSaving(false); }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><CircularProgress size={22} /></div>;
  }
  if (failed) {
    return <ErrorState message="Your notification settings did not load." onRetry={load} />;
  }

  const sameTime = draft.quietOn && draft.quietFrom === draft.quietTo;

  return (
    <div className="space-y-4">
      <SettingsCard
        icon={<BellRing className="w-4 h-4 text-slate-600" />}
        title="How you are reached"
        description="Turn off a way of reaching you and it stops being used. Switching off the notification list means nothing is kept here for you to come back to — so leave it on unless you are sure."
      >
        <SettingRow
          title="This notification list"
          hint="The messages on this page. Anything urgent from the gate is always kept here, whatever this says."
        >
          <Switch checked={draft.inApp} onChange={e => setDraft(d => ({ ...d, inApp: e.target.checked }))} />
        </SettingRow>
        <SettingRow
          title="Phone and browser alerts"
          hint="A pop-up on your phone or laptop. Needs this device to be registered first."
        >
          <Switch checked={draft.push} onChange={e => setDraft(d => ({ ...d, push: e.target.checked }))} />
        </SettingRow>
        <SettingRow
          title="Email"
          hint="Only sent when you have no phone or browser registered at all — never as a second copy of something you already received."
        >
          <Switch checked={draft.email} onChange={e => setDraft(d => ({ ...d, email: e.target.checked }))} />
        </SettingRow>
      </SettingsCard>

      <SettingsCard
        icon={<Moon className="w-4 h-4 text-slate-600" />}
        title="Do not disturb"
        description="Messages that arrive during these hours are still saved here — your phone simply stays quiet until the morning. Somebody waiting at the gate still gets through."
      >
        <SettingRow title="Quiet hours" hint="Set in your own local time.">
          <Switch checked={draft.quietOn} onChange={e => setDraft(d => ({ ...d, quietOn: e.target.checked }))} />
        </SettingRow>
        {draft.quietOn && (
          <div className="flex flex-wrap gap-3 py-3">
            <TextField type="time" label="From" value={draft.quietFrom}
              onChange={e => setDraft(d => ({ ...d, quietFrom: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }} />
            <TextField type="time" label="Until" value={draft.quietTo}
              onChange={e => setDraft(d => ({ ...d, quietTo: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
              error={sameTime}
              helperText={sameTime ? 'Choose two different times' : undefined} />
          </div>
        )}
      </SettingsCard>

      <SettingsCard
        icon={<VolumeX className="w-4 h-4 text-slate-600" />}
        title="Topics you would rather not hear about"
        description="These are the topics the society has actually sent you. Switch one off and it stops arriving altogether."
      >
        {kinds.length === 0 ? (
          <p className="py-4 text-xs text-slate-500">
            Nothing has been sent to you yet. Topics appear here once you start receiving messages.
          </p>
        ) : kinds.map(kind => {
          const urgent = ALWAYS_HIGH.has(kind);
          return (
            <SettingRow
              key={kind}
              title={KIND_LABEL[kind] || prettify(kind)}
              disabled={urgent}
              hint={urgent
                ? 'Cannot be switched off — somebody is standing at the gate waiting for your answer.'
                : undefined}
            >
              <Switch
                checked={urgent || !draft.muted.includes(kind)}
                disabled={urgent}
                onChange={() => toggleKind(kind)}
              />
            </SettingRow>
          );
        })}
      </SettingsCard>

      <div className="flex items-center gap-3">
        <Button variant="contained" startIcon={<Save className="w-4 h-4" />}
          onClick={save} disabled={saving || !dirty || sameTime}>
          {saving ? 'Saving…' : dirty ? 'Save settings' : 'Saved'}
        </Button>
        {!draft.push && (
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Smartphone className="w-3.5 h-3.5" /> Your phone will stay silent, including for the gate.
          </span>
        )}
        {!draft.email && !draft.push && (
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Mail className="w-3.5 h-3.5" /> Nothing will reach you outside this page.
          </span>
        )}
      </div>
    </div>
  );
}
