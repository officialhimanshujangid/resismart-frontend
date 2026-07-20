'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  Paper, Button, CircularProgress, Select, MenuItem, FormControl, InputLabel,
  TextField, Switch, Chip, IconButton,
} from '@mui/material';
import { Moon, UserCheck, Plus, Trash2, Save } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

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

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const toHHMM = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export default function GatePreferencesPage() {
  const { showToast } = useToastConfirm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flatIds, setFlatIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [flatId, setFlatId] = useState('');

  const [categoryMode, setCategoryMode] = useState<Record<string, string>>({});
  const [quietOn, setQuietOn] = useState(false);
  const [quietFrom, setQuietFrom] = useState('22:00');
  const [quietTo, setQuietTo] = useState('07:00');
  const [expected, setExpected] = useState<{ name: string; phone?: string; note?: string }[]>([]);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/gate/preferences');
        const d = res.data?.data || {};
        setFlatIds(d.flatIds || []);
        setCategories(d.categories || []);
        const first = (d.flatIds || [])[0] || '';
        setFlatId(first);
        apply((d.preferences || []).find((p: any) => String(p.flatId) === first));
      } catch (e: any) {
        showToast(e.response?.data?.message || 'Could not load your preferences', 'error');
      } finally { setLoading(false); }
    })();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const apply = (pref: any) => {
    setCategoryMode(pref?.categoryMode || {});
    setQuietOn(!!pref?.quietHours);
    if (pref?.quietHours) {
      setQuietFrom(toHHMM(pref.quietHours.fromMinute));
      setQuietTo(toHHMM(pref.quietHours.toMinute));
    }
    setExpected(pref?.expectedVisitors || []);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/gate/preferences', {
        flatId,
        // Blank means "no opinion", which is genuinely different from choosing
        // ASK — so empty values are stripped rather than sent as a choice.
        categoryMode: Object.fromEntries(Object.entries(categoryMode).filter(([, v]) => v)),
        quietHours: quietOn ? { fromMinute: toMinutes(quietFrom), toMinute: toMinutes(quietTo) } : null,
        expectedVisitors: expected,
      });
      showToast('Saved', 'success');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not save that', 'error');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-24"><CircularProgress /></div>;

  if (!flatIds.length) {
    return (
      <Paper elevation={0} className="rounded-2xl border border-slate-200/70 p-10 text-center">
        <p className="font-bold text-slate-700">No flat linked to you</p>
        <p className="text-sm text-slate-500 mt-1">
          Gate preferences belong to a home. Ask the society office to link your flat.
        </p>
      </Paper>
    );
  }

  return (
    <div className="space-y-4 pb-24 max-w-2xl">
      <div>
        <h1 className="text-xl font-black text-slate-900">My gate preferences</h1>
        <p className="text-sm text-slate-600 mt-1">
          These only ever ask the gate to interrupt you <b>less</b>. They cannot let
          somebody in where your society requires an approval.
        </p>
      </div>

      {flatIds.length > 1 && (
        <FormControl size="small" className="min-w-[220px]">
          <InputLabel>Which home</InputLabel>
          <Select label="Which home" value={flatId} onChange={e => setFlatId(e.target.value)}>
            {flatIds.map(id => <MenuItem key={id} value={id}>{id.slice(-6)}</MenuItem>)}
          </Select>
        </FormControl>
      )}

      <Paper elevation={0} className="rounded-2xl border border-slate-200/70 p-4 space-y-3">
        <p className="font-bold text-slate-800 text-sm">For each kind of visitor</p>
        {(categories.length ? categories : Object.keys(CATEGORY_LABEL)).map(c => (
          <div key={c} className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-700">{CATEGORY_LABEL[c] || c}</span>
            <FormControl size="small" className="min-w-[240px]">
              <Select value={categoryMode[c] || ''} displayEmpty
                onChange={e => setCategoryMode({ ...categoryMode, [c]: e.target.value })}>
                {Object.entries(MODE_LABEL).map(([v, label]) => (
                  <MenuItem key={v} value={v}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
        ))}
      </Paper>

      <Paper elevation={0} className="rounded-2xl border border-slate-200/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Moon className="w-4 h-4 text-slate-500 mt-0.5" />
            <div>
              <p className="font-bold text-slate-800 text-sm">Do not wake me</p>
              <p className="text-xs text-slate-500">
                During these hours the gate tells you instead of asking — because
                somebody asleep cannot answer, and the visitor would just wait.
              </p>
            </div>
          </div>
          <Switch checked={quietOn} onChange={e => setQuietOn(e.target.checked)} />
        </div>
        {quietOn && (
          <div className="flex gap-3 mt-3 ml-6">
            <TextField size="small" type="time" label="From" value={quietFrom}
              onChange={e => setQuietFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField size="small" type="time" label="To" value={quietTo}
              onChange={e => setQuietTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          </div>
        )}
      </Paper>

      <Paper elevation={0} className="rounded-2xl border border-slate-200/70 p-4">
        <div className="flex items-start gap-2.5">
          <UserCheck className="w-4 h-4 text-slate-500 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-slate-800 text-sm">People you expect</p>
            <p className="text-xs text-slate-500">
              Your maid, your physiotherapist, the milkman. They are let in and you
              are told — you are not asked every time.
            </p>

            <div className="flex flex-wrap gap-1.5 mt-3">
              {expected.map((v, i) => (
                <Chip key={`${v.name}-${i}`} size="small"
                  label={`${v.name}${v.phone ? ` · ${v.phone}` : ''}`}
                  onDelete={() => setExpected(expected.filter((_, j) => j !== i))}
                  deleteIcon={<Trash2 className="w-3 h-3" />}
                  className="!bg-slate-100 !font-semibold !text-[11px]" />
              ))}
              {expected.length === 0 && <span className="text-xs text-slate-400 italic">Nobody yet</span>}
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              <TextField size="small" label="Name" value={newName} onChange={e => setNewName(e.target.value)} />
              <TextField size="small" label="Phone (better)" value={newPhone}
                onChange={e => setNewPhone(e.target.value)}
                helperText="A phone matches reliably; two people share a name more often than you would think" />
              <IconButton disabled={!newName.trim()} onClick={() => {
                setExpected([...expected, { name: newName.trim(), phone: newPhone.trim() || undefined }]);
                setNewName(''); setNewPhone('');
              }}><Plus className="w-4 h-4" /></IconButton>
            </div>
          </div>
        </div>
      </Paper>

      <Button variant="contained" startIcon={<Save className="w-4 h-4" />} onClick={save} disabled={saving}
        className="!rounded-xl !normal-case !font-bold">
        {saving ? 'Saving…' : 'Save preferences'}
      </Button>
    </div>
  );
}
