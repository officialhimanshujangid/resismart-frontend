'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  Paper, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel, Switch, Chip,
} from '@mui/material';
import { Plus, Tag, Clock, Zap } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

/**
 * The categories a society complains about, and the promises attached to them.
 *
 * This screen exists because there was no way to reach these fields. Every
 * category's SLA was writable on the model and had no writer — so a society was
 * frozen with the thirteen seeded rows forever. A committee that wanted garden
 * complaints answered in a week rather than a fortnight had no lever. This is
 * the lever.
 */

const WORK_CATEGORIES = [
  'PLUMBING', 'ELECTRICAL', 'LIFT', 'CLEANING', 'SECURITY', 'GARDEN', 'CARPENTRY', 'OTHER',
];

interface Category {
  _id: string;
  category: string;
  subCategory?: string;
  workCategory: string;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  isEmergency: boolean;
  isActive: boolean;
  sortOrder: number;
}

// Minutes are how the model stores an SLA, but nobody thinks in "1440 minutes".
const fromMinutes = (m: number) => {
  if (m % 1440 === 0) return { value: m / 1440, unit: 'days' };
  if (m % 60 === 0) return { value: m / 60, unit: 'hours' };
  return { value: m, unit: 'minutes' };
};
const toMinutes = (value: number, unit: string) =>
  unit === 'days' ? value * 1440 : unit === 'hours' ? value * 60 : value;
const prettySla = (m: number) => {
  const { value, unit } = fromMinutes(m);
  return `${value} ${value === 1 ? unit.replace(/s$/, '') : unit}`;
};

export default function ComplaintCategoriesPage() {
  const { showToast } = useToastConfirm();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Partial<Category> | null>(null);
  const [saving, setSaving] = useState(false);

  // Held separately so the day/hour toggles are ergonomic.
  const [respVal, setRespVal] = useState(4); const [respUnit, setRespUnit] = useState('hours');
  const [resVal, setResVal] = useState(2); const [resUnit, setResUnit] = useState('days');

  const load = async () => {
    try {
      const res = await api.get('/complaints/categories');
      setRows(res.data?.data || []);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not load categories', 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openEdit = (c?: Category) => {
    setEditing(c || { category: '', workCategory: 'OTHER', isEmergency: false, isActive: true });
    const resp = fromMinutes(c?.firstResponseMinutes ?? 240);
    const reso = fromMinutes(c?.resolutionMinutes ?? 2880);
    setRespVal(resp.value); setRespUnit(resp.unit);
    setResVal(reso.value); setResUnit(reso.unit);
  };

  const save = async () => {
    if (!editing?.category?.trim()) return showToast('Give the category a name', 'error');
    setSaving(true);
    try {
      const body = {
        category: editing.category,
        subCategory: editing.subCategory || undefined,
        workCategory: editing.workCategory,
        firstResponseMinutes: toMinutes(respVal, respUnit),
        resolutionMinutes: toMinutes(resVal, resUnit),
        isEmergency: !!editing.isEmergency,
        isActive: editing.isActive !== false,
      };
      if (editing._id) await api.put(`/complaints/categories/${editing._id}`, body);
      else await api.post('/complaints/categories', body);
      showToast('Saved', 'success');
      setEditing(null);
      await load();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not save that', 'error');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-24"><CircularProgress /></div>;

  return (
    <div className="space-y-4 pb-24 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">Complaint categories</h1>
          <p className="text-sm text-slate-600 mt-1">
            What people can report, which trade it goes to, and how fast you promise to answer.
          </p>
        </div>
        <Button variant="contained" startIcon={<Plus className="w-4 h-4" />} onClick={() => openEdit()}
          className="!rounded-xl !normal-case !font-bold shrink-0">Add category</Button>
      </div>

      <div className="grid gap-2">
        {rows.map(c => (
          <Paper key={c._id} elevation={0}
            className={`rounded-2xl border p-3 cursor-pointer hover:border-slate-300 ${c.isActive ? 'border-slate-200/70' : 'border-slate-200/70 opacity-60'}`}
            onClick={() => openEdit(c)}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                <Tag className="w-4 h-4 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 truncate">
                  {c.category}{c.subCategory && <span className="text-slate-500 font-normal"> — {c.subCategory}</span>}
                  {c.isEmergency && <Zap className="w-3.5 h-3.5 text-red-500 inline ml-1.5" />}
                  {!c.isActive && <Chip size="small" label="off" className="!ml-1.5 !h-4 !text-[9px] !bg-slate-200" />}
                </p>
                <p className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                  <span>→ {c.workCategory.toLowerCase()}</span>
                  <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> reply {prettySla(c.firstResponseMinutes)}</span>
                  <span>· fix {prettySla(c.resolutionMinutes)}</span>
                </p>
              </div>
            </div>
          </Paper>
        ))}
      </div>

      <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth maxWidth="xs"
        slotProps={{ paper: { className: '!rounded-2xl' } }}>
        <DialogTitle className="!font-black !text-slate-900">
          {editing?._id ? 'Edit category' : 'Add category'}
        </DialogTitle>
        <DialogContent dividers className="space-y-3">
          <TextField autoFocus fullWidth size="small" label="Name" value={editing?.category || ''}
            onChange={e => setEditing({ ...editing, category: e.target.value })}
            placeholder="Plumbing" />
          <TextField fullWidth size="small" label="More specific (optional)" value={editing?.subCategory || ''}
            onChange={e => setEditing({ ...editing, subCategory: e.target.value })}
            placeholder="Water leakage" />
          <FormControl fullWidth size="small">
            <InputLabel>Goes to</InputLabel>
            <Select label="Goes to" value={editing?.workCategory || 'OTHER'}
              onChange={e => setEditing({ ...editing, workCategory: e.target.value })}>
              {WORK_CATEGORIES.map(w => <MenuItem key={w} value={w}>{w.charAt(0) + w.slice(1).toLowerCase()}</MenuItem>)}
            </Select>
          </FormControl>

          <div>
            <p className="text-[11px] font-bold text-slate-600 mb-1.5">First reply within</p>
            <div className="flex gap-2">
              <TextField size="small" type="number" value={respVal} className="w-24"
                onChange={e => setRespVal(Number(e.target.value))} />
              <FormControl size="small" className="flex-1">
                <Select value={respUnit} onChange={e => setRespUnit(e.target.value)}>
                  <MenuItem value="minutes">minutes</MenuItem>
                  <MenuItem value="hours">hours</MenuItem>
                  <MenuItem value="days">days</MenuItem>
                </Select>
              </FormControl>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-600 mb-1.5">Fixed within</p>
            <div className="flex gap-2">
              <TextField size="small" type="number" value={resVal} className="w-24"
                onChange={e => setResVal(Number(e.target.value))} />
              <FormControl size="small" className="flex-1">
                <Select value={resUnit} onChange={e => setResUnit(e.target.value)}>
                  <MenuItem value="minutes">minutes</MenuItem>
                  <MenuItem value="hours">hours</MenuItem>
                  <MenuItem value="days">days</MenuItem>
                </Select>
              </FormControl>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Emergency</p>
              <p className="text-[11px] text-slate-500">Skips straight past the lower escalation rungs.</p>
            </div>
            <Switch checked={!!editing?.isEmergency}
              onChange={e => setEditing({ ...editing, isEmergency: e.target.checked })} />
          </div>
          {editing?._id && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">In use</p>
                <p className="text-[11px] text-slate-500">Switch off to hide it without losing its history.</p>
              </div>
              <Switch checked={editing?.isActive !== false}
                onChange={e => setEditing({ ...editing, isActive: e.target.checked })} />
            </div>
          )}
        </DialogContent>
        <DialogActions className="!px-6 !py-3">
          <Button onClick={() => setEditing(null)} className="!normal-case !font-bold">Cancel</Button>
          <Button variant="contained" onClick={save} disabled={saving}
            className="!rounded-xl !normal-case !font-bold">{saving ? 'Saving…' : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
