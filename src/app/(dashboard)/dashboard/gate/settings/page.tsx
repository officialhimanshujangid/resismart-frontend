'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  Paper, Button, CircularProgress, Chip, Switch, FormControlLabel, Select, MenuItem,
  FormControl, TextField, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import { Check, Info, Lock, ShieldCheck, DoorOpen, Clock, Car, Eye, Languages, LayoutGrid } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { GATE_LANGUAGES } from '@/lib/gate-i18n';

/**
 * Gate settings.
 *
 * The design point: a preset is offered first, and every individual switch is
 * offered underneath it. A twenty-flat society picks "Digital register" and
 * leaves; a large one tunes fifteen things. Neither has to meet the other's
 * screen first.
 */

interface Level { level: string; label: string; blurb: string }
interface ModuleInfo { key: string; label: string; blurb: string; pages: string[] }
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

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-slate-100 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-700">{title}</p>
        {hint && <p className="text-[11px] text-slate-500 leading-relaxed">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Paper elevation={0} className="rounded-2xl border border-slate-200/70 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2.5">
        <div className="p-1.5 rounded-lg bg-white border border-slate-200">{icon}</div>
        <p className="font-bold text-slate-800 text-sm">{title}</p>
      </div>
      <div className="px-4 py-2">{children}</div>
    </Paper>
  );
}

export default function GateSettingsPage() {
  const { showToast } = useToastConfirm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<ModuleInfo[]>([]);
  const [modules, setModules] = useState<string[]>([]);

  const load = async () => {
    try {
      const res = await api.get('/gate/policy');
      setPolicy(res.data?.data?.policy);
      setLevels(res.data?.data?.levels || []);
      setCategories(res.data?.data?.categories || []);
      setCatalog(res.data?.data?.catalog || []);
      setModules(res.data?.data?.modules || []);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not load gate settings', 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const save = async (body: any, note = 'Saved') => {
    setSaving(true);
    try {
      const res = await api.put('/gate/policy', body);
      setPolicy(res.data?.data);
      if (res.data?.data?.modules) setModules(res.data.data.modules);
      // The sidebar has to change the moment this is saved, not on the next
      // hard reload — a toggle that appears to do nothing reads as broken.
      // Same window-event pattern the finance module switches already use.
      if (body.modules) window.dispatchEvent(new Event('ops-modules-changed'));
      showToast(note, 'success');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not save', 'error');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-24"><CircularProgress /></div>;
  if (!policy) return null;

  const g = policy.gate;

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-24">
      <div>
        <h1 className="text-xl font-black text-slate-900">Gate settings</h1>
        <p className="text-sm text-slate-600 mt-1 leading-relaxed">
          Start with how much of the gate you want, then change anything underneath it.
          Every switch stays yours — the presets only set them for you the first time.
        </p>
      </div>

      {/* ------------------------------------------------------------ modules
        *
        * First on the page, because this decides whether the rest of the
        * operations screens exist at all. The API has returned this catalogue
        * since Phase 4 and nothing rendered it — which is how a society ended
        * up with Staff and Complaints built, working, and invisible.
        */}
      <Card icon={<LayoutGrid className="w-4 h-4 text-slate-600" />} title="What this society uses">
        <p className="text-[11px] text-slate-500 pt-2 pb-1 leading-relaxed">
          Switching one off only hides its screens — nothing is deleted, and turning it
          back on brings everything straight back.
        </p>
        {catalog.map(m => {
          const on = modules.includes(m.key);
          const last = on && modules.length === 1;
          return (
            <Row key={m.key} title={m.label}
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
            </Row>
          );
        })}
      </Card>

      {/* ------------------------------------------------------------ presets */}
      <Card icon={<DoorOpen className="w-4 h-4 text-slate-600" />} title="How much of the gate?">
        <div className="grid gap-2 py-2">
          {levels.map(l => (
            <button key={l.level} disabled={saving}
              onClick={() => save({ preset: l.level }, `Switched to ${l.label}`)}
              className={`text-left rounded-xl border p-3 transition ${
                g.level === l.level ? 'border-indigo-400 bg-indigo-50/60' : 'border-slate-200 hover:border-slate-300'
              }`}>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800 text-sm">{l.label}</span>
                {g.level === l.level && <Chip size="small" label="In use" className="!bg-indigo-600 !text-white !font-bold !text-[10px] !h-5" />}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{l.blurb}</p>
            </button>
          ))}
          {g.level === 'CUSTOM' && (
            <div className="rounded-xl bg-slate-100 border border-slate-200 p-3 flex items-start gap-2">
              <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600">
                You have changed some switches by hand, so this no longer matches any preset.
                Picking one above will reset those.
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* ------------------------------------------------------------ capture */}
      <Card icon={<ShieldCheck className="w-4 h-4 text-slate-600" />} title="What the guard asks for">
        <Row title="Photo" hint="Taken at the gate, kept only as long as the record below.">
          <ToggleButtonGroup exclusive size="small" value={g.capture.photo}
            onChange={(_, v) => v && save({ gate: { capture: { photo: v } } })}>
            {CAPTURE.map(c => <ToggleButton key={c.v} value={c.v} className="!normal-case !text-[11px] !font-bold !px-2">{c.label}</ToggleButton>)}
          </ToggleButtonGroup>
        </Row>
        <Row title="Phone number" hint="Left optional on purpose — a visitor turned away for refusing one has not given free consent.">
          <ToggleButtonGroup exclusive size="small" value={g.capture.phone}
            onChange={(_, v) => v && save({ gate: { capture: { phone: v } } })}>
            {CAPTURE.map(c => <ToggleButton key={c.v} value={c.v} className="!normal-case !text-[11px] !font-bold !px-2">{c.label}</ToggleButton>)}
          </ToggleButtonGroup>
        </Row>
        <Row title="ID proof" hint="Only the last four digits are ever stored. Aadhaar is not offered — a society cannot lawfully demand it.">
          <ToggleButtonGroup exclusive size="small" value={g.capture.idProof}
            onChange={(_, v) => v && save({ gate: { capture: { idProof: v } } })}>
            {CAPTURE.map(c => <ToggleButton key={c.v} value={c.v} className="!normal-case !text-[11px] !font-bold !px-2">{c.label}</ToggleButton>)}
          </ToggleButtonGroup>
        </Row>
        <div className="py-3">
          <p className="text-sm font-medium text-slate-700">Kinds of visitor you record</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {categories.map(c => {
              const on = g.capture.categoriesEnabled.includes(c);
              return (
                <Chip key={c} label={CATEGORY_LABEL[c] || c}
                  onClick={() => save({
                    gate: { capture: { categoriesEnabled: on
                      ? g.capture.categoriesEnabled.filter(x => x !== c)
                      : [...g.capture.categoriesEnabled, c] } },
                  })}
                  className={`!font-bold !text-[11px] !cursor-pointer ${on ? '!bg-indigo-600 !text-white' : '!bg-slate-100 !text-slate-500'}`} />
              );
            })}
          </div>
        </div>
      </Card>

      {/* --------------------------------------------------------------- exit */}
      <Card icon={<Clock className="w-4 h-4 text-slate-600" />} title="Departures">
        <Row title="Record when people leave" hint="Without this the gate is an arrivals register only.">
          <Switch checked={g.exit.trackExit} onChange={e => save({ gate: { exit: { trackExit: e.target.checked } } })} />
        </Row>
        {g.exit.trackExit && (
          <>
            <Row title="Tell the guard after" hint="How long past the expected stay before the console flags them.">
              <TextField size="small" type="number" value={g.exit.overstayAlertAfterMinutes}
                onChange={e => save({ gate: { exit: { overstayAlertAfterMinutes: Number(e.target.value) } } })}
                className="w-28" slotProps={{ input: { className: '!rounded-xl' }, htmlInput: { min: 5, max: 1440 } }} />
            </Row>
            <Row title="Close off the day at"
              hint="Anyone still marked inside is closed off then — and clearly labelled as assumed, never as a real departure.">
              <FormControl size="small">
                <Select value={g.exit.autoCloseAtHour} className="!rounded-xl"
                  onChange={e => save({ gate: { exit: { autoCloseAtHour: Number(e.target.value) } } })}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <MenuItem key={h} value={h}>{String(h).padStart(2, '0')}:00</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Row>
          </>
        )}
      </Card>

      {/* ----------------------------------------------------------- vehicles */}
      <Card icon={<Car className="w-4 h-4 text-slate-600" />} title="Vehicles">
        <Row title="Record vehicle numbers">
          <Switch checked={g.vehicles.track} onChange={e => save({ gate: { vehicles: { track: e.target.checked } } })} />
        </Row>
      </Card>

      {/* ---------------------------------------------------------- the guard */}
      <Card icon={<Languages className="w-4 h-4 text-slate-600" />} title="The guard's screen">
        <Row title="Language at the gate"
          hint="The gate console only. This is the one screen where English is a real barrier rather than an inconvenience — a guard who cannot read it goes back to the paper book.">
          <FormControl size="small">
            <Select value={policy.guardApp?.language || 'en'} className="!rounded-xl"
              onChange={e => save({ guardApp: { language: e.target.value } })}>
              {GATE_LANGUAGES.map(l => <MenuItem key={l.code} value={l.code}>{l.label}</MenuItem>)}
            </Select>
          </FormControl>
        </Row>
      </Card>

      {/* ------------------------------------------------------------ privacy */}
      <Card icon={<Eye className="w-4 h-4 text-slate-600" />} title="Privacy">
        <Row title="Keep records for"
          hint="Entries and their photos are deleted after this. Shorter is safer — under the DPDP Act the society, not us, is answerable for holding them.">
          <FormControl size="small">
            <Select value={policy.privacy.retentionDays} className="!rounded-xl"
              onChange={e => save({ privacy: { retentionDays: Number(e.target.value) } })}>
              {[30, 60, 90, 120, 180].map(d => <MenuItem key={d} value={d}>{d} days</MenuItem>)}
            </Select>
          </FormControl>
        </Row>
        <Row title="Log where residents come and go"
          hint="Off by default, and worth leaving off. Tracking members' own movements is the loudest complaint against apps like this.">
          <Switch checked={g.residents.logMovement}
            onChange={e => save({ gate: { residents: { logMovement: e.target.checked } } })} />
        </Row>
        <Row title="Residents see only their own flat's visitors"
          hint="Not a setting. A resident reading a neighbour's visitor log is the failure this rule exists to prevent.">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
            <Lock className="w-3.5 h-3.5" /> Always on
          </div>
        </Row>
      </Card>
    </div>
  );
}
