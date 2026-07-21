'use client';

import React, { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  Button, TextField, Select, MenuItem, FormControl, InputLabel, Switch, Chip,
} from '@mui/material';
import { Plus, Tag, Zap } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { DataTable, ColumnDef } from '@/components/common/DataTable';
import PageHeader from '@/components/common/PageHeader';
import PageSkeleton from '@/components/common/PageSkeleton';
import ErrorState from '@/components/common/ErrorState';
import AppDialog from '@/components/common/AppDialog';

/**
 * The categories a society complains about, and the promises attached to them.
 *
 * This screen exists because there was no way to reach these fields. Every
 * category's promised times were writable on the model and had no writer — so a
 * society was frozen with the thirteen seeded rows forever. A committee that
 * wanted garden complaints answered in a week rather than a fortnight had no
 * lever. This is the lever.
 *
 * The words are deliberately not "SLA": nobody on a managing committee says it,
 * and what the field actually means is a sentence — "first reply by", "fix by".
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

// Minutes are how the model stores a promise, but nobody thinks in "1440 minutes".
const fromMinutes = (m: number) => {
  if (m % 1440 === 0) return { value: m / 1440, unit: 'days' };
  if (m % 60 === 0) return { value: m / 60, unit: 'hours' };
  return { value: m, unit: 'minutes' };
};
const toMinutes = (value: number, unit: string) =>
  unit === 'days' ? value * 1440 : unit === 'hours' ? value * 60 : value;
const prettyTime = (m: number) => {
  const { value, unit } = fromMinutes(m);
  return `${value} ${value === 1 ? unit.replace(/s$/, '') : unit}`;
};

const titleCase = (w: string) => w.charAt(0) + w.slice(1).toLowerCase();

export default function ComplaintCategoriesPage() {
  const { showToast } = useToastConfirm();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [rows, setRows] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Partial<Category> | null>(null);
  const [saving, setSaving] = useState(false);

  // Held separately so the day/hour toggles are ergonomic.
  const [respVal, setRespVal] = useState(4); const [respUnit, setRespUnit] = useState('hours');
  const [resVal, setResVal] = useState(2); const [resUnit, setResUnit] = useState('days');

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await api.get('/complaints/categories');
      setRows(res.data?.data || []);
    } catch (e: any) {
      setFailed(true);
      showToast(e.response?.data?.message || 'Could not load what people can report', 'error');
    } finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const openEdit = (c?: Category) => {
    setEditing(c || { category: '', workCategory: 'OTHER', isEmergency: false, isActive: true });
    const resp = fromMinutes(c?.firstResponseMinutes ?? 240);
    const reso = fromMinutes(c?.resolutionMinutes ?? 2880);
    setRespVal(resp.value); setRespUnit(resp.unit);
    setResVal(reso.value); setResUnit(reso.unit);
  };

  const save = async () => {
    if (!editing?.category?.trim()) return showToast('Give it a name people will recognise', 'error');
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

  const columns: ColumnDef<Category>[] = [
    {
      id: 'name', label: 'What people can report', alwaysVisible: true,
      sortValue: c => c.category,
      exportValue: c => `${c.category}${c.subCategory ? ` — ${c.subCategory}` : ''}`,
      render: c => (
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            <Tag className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-800 truncate">
              {c.category}
              {c.subCategory && <span className="text-slate-500 font-normal"> — {c.subCategory}</span>}
            </p>
            {c.isEmergency && (
              <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                <Zap className="w-3 h-3" /> Emergency
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'work', label: 'Goes to',
      sortValue: c => c.workCategory, exportValue: c => titleCase(c.workCategory),
      render: c => <span className="text-sm text-slate-600">{titleCase(c.workCategory)}</span>,
    },
    {
      id: 'firstReply', label: 'First reply by',
      sortValue: c => c.firstResponseMinutes, exportValue: c => prettyTime(c.firstResponseMinutes),
      render: c => <span className="text-sm text-slate-600">{prettyTime(c.firstResponseMinutes)}</span>,
    },
    {
      id: 'fix', label: 'Fix by',
      sortValue: c => c.resolutionMinutes, exportValue: c => prettyTime(c.resolutionMinutes),
      render: c => <span className="text-sm text-slate-600">{prettyTime(c.resolutionMinutes)}</span>,
    },
    {
      id: 'inUse', label: 'In use', align: 'right',
      sortValue: c => (c.isActive ? 'Yes' : 'No'), exportValue: c => (c.isActive ? 'Yes' : 'No'),
      render: c => c.isActive
        ? <span className="text-xs text-slate-400">Yes</span>
        : <Chip size="small" label="Hidden" sx={{ bgcolor: '#f1f5f9', color: '#475569' }} />,
    },
  ];

  if (loading) return <PageSkeleton label="Loading what people can report" />;
  if (failed) {
    return (
      <ErrorState
        message="The list of things people can complain about did not load."
        onRetry={load}
      />
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <PageHeader
        breadcrumb="Operations"
        // Matches the sidebar word for word. This module already had one screen
        // going by three different names; adding a fourth would not be an
        // improvement, however much better "What people can report" reads.
        title="Complaint categories"
        icon={<Tag className="w-4.5 h-4.5" />}
        subtitle="What a resident can raise a complaint about, which trade it goes to, and how fast the society promises to reply and to fix it."
        actions={
          <Button variant="contained" startIcon={<Plus className="w-4 h-4" />} onClick={() => openEdit()}>
            Add one
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={rows}
        keyExtractor={c => c._id}
        onRowClick={openEdit}
        exportFileName="complaint-categories"
        columnToggle
        emptyTitle="Nothing to report yet"
        emptyText="Add the things your residents actually complain about — a leaking tap, a stuck lift — and the times you promise for each."
        emptyIcon={<Tag className="w-6 h-6" />}
      />

      <AppDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?._id ? 'Edit' : 'Add something people can report'}
        busy={saving}
        confirmText={saving ? 'Saving…' : 'Save'}
        onConfirm={save}
      >
        <TextField autoFocus fullWidth label="Name" value={editing?.category || ''}
          onChange={e => setEditing({ ...editing, category: e.target.value })}
          placeholder="Plumbing" />
        <TextField fullWidth label="More specific (optional)" value={editing?.subCategory || ''}
          onChange={e => setEditing({ ...editing, subCategory: e.target.value })}
          placeholder="Water leakage" />
        <FormControl fullWidth>
          <InputLabel>Goes to</InputLabel>
          <Select label="Goes to" value={editing?.workCategory || 'OTHER'}
            onChange={e => setEditing({ ...editing, workCategory: e.target.value })}>
            {WORK_CATEGORIES.map(w => <MenuItem key={w} value={w}>{titleCase(w)}</MenuItem>)}
          </Select>
        </FormControl>

        <div>
          <p className="text-[11px] font-bold text-slate-600 mb-1.5">First reply by</p>
          <div className="flex gap-2">
            <TextField type="number" value={respVal} className="w-24"
              onChange={e => setRespVal(Number(e.target.value))} />
            <FormControl className="flex-1">
              <Select value={respUnit} onChange={e => setRespUnit(e.target.value)}>
                <MenuItem value="minutes">minutes</MenuItem>
                <MenuItem value="hours">hours</MenuItem>
                <MenuItem value="days">days</MenuItem>
              </Select>
            </FormControl>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            How long before somebody says &ldquo;we have seen this&rdquo;. It is the wait people remember.
          </p>
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-600 mb-1.5">Fix by</p>
          <div className="flex gap-2">
            <TextField type="number" value={resVal} className="w-24"
              onChange={e => setResVal(Number(e.target.value))} />
            <FormControl className="flex-1">
              <Select value={resUnit} onChange={e => setResUnit(e.target.value)}>
                <MenuItem value="minutes">minutes</MenuItem>
                <MenuItem value="hours">hours</MenuItem>
                <MenuItem value="days">days</MenuItem>
              </Select>
            </FormControl>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-700">Emergency</p>
            <p className="text-[11px] text-slate-500">
              Goes straight up to the committee instead of waiting its turn with the staff.
            </p>
          </div>
          <Switch checked={!!editing?.isEmergency}
            onChange={e => setEditing({ ...editing, isEmergency: e.target.checked })} />
        </div>
        {editing?._id && (
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-700">In use</p>
              <p className="text-[11px] text-slate-500">
                Switch off to stop people picking it. Nothing already reported under it is deleted.
              </p>
            </div>
            <Switch checked={editing?.isActive !== false}
              onChange={e => setEditing({ ...editing, isActive: e.target.checked })} />
          </div>
        )}
      </AppDialog>
    </div>
  );
}
