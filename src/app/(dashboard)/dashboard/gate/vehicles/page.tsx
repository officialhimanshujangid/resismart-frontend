'use client';

import React, { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import {
  Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel, Autocomplete, Chip,
} from '@mui/material';
import { Plus, Car, Bike, Search, Trash2 } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { DataTable, ColumnDef } from '@/components/common/DataTable';
import PageHeader from '@/components/common/PageHeader';
import StatCard from '@/components/common/StatCard';

/**
 * The society's registered vehicles.
 *
 * This is what makes the guard's plate box useful: a plate that is on this
 * register autocompletes to a flat, so a resident's own car is never logged as
 * a visitor and the parking dispute at the next AGM has a record behind it.
 * The endpoints existed from the start with no screen calling them, which meant
 * the register was permanently empty and the suggestion box permanently silent.
 */

interface Vehicle {
  _id: string;
  number: string;
  displayNumber: string;
  flatId: string;
  flatLabel?: string;
  kind: 'CAR' | 'BIKE' | 'CYCLE' | 'OTHER';
  make?: string;
  colour?: string;
  parkingSlot?: string;
  createdByName?: string;
  createdAt?: string;
}
interface FlatOption { _id: string; label: string }

const KIND_LABEL: Record<string, string> = { CAR: 'Car', BIKE: 'Two-wheeler', CYCLE: 'Cycle', OTHER: 'Other' };

export default function VehiclesPage() {
  const { showToast, confirm } = useToastConfirm();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Vehicle[]>([]);
  const [flats, setFlats] = useState<FlatOption[]>([]);
  const [q, setQ] = useState('');

  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ flat: FlatOption | null; number: string; kind: string; make: string; colour: string; parkingSlot: string }>(
    { flat: null, number: '', kind: 'CAR', make: '', colour: '', parkingSlot: '' },
  );

  const load = async () => {
    try {
      const [v, f] = await Promise.all([
        api.get('/gate/vehicles'),
        api.get('/gate/flats').catch(() => ({ data: { data: [] } })),
      ]);
      setRows(v.data?.data || []);
      setFlats(f.data?.data || []);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not load the register', 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.flat) return showToast('Which flat does it belong to?', 'error');
    if (form.number.trim().length < 4) return showToast('That does not look like a registration number', 'error');
    setSaving(true);
    try {
      await api.post('/gate/vehicles', {
        flatId: form.flat._id,
        number: form.number,
        kind: form.kind,
        make: form.make || undefined,
        colour: form.colour || undefined,
        parkingSlot: form.parkingSlot || undefined,
      });
      showToast('Added to the register', 'success');
      setAdding(false);
      setForm({ flat: null, number: '', kind: 'CAR', make: '', colour: '', parkingSlot: '' });
      await load();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not add that', 'error');
    } finally { setSaving(false); }
  };

  const remove = async (v: Vehicle) => {
    if (!(await confirm({
      title: `Remove ${v.displayNumber}?`,
      message: 'It stops being recognised at the gate. Entries already recorded against it are untouched.',
      severity: 'warning',
    }))) return;
    try {
      await api.delete(`/gate/vehicles/${v._id}`);
      showToast('Removed', 'success');
      await load();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not remove that', 'error');
    }
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!needle) return rows;
    return rows.filter(v =>
      v.number.toLowerCase().includes(needle) ||
      (v.flatLabel || '').toLowerCase().replace(/[^a-z0-9]/g, '').includes(needle) ||
      (v.parkingSlot || '').toLowerCase().includes(needle));
  }, [rows, q]);

  const counts = useMemo(() => ({
    cars: rows.filter(r => r.kind === 'CAR').length,
    bikes: rows.filter(r => r.kind === 'BIKE').length,
    slots: rows.filter(r => r.parkingSlot).length,
  }), [rows]);

  const columns: ColumnDef<Vehicle>[] = [
    {
      id: 'number', label: 'Number', alwaysVisible: true,
      sortValue: v => v.number,
      exportValue: v => v.displayNumber,
      render: v => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-slate-500">
            {v.kind === 'BIKE' || v.kind === 'CYCLE' ? <Bike className="w-4 h-4" /> : <Car className="w-4 h-4" />}
          </div>
          <span className="font-bold text-slate-800 font-mono tracking-tight">{v.displayNumber}</span>
        </div>
      ),
    },
    {
      id: 'flat', label: 'Flat',
      sortValue: v => v.flatLabel || '',
      exportValue: v => v.flatLabel || '',
      render: v => <span className="text-sm text-slate-700 font-semibold">{v.flatLabel || '—'}</span>,
    },
    {
      id: 'kind', label: 'Kind',
      sortValue: v => KIND_LABEL[v.kind] || v.kind,
      exportValue: v => KIND_LABEL[v.kind] || v.kind,
      render: v => <span className="text-sm text-slate-600">{KIND_LABEL[v.kind] || v.kind}</span>,
    },
    {
      id: 'desc', label: 'Make & colour',
      exportValue: v => [v.make, v.colour].filter(Boolean).join(' '),
      render: v => (
        <span className="text-sm text-slate-500">{[v.make, v.colour].filter(Boolean).join(' · ') || '—'}</span>
      ),
    },
    {
      id: 'slot', label: 'Parking',
      sortValue: v => v.parkingSlot || '',
      exportValue: v => v.parkingSlot || '',
      render: v => v.parkingSlot
        ? <Chip size="small" label={v.parkingSlot} className="!bg-slate-100 !font-bold !text-[10px]" />
        : <span className="text-slate-300">—</span>,
    },
    {
      id: 'added', label: 'Added', defaultHidden: true,
      sortValue: v => v.createdAt || '',
      exportValue: v => v.createdAt ? new Date(v.createdAt).toLocaleDateString('en-IN') : '',
      render: v => (
        <span className="text-[11px] text-slate-500">
          {v.createdAt ? new Date(v.createdAt).toLocaleDateString('en-IN') : '—'}
          {v.createdByName && <><br />by {v.createdByName}</>}
        </span>
      ),
    },
    {
      id: 'act', label: '', align: 'right', alwaysVisible: true,
      render: v => (
        <Button size="small" color="error" startIcon={<Trash2 className="w-3.5 h-3.5" />}
          onClick={() => remove(v)} className="!rounded-xl !normal-case !font-bold !text-xs">Remove</Button>
      ),
    },
  ];

  if (loading) return <div className="flex justify-center py-24"><CircularProgress /></div>;

  return (
    <div className="space-y-4 pb-24">
      <PageHeader
        breadcrumb="Operations · Gate"
        title="Resident vehicles"
        icon={<Car className="w-4.5 h-4.5" />}
        subtitle="Every car and two-wheeler that belongs here. A plate on this register autocompletes to its flat at the gate, so a resident's own car is never logged as a visitor."
        actions={
          <Button variant="contained" startIcon={<Plus className="w-4 h-4" />} onClick={() => setAdding(true)}
            className="!rounded-xl !normal-case !font-bold">Add vehicle</Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Cars" value={counts.cars} icon={<Car className="w-5 h-5" />} tone="blue" />
        <StatCard label="Two-wheelers" value={counts.bikes} icon={<Bike className="w-5 h-5" />} tone="violet" />
        <StatCard label="With a parking slot" value={counts.slots} icon={<Car className="w-5 h-5" />} tone="emerald"
          sub={`of ${rows.length} registered`} />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        keyExtractor={v => v._id}
        exportFileName="resident-vehicles"
        columnToggle
        emptyTitle="No vehicles registered yet"
        emptyText="Add the residents' cars so the gate recognises them instead of logging each one as a visitor."
        emptyIcon={<Car className="w-6 h-6" />}
        toolbar={
          <TextField size="small" placeholder="Plate, flat or parking slot" value={q}
            onChange={e => setQ(e.target.value)} className="min-w-[260px]"
            slotProps={{ input: { startAdornment: <Search className="w-4 h-4 text-slate-400 mr-2" /> } }} />
        }
      />

      <Dialog open={adding} onClose={() => setAdding(false)} fullWidth maxWidth="xs"
        slotProps={{ paper: { className: '!rounded-2xl' } }}>
        <DialogTitle className="!font-black !text-slate-900">Add a vehicle</DialogTitle>
        <DialogContent dividers className="flex flex-col gap-4 pt-2">
          <Autocomplete
            size="small" options={flats} value={form.flat}
            getOptionLabel={o => o.label}
            isOptionEqualToValue={(a, b) => a._id === b._id}
            onChange={(_, v) => setForm({ ...form, flat: v })}
            renderInput={p => <TextField {...p} label="Flat" placeholder="Search a flat" />}
          />
          <TextField fullWidth size="small" label="Registration number" value={form.number}
            onChange={e => setForm({ ...form, number: e.target.value.toUpperCase() })}
            placeholder="MH 12 AB 1234"
            helperText="Spacing does not matter — MH12AB1234 and MH 12 AB 1234 are the same vehicle." />
          <FormControl fullWidth size="small">
            <InputLabel>Kind</InputLabel>
            <Select label="Kind" value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>
              {Object.entries(KIND_LABEL).map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
            </Select>
          </FormControl>
          <div className="flex gap-2">
            <TextField fullWidth size="small" label="Make (optional)" value={form.make}
              onChange={e => setForm({ ...form, make: e.target.value })} placeholder="Maruti Swift" />
            <TextField size="small" label="Colour" value={form.colour} className="w-32"
              onChange={e => setForm({ ...form, colour: e.target.value })} placeholder="White" />
          </div>
          <TextField fullWidth size="small" label="Parking slot (optional)" value={form.parkingSlot}
            onChange={e => setForm({ ...form, parkingSlot: e.target.value })} placeholder="B-14" />
        </DialogContent>
        <DialogActions className="!px-6 !py-3">
          <Button onClick={() => setAdding(false)} className="!normal-case !font-bold">Cancel</Button>
          <Button variant="contained" onClick={save} disabled={saving}
            className="!rounded-xl !normal-case !font-bold">{saving ? 'Saving…' : 'Add'}</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
