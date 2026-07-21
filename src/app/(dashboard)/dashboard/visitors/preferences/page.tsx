'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import {
  Button, Select, MenuItem, FormControl, InputLabel, TextField, Switch, Chip, IconButton,
} from '@mui/material';
import { Moon, UserCheck, Plus, Trash2, Save, SlidersHorizontal, Users } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { useAuth } from '@/context/AuthContext';
import PageHeader from '@/components/common/PageHeader';
import PageSkeleton from '@/components/common/PageSkeleton';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import { SettingsCard, SettingRow } from '@/components/common/SettingsCard';
import useUrlState from '@/lib/use-url-state';

/**
 * What one resident wants their own gate to do.
 *
 * Written to make the ceiling obvious rather than to hide it: every option
 * here reduces interruption, and the page says so. A resident who expects this
 * screen to let them wave people in and then discovers the guard still asks
 * would trust nothing else on it.
 */

const CATEGORY_LABEL: Record<string, string> = {
  GUEST: 'Guests', DELIVERY: 'Deliveries', CAB: 'Cabs',
  HOUSEHOLD_STAFF: 'Household staff', CONTRACTOR: 'Contractors', OTHER: 'Anyone else',
};

const MODE_LABEL: Record<string, string> = {
  '': 'Whatever the society decides',
  ASK: 'Ask me',
  NOTIFY_ONLY: 'Just tell me, do not ask',
  LEAVE_AT_GATE: 'Leave it at the gate',
};

interface ExpectedVisitor { name: string; phone?: string; note?: string }
interface Pref {
  flatId?: string;
  categoryMode?: Record<string, string>;
  quietHours?: { fromMinute: number; toMinute: number } | null;
  expectedVisitors?: ExpectedVisitor[];
}

/** The editable shape of one flat's settings, so two flats can be compared. */
interface Draft {
  categoryMode: Record<string, string>;
  quietOn: boolean;
  quietFrom: string;
  quietTo: string;
  expected: ExpectedVisitor[];
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const toHHMM = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

const toDraft = (pref?: Pref): Draft => ({
  categoryMode: pref?.categoryMode || {},
  quietOn: !!pref?.quietHours,
  quietFrom: pref?.quietHours ? toHHMM(pref.quietHours.fromMinute) : '22:00',
  quietTo: pref?.quietHours ? toHHMM(pref.quietHours.toMinute) : '07:00',
  expected: pref?.expectedVisitors || [],
});

function GatePreferences() {
  const { showToast, confirm } = useToastConfirm();
  const { availableContexts } = useAuth();
  const url = useUrlState({ flat: '' });

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flatIds, setFlatIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  /**
   * Every flat's saved settings, keyed by flat.
   *
   * Previously only ONE flat's settings were ever read into the form — the
   * first — and changing the dropdown changed nothing but the id that Save
   * would post to. So a resident with two homes opened the page, switched to
   * the second flat, pressed Save, and silently overwrote flat B's settings
   * with flat A's. Holding the whole set means switching is a lookup, and
   * there is no window in which the form and the flat disagree.
   */
  const [saved, setSaved] = useState<Record<string, Draft>>({});
  const [draft, setDraft] = useState<Draft>(toDraft());

  const flatId = url.get('flat') || flatIds[0] || '';

  /** The flat's real name, from the workspaces this user can switch between. */
  const flatLabel = useCallback((id: string) => {
    const home = availableContexts.find(c => c.unitId === id);
    // Never the ObjectId. A resident reading "…8f2a91" learns nothing and
    // reasonably assumes the screen is broken.
    return home?.unitLabel || `Home ${flatIds.indexOf(id) + 1}`;
  }, [availableContexts, flatIds]);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await api.get('/visitors/preferences');
      const d = res.data?.data || {};
      const ids: string[] = d.flatIds || [];
      setFlatIds(ids);
      setCategories(d.categories || []);
      const byFlat: Record<string, Draft> = {};
      ids.forEach(id => {
        byFlat[id] = toDraft((d.preferences || []).find((p: Pref) => String(p.flatId) === id));
      });
      setSaved(byFlat);
    } catch (e: any) {
      setFailed(true);
      showToast(e.response?.data?.message || 'Could not load your gate settings', 'error');
    } finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  // The form follows the flat, always. This is the effect whose absence was
  // the bug: `apply()` used to run once, on mount, and never again.
  useEffect(() => {
    if (flatId && saved[flatId]) setDraft(saved[flatId]);
  }, [flatId, saved]);

  const dirty = useMemo(
    () => !!flatId && !!saved[flatId] && JSON.stringify(draft) !== JSON.stringify(saved[flatId]),
    [draft, saved, flatId],
  );

  const switchFlat = async (next: string) => {
    if (next === flatId) return;
    // Changing home throws away whatever is unsaved. Say so rather than doing it.
    if (dirty && !(await confirm({
      title: `Leave ${flatLabel(flatId)} without saving?`,
      message: 'The changes you made here have not been saved yet. They will be lost.',
      confirmText: 'Switch anyway',
      cancelText: 'Stay here',
      severity: 'warning',
    }))) return;
    url.set({ flat: next });
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/visitors/preferences', {
        flatId,
        // Blank means "no opinion", which is genuinely different from choosing
        // ASK — so empty values are stripped rather than sent as a choice.
        categoryMode: Object.fromEntries(Object.entries(draft.categoryMode).filter(([, v]) => v)),
        quietHours: draft.quietOn
          ? { fromMinute: toMinutes(draft.quietFrom), toMinute: toMinutes(draft.quietTo) }
          : null,
        expectedVisitors: draft.expected,
      });
      setSaved(prev => ({ ...prev, [flatId]: draft }));
      showToast(`Saved for ${flatLabel(flatId)}`, 'success');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not save that', 'error');
    } finally { setSaving(false); }
  };

  if (loading) return <PageSkeleton label="Loading your gate settings" />;
  if (failed) return <ErrorState message="Your gate settings did not load." onRetry={load} />;

  if (!flatIds.length) {
    return (
      <EmptyState
        title="No flat linked to you"
        icon={<Users className="w-6 h-6" />}
        message="Gate settings belong to a home. Ask the society office to link your flat, then these options appear here."
      />
    );
  }

  return (
    <div className="space-y-4 pb-24 max-w-2xl">
      <PageHeader
        breadcrumb="Visitor Management"
        title="My gate settings"
        icon={<SlidersHorizontal className="w-4.5 h-4.5" />}
        subtitle="These only ever ask the gate to interrupt you less. They cannot let somebody in where your society requires an approval."
        actions={flatIds.length > 1 ? (
          <FormControl className="min-w-[200px]">
            <InputLabel>Which home</InputLabel>
            <Select label="Which home" value={flatId} onChange={e => switchFlat(e.target.value)}>
              {flatIds.map(id => <MenuItem key={id} value={id}>{flatLabel(id)}</MenuItem>)}
            </Select>
          </FormControl>
        ) : undefined}
      />

      <SettingsCard
        title="For each kind of visitor"
        description="What the gate should do when this sort of person turns up for your home."
      >
        {(categories.length ? categories : Object.keys(CATEGORY_LABEL)).map(c => (
          <SettingRow key={c} title={CATEGORY_LABEL[c] || c}>
            <FormControl className="min-w-[240px]">
              <Select value={draft.categoryMode[c] || ''} displayEmpty
                onChange={e => setDraft(d => ({ ...d, categoryMode: { ...d.categoryMode, [c]: e.target.value } }))}>
                {Object.entries(MODE_LABEL).map(([v, label]) => (
                  <MenuItem key={v} value={v}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </SettingRow>
        ))}
      </SettingsCard>

      <SettingsCard icon={<Moon className="w-4 h-4 text-slate-600" />} title="Do not wake me">
        <SettingRow
          title="Quiet hours"
          hint="During these hours the gate tells you instead of asking — because somebody asleep cannot answer, and the visitor would just wait."
        >
          <Switch checked={draft.quietOn}
            onChange={e => setDraft(d => ({ ...d, quietOn: e.target.checked }))} />
        </SettingRow>
        {draft.quietOn && (
          <div className="flex gap-3 py-3">
            <TextField type="time" label="From" value={draft.quietFrom}
              onChange={e => setDraft(d => ({ ...d, quietFrom: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }} />
            <TextField type="time" label="To" value={draft.quietTo}
              onChange={e => setDraft(d => ({ ...d, quietTo: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }} />
          </div>
        )}
      </SettingsCard>

      <SettingsCard
        icon={<UserCheck className="w-4 h-4 text-slate-600" />}
        title="People you expect"
        description="Your maid, your physiotherapist, the milkman. They are let in and you are told — you are not asked every time."
      >
        <div className="flex flex-wrap gap-1.5 py-3">
          {draft.expected.map((v, i) => (
            <Chip key={`${v.name}-${i}`} size="small"
              label={`${v.name}${v.phone ? ` · ${v.phone}` : ''}`}
              onDelete={() => setDraft(d => ({ ...d, expected: d.expected.filter((_, j) => j !== i) }))}
              deleteIcon={<Trash2 className="w-3 h-3" />} />
          ))}
          {draft.expected.length === 0 && <span className="text-xs text-slate-400 italic">Nobody yet</span>}
        </div>
        <ExpectedVisitorAdder onAdd={v => setDraft(d => ({ ...d, expected: [...d.expected, v] }))} />
      </SettingsCard>

      <Button variant="contained" startIcon={<Save className="w-4 h-4" />} onClick={save}
        disabled={saving || !dirty}>
        {saving ? 'Saving…' : dirty ? `Save for ${flatLabel(flatId)}` : 'Saved'}
      </Button>
    </div>
  );
}

/** Its own component so typing a name does not re-render the whole settings page. */
function ExpectedVisitorAdder({ onAdd }: { onAdd: (v: ExpectedVisitor) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  return (
    <div className="flex flex-wrap items-start gap-2 pb-3">
      <TextField label="Name" value={name} onChange={e => setName(e.target.value)} />
      <TextField label="Phone (better)" value={phone} onChange={e => setPhone(e.target.value)}
        helperText="A phone matches reliably; two people share a name more often than you would think" />
      <IconButton disabled={!name.trim()} aria-label="Add"
        onClick={() => { onAdd({ name: name.trim(), phone: phone.trim() || undefined }); setName(''); setPhone(''); }}>
        <Plus className="w-4 h-4" />
      </IconButton>
    </div>
  );
}

// `useSearchParams` needs a boundary above it or the production build refuses
// to prerender the route. See node_modules/next/dist/docs — use-search-params.
export default function GatePreferencesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <GatePreferences />
    </Suspense>
  );
}
