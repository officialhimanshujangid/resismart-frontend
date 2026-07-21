'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import {
  Chip, Switch, Select, MenuItem, FormControl, TextField, Button,
  ToggleButton, ToggleButtonGroup, ButtonBase, Alert,
} from '@mui/material';
import {
  Info, Lock, ShieldCheck, DoorOpen, Clock, Car, Eye, Languages, LayoutGrid,
  Users, AlertTriangle, Settings2,
} from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { GATE_LANGUAGES } from '@/lib/gate-i18n';
import PageHeader from '@/components/common/PageHeader';
import PageSkeleton from '@/components/common/PageSkeleton';
import ErrorState from '@/components/common/ErrorState';
import { SettingsCard, SettingRow } from '@/components/common/SettingsCard';

/**
 * Operations settings.
 *
 * One name, everywhere. This screen used to be called "Operations Settings" in
 * the sidebar, "Gate settings" in its own heading and "Operations settings" in
 * the setup checklist — three names for one page, which is how a committee
 * member ends up hunting for a fourth screen that does not exist. It governs
 * every operations module, not just visitors, so Operations settings is the
 * accurate one.
 *
 * The design point: a preset is offered first, and every individual switch is
 * offered underneath it. A twenty-flat society picks "Digital register" and
 * leaves; a large one tunes fifteen things. Neither has to meet the other's
 * screen first.
 */

interface Level { level: string; label: string; blurb: string }
interface ModuleInfo { key: string; label: string; blurb: string; pages: string[]; settingsHref?: string }
interface Policy {
  gate: {
    level: string;
    capture: { photo: string; phone: string; idProof: string; categoriesEnabled: string[] };
    exit: { trackExit: boolean; mode: string; overstayAlertAfterMinutes: number; autoCloseAtHour: number; autoCloseNotifyCommittee: boolean };
    vehicles: { track: boolean; trackExit: boolean; residentRegistry: boolean };
    residents: { logMovement: boolean; logVehicleOnly: boolean };
  };
  privacy: { retentionDays: number; residentSeesOwnFlatOnly: boolean };
  guardApp: { language: string; offlineQueueEnabled: boolean };
}

const CAPTURE = [
  { v: 'OFF', label: 'Do not ask' },
  { v: 'OPTIONAL', label: 'Ask, may skip' },
  { v: 'REQUIRED', label: 'Must have' },
];

const CATEGORY_LABEL: Record<string, string> = {
  GUEST: 'Guest', DELIVERY: 'Delivery', CAB: 'Cab',
  HOUSEHOLD_STAFF: 'Daily help', CONTRACTOR: 'Contractor', OTHER: 'Other',
};

/** Merges a partial policy patch the way the API does, for the optimistic step. */
const merge = <T,>(base: T, patch: any): T => {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch as T;
  const out: any = { ...base };
  Object.entries(patch).forEach(([k, v]) => {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(out[k] ?? {}, v) : v;
  });
  return out;
};

/**
 * One of a small set of mutually exclusive choices, as a card rather than a
 * radio — because each one needs a paragraph explaining what it costs.
 *
 * Colour comes from the theme's primary, not from a hardcoded indigo. The old
 * `!bg-indigo-600` was a fourth blue on a page that already had three.
 */
function ChoiceCard({
  selected, disabled, title, blurb, onClick,
}: {
  selected: boolean; disabled?: boolean; title: string; blurb: string; onClick: () => void;
}) {
  return (
    <ButtonBase
      disabled={disabled}
      onClick={onClick}
      sx={{
        display: 'block', width: '100%', textAlign: 'left', p: 1.5, borderRadius: 3,
        border: '1px solid',
        borderColor: selected ? 'primary.main' : '#e2e8f0',
        bgcolor: selected ? 'rgba(10, 91, 215, 0.06)' : 'transparent',
        '&:hover': { borderColor: selected ? 'primary.main' : '#cbd5e1' },
      }}
    >
      <div className="flex items-center gap-2">
        <span className="font-bold text-slate-800 text-sm">{title}</span>
        {selected && <Chip size="small" color="primary" label="In use" />}
      </div>
      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{blurb}</p>
    </ButtonBase>
  );
}

export default function OperationsSettingsPage() {
  const { showToast } = useToastConfirm();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<ModuleInfo[]>([]);
  const [modules, setModules] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await api.get('/visitors/policy');
      setPolicy(res.data?.data?.policy);
      setLevels(res.data?.data?.levels || []);
      setCategories(res.data?.data?.categories || []);
      setCatalog(res.data?.data?.catalog || []);
      setModules(res.data?.data?.modules || []);
    } catch (e: any) {
      setFailed(true);
      showToast(e.response?.data?.message || 'Could not load operations settings', 'error');
    } finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  /**
   * Save, and put the switch back if the server said no.
   *
   * Every control here is controlled by `policy`, so a failed request used to
   * leave the flipped switch sitting in the DOM with nothing to re-render it —
   * the screen said the setting was on and the server had it off, with only a
   * toast that scrolls away to say otherwise. Applying the change locally
   * first and restoring the snapshot on failure fixes both halves: instant
   * feedback when it works, a visible snap-back when it does not.
   *
   * `preset` is deliberately excluded from the optimistic step — it rewrites
   * a dozen unrelated switches and only the server knows to what.
   */
  const save = async (body: any, note = 'Saved') => {
    const previousPolicy = policy;
    const previousModules = modules;
    if (!body.preset && policy) setPolicy(p => (p ? merge(p, body) : p));
    if (body.modules) setModules(body.modules);

    setSaving(true);
    try {
      const res = await api.put('/visitors/policy', body);
      setPolicy(res.data?.data);
      if (res.data?.data?.modules) setModules(res.data.data.modules);
      // The sidebar has to change the moment this is saved, not on the next
      // hard reload — a toggle that appears to do nothing reads as broken.
      // Same window-event pattern the finance module switches already use.
      if (body.modules) window.dispatchEvent(new Event('ops-modules-changed'));
      showToast(note, 'success');
    } catch (e: any) {
      setPolicy(previousPolicy);
      setModules(previousModules);
      showToast(
        e.response?.data?.message || 'That did not save, so nothing has changed. Try again.',
        'error',
      );
    } finally { setSaving(false); }
  };

  if (loading) return <PageSkeleton label="Loading operations settings" />;
  if (failed || !policy) {
    return (
      <ErrorState
        message="Operations settings did not load, so nothing on this page can be changed yet."
        onRetry={load}
      />
    );
  }

  const g = policy.gate;

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-24">
      <PageHeader
        breadcrumb="Operations"
        title="Operations settings"
        icon={<Settings2 className="w-4.5 h-4.5" />}
        subtitle="Start with how much of the gate you want, then change anything underneath it. Every switch stays yours — the presets only set them for you the first time."
      />

      {/* ------------------------------------------------------------ modules
        *
        * First on the page, because this decides whether the rest of the
        * operations screens exist at all. The API has returned this catalogue
        * since Phase 4 and nothing rendered it — which is how a society ended
        * up with Staff and Complaints built, working, and invisible.
        */}
      <SettingsCard
        icon={<LayoutGrid className="w-4 h-4 text-slate-600" />}
        title="What this society uses"
        description="Switching one off only hides its screens — nothing is deleted, and turning it back on brings everything straight back."
      >
        {catalog.map(m => {
          const on = modules.includes(m.key);
          const last = on && modules.length === 1;

          /**
           * A module that owns its own on/off decision is a LINK, never a switch.
           *
           * Parking is the case: switching it on also creates the charge head
           * residents are billed through, and switching it off deactivates it.
           * A plain toggle here would hide the screens and leave every flat
           * still being billed for parking nobody can see. The server refuses
           * the shortcut too — this is the courteous half of the same rule.
           */
          if (m.settingsHref) {
            return (
              <SettingRow key={m.key} title={m.label} hint={m.blurb}>
                <Button component={Link} href={m.settingsHref} size="small" variant="outlined">
                  {on ? 'Set up' : 'Switch on'}
                </Button>
              </SettingRow>
            );
          }

          return (
            <SettingRow key={m.key} title={m.label} disabled={last}
              hint={last ? 'The last one on — a society needs at least one.' : m.blurb}>
              <Switch checked={on} disabled={saving || last}
                onChange={e => save(
                  {
                    modules: e.target.checked
                      ? [...modules, m.key]
                      : modules.filter(k => k !== m.key),
                  },
                  e.target.checked ? `${m.label} switched on` : `${m.label} hidden`,
                )} />
            </SettingRow>
          );
        })}
      </SettingsCard>

      {/* ------------------------------------------------------------ presets */}
      <SettingsCard icon={<DoorOpen className="w-4 h-4 text-slate-600" />} title="How much of the gate?">
        <div className="grid gap-2 py-2">
          {levels.map(l => (
            <ChoiceCard key={l.level} selected={g.level === l.level} disabled={saving}
              title={l.label} blurb={l.blurb}
              onClick={() => save({ preset: l.level }, `Switched to ${l.label}`)} />
          ))}
          {g.level === 'CUSTOM' && (
            <Alert severity="info" icon={<Info className="w-4 h-4" />} className="rounded-2xl">
              You have changed some switches by hand, so this no longer matches any preset.
              Picking one above will reset those.
            </Alert>
          )}
        </div>
      </SettingsCard>

      {/* ------------------------------------------------- entry only vs both
        *
        * Placed directly under the preset and asked as a question rather than
        * offered as a switch called "trackExit", because it is the single
        * decision that shapes every other screen in the module: an
        * arrivals-only society has no overstay, no reconciliation, no exit
        * gate and no "who is inside" worth the name. A small society
        * genuinely does want only arrivals, and burying that three cards down
        * under a technical label meant nobody ever found it.
        */}
      <SettingsCard icon={<DoorOpen className="w-4 h-4 text-slate-600" />} title="Do you record people leaving?">
        <div className="grid sm:grid-cols-2 gap-2 py-3">
          {[
            {
              on: false, title: 'Arrivals only',
              blurb: 'The gate writes down who came in. Nobody has to remember to mark them out, and the register is never wrong about who is still inside — because it never claims to know.',
            },
            {
              on: true, title: 'Arrivals and departures',
              blurb: 'Both are recorded, so the desk can answer "who is inside right now", flag a visitor who has stayed far longer than expected, and close off the day\'s stragglers at night.',
            },
          ].map(o => (
            <ChoiceCard key={String(o.on)} selected={g.exit.trackExit === o.on} disabled={saving}
              title={o.title} blurb={o.blurb}
              onClick={() => save({ gate: { exit: { trackExit: o.on } } },
                o.on ? 'Departures will be recorded' : 'Arrivals only')} />
          ))}
        </div>
      </SettingsCard>

      {/* ------------------------------------------- residents' own movement
        *
        * Its own card, worded as a question, and OFF unless a society says
        * otherwise. This is not decoration: with it off the software has no
        * way to write a resident movement at all — the entry endpoint refuses
        * the category — so a committee that leaves it alone has a guarantee
        * rather than a promise.
        */}
      <SettingsCard icon={<Users className="w-4 h-4 text-slate-600" />} title="Do you record residents coming and going?">
        <div className="py-3 space-y-2">
          <Alert severity="warning" icon={<AlertTriangle className="w-4 h-4" />} className="rounded-2xl">
            Think carefully before switching this on. Recording when members leave home and when
            they return is surveillance of the people who own this building, and it is the loudest
            complaint made against apps like this one. Most societies should leave it off — and while
            it is off, the software will not accept a resident movement even if somebody tries.
          </Alert>
          <SettingRow title="Record residents' own entry and exit"
            hint="Off by default. Nothing else on this page changes what the gate does for residents.">
            <Switch checked={g.residents.logMovement} disabled={saving}
              onChange={e => save(
                { gate: { residents: { logMovement: e.target.checked } } },
                e.target.checked ? 'Resident movement will be recorded' : 'Residents are no longer recorded',
              )} />
          </SettingRow>
          {g.residents.logMovement && (
            <SettingRow title="Only the vehicle, never the person"
              hint="Records that a registered car came in, tied to its flat — no name is stored at all. The usual reason a society wants this is parking, and this is the least intrusive way to get it."
            >
              <Switch checked={g.residents.logVehicleOnly} disabled={saving}
                onChange={e => save({ gate: { residents: { logVehicleOnly: e.target.checked } } })} />
            </SettingRow>
          )}
        </div>
      </SettingsCard>

      {/* ------------------------------------------------------------ capture */}
      <SettingsCard icon={<ShieldCheck className="w-4 h-4 text-slate-600" />} title="What the guard asks for">
        <CaptureRow title="Photo" hint="Taken at the gate, kept only as long as the record below."
          value={g.capture.photo} disabled={saving}
          onChange={v => save({ gate: { capture: { photo: v } } })} />
        <CaptureRow title="Phone number"
          hint="Left optional on purpose — a visitor turned away for refusing one has not given free consent."
          value={g.capture.phone} disabled={saving}
          onChange={v => save({ gate: { capture: { phone: v } } })} />
        <CaptureRow title="ID proof"
          hint="Only the last four digits are ever stored. Aadhaar is not offered — a society cannot lawfully demand it."
          value={g.capture.idProof} disabled={saving}
          onChange={v => save({ gate: { capture: { idProof: v } } })} />
        <div className="py-3">
          <p className="text-sm font-medium text-slate-700">Kinds of visitor you record</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {categories.map(c => {
              const on = g.capture.categoriesEnabled.includes(c);
              return (
                <Chip key={c} label={CATEGORY_LABEL[c] || c} clickable
                  color={on ? 'primary' : 'default'}
                  variant={on ? 'filled' : 'outlined'}
                  onClick={() => save({
                    gate: { capture: { categoriesEnabled: on
                      ? g.capture.categoriesEnabled.filter(x => x !== c)
                      : [...g.capture.categoriesEnabled, c] } },
                  })} />
              );
            })}
          </div>
        </div>
      </SettingsCard>

      {/* --------------------------------------------------------------- exit */}
      <SettingsCard icon={<Clock className="w-4 h-4 text-slate-600" />} title="Departures">
        {!g.exit.trackExit ? (
          <p className="text-[11px] text-slate-500 py-3 leading-relaxed">
            Nothing to set here while the gate records arrivals only. Choose
            &ldquo;Arrivals and departures&rdquo; above to use overstay alerts and the end-of-day close-off.
          </p>
        ) : (
          <>
            <SettingRow title="Tell the guard after" hint="How long past the expected stay before the desk flags them.">
              <TextField type="number" value={g.exit.overstayAlertAfterMinutes} disabled={saving}
                onChange={e => save({ gate: { exit: { overstayAlertAfterMinutes: Number(e.target.value) } } })}
                className="w-28" slotProps={{ htmlInput: { min: 5, max: 1440 } }} />
            </SettingRow>
            <SettingRow title="Close off the day at"
              hint="Anyone still marked inside is closed off then — and clearly labelled as assumed, never as a real departure.">
              <FormControl>
                <Select value={g.exit.autoCloseAtHour} disabled={saving}
                  onChange={e => save({ gate: { exit: { autoCloseAtHour: Number(e.target.value) } } })}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <MenuItem key={h} value={h}>{String(h).padStart(2, '0')}:00</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </SettingRow>
          </>
        )}
      </SettingsCard>

      {/* ----------------------------------------------------------- vehicles */}
      <SettingsCard icon={<Car className="w-4 h-4 text-slate-600" />} title="Vehicles">
        <SettingRow title="Record vehicle numbers">
          <Switch checked={g.vehicles.track} disabled={saving}
            onChange={e => save({ gate: { vehicles: { track: e.target.checked } } })} />
        </SettingRow>
      </SettingsCard>

      {/* ---------------------------------------------------------- the guard */}
      <SettingsCard icon={<Languages className="w-4 h-4 text-slate-600" />} title="The guard's screen">
        <SettingRow title="Language at the gate"
          hint="The gate desk only. This is the one screen where English is a real barrier rather than an inconvenience — a guard who cannot read it goes back to the paper book.">
          <FormControl>
            <Select value={policy.guardApp?.language || 'en'} disabled={saving}
              onChange={e => save({ guardApp: { language: e.target.value } })}>
              {GATE_LANGUAGES.map(l => <MenuItem key={l.code} value={l.code}>{l.label}</MenuItem>)}
            </Select>
          </FormControl>
        </SettingRow>
      </SettingsCard>

      {/* ------------------------------------------------------------ privacy */}
      <SettingsCard icon={<Eye className="w-4 h-4 text-slate-600" />} title="Privacy">
        <SettingRow title="Keep records for"
          hint="Entries and their photos are deleted after this. Shorter is safer — under the DPDP Act the society, not us, is answerable for holding them.">
          <FormControl>
            <Select value={policy.privacy.retentionDays} disabled={saving}
              onChange={e => save({ privacy: { retentionDays: Number(e.target.value) } })}>
              {[30, 60, 90, 120, 180].map(d => <MenuItem key={d} value={d}>{d} days</MenuItem>)}
            </Select>
          </FormControl>
        </SettingRow>
        <SettingRow title="Residents see only their own flat's visitors"
          hint="Not a setting. A resident reading a neighbour's visitor log is the failure this rule exists to prevent.">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
            <Lock className="w-3.5 h-3.5" /> Always on
          </div>
        </SettingRow>
      </SettingsCard>
    </div>
  );
}

/** The three-way OFF / OPTIONAL / REQUIRED question, asked three times. */
function CaptureRow({
  title, hint, value, disabled, onChange,
}: {
  title: string; hint: string; value: string; disabled: boolean; onChange: (v: string) => void;
}) {
  return (
    <SettingRow title={title} hint={hint}>
      <ToggleButtonGroup exclusive size="small" value={value} disabled={disabled}
        onChange={(_, v) => v && onChange(v)}>
        {CAPTURE.map(c => (
          <ToggleButton key={c.v} value={c.v} sx={{ px: 1, fontSize: '11px', fontWeight: 700 }}>
            {c.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </SettingRow>
  );
}
