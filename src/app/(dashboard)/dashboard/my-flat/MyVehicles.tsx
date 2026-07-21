'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Button, Chip, FormControl, InputLabel, MenuItem, Paper, Select, TextField,
} from '@mui/material';
import { Car, Bike, Plus, Trash2, SquareParking } from 'lucide-react';
import api from '@/lib/api';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import AppDialog from '@/components/common/AppDialog';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import PageSkeleton from '@/components/common/PageSkeleton';
import SectionHeading from '@/components/common/SectionHeading';

/**
 * Your cars, and where they park.
 *
 * `GET /gate/vehicles/mine` has existed since the gate module shipped with no
 * screen calling it — so residents could not see the plates registered against
 * their own flat, let alone add one, and every resident's own car was logged at
 * the gate as a visitor. This is that endpoint, finally reachable.
 *
 * The parking slot underneath comes from the parking module and is best-effort:
 * a society that does not manage parking gets a 404 from it, and this simply
 * shows nothing rather than an error about a feature they never bought.
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
  createdAt?: string;
}

interface MySlot {
  _id: string;
  slotCode: string;
  flatLabel?: string;
  startDate: string;
  chargeable: boolean;
}

const KIND_LABEL: Record<string, string> = {
  CAR: 'Car', BIKE: 'Two-wheeler', CYCLE: 'Cycle', OTHER: 'Something else',
};

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function MyVehicles({ flatId, flatLabel }: { flatId: string; flatLabel: string }) {
  const { showToast, confirm } = useToastConfirm();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [slots, setSlots] = useState<MySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ number: '', kind: 'CAR', make: '', colour: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/visitors/vehicles/mine');
      setVehicles(res.data?.data?.vehicles || []);
      setError(null);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Your vehicles could not be loaded.');
    } finally { setLoading(false); }

    // Best-effort. 404 means the society does not manage parking here.
    try {
      const p = await api.get('/parking/mine');
      setSlots(p.data?.data?.active || []);
    } catch { setSlots([]); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (form.number.trim().length < 4) {
      return showToast('That does not look like a registration number.', 'error');
    }
    setSaving(true);
    try {
      await api.post('/visitors/vehicles', {
        flatId,
        number: form.number.trim(),
        kind: form.kind,
        make: form.make.trim() || undefined,
        colour: form.colour.trim() || undefined,
      });
      showToast('Added. The gate will recognise it now.', 'success');
      setAdding(false);
      setForm({ number: '', kind: 'CAR', make: '', colour: '' });
      await load();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not add that vehicle', 'error');
    } finally { setSaving(false); }
  };

  const remove = async (v: Vehicle) => {
    if (!(await confirm({
      title: `Remove ${v.displayNumber}?`,
      message: 'It stops being recognised at the gate and will be logged as a visitor. Entries already recorded against it are untouched.',
      confirmText: 'Remove it',
      severity: 'warning',
    }))) return;
    try {
      await api.delete(`/visitors/vehicles/${v._id}`);
      showToast('Removed.', 'success');
      await load();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not remove that', 'error');
    }
  };

  if (loading) return <PageSkeleton rows={3} label="Loading your vehicles…" />;

  if (error) {
    return (
      <ErrorState
        title="Your vehicles could not be loaded"
        message={error}
        hint="If this keeps happening, ask the society office to check whether the gate module is switched on."
        onRetry={load}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------- where you park */}
      {slots.length > 0 && (
        <div className="space-y-2">
          <SectionHeading hint="Given to your flat by the society office. Ask them if you need it changed.">
            Your parking slot{slots.length > 1 ? 's' : ''}
          </SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {slots.map(s => (
              <Paper key={s._id} elevation={0} className="rounded-2xl border border-slate-200/70 p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                  <SquareParking className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-black text-slate-900 tracking-tight">{s.slotCode}</p>
                  <p className="text-[11px] text-slate-500">
                    Yours since {fmtDate(s.startDate)}
                    {!s.chargeable && ' · not charged'}
                  </p>
                </div>
              </Paper>
            ))}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- the vehicles */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <SectionHeading hint="A plate registered here is matched to your flat at the gate, so your own car is never written down as a visitor.">
          Your vehicles
        </SectionHeading>
        <Button variant="contained" size="small" startIcon={<Plus className="w-4 h-4" />}
          onClick={() => setAdding(true)}>
          Add a vehicle
        </Button>
      </div>

      {vehicles.length === 0 ? (
        <EmptyState
          compact
          title="No vehicles registered for this flat"
          message="Add your car or two-wheeler and the guard's screen will recognise the number plate instead of logging you in as a visitor."
          icon={<Car className="w-6 h-6" />}
          action={{ label: 'Add a vehicle', onClick: () => setAdding(true), icon: <Plus className="w-4 h-4" /> }}
        />
      ) : (
        <div className="space-y-2">
          {vehicles.map(v => (
            <Paper key={v._id} elevation={0}
              className="rounded-2xl border border-slate-200/70 p-4 flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                {v.kind === 'BIKE' || v.kind === 'CYCLE' ? <Bike className="w-5 h-5" /> : <Car className="w-5 h-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-800 font-mono tracking-tight">{v.displayNumber}</span>
                  <Chip size="small" label={KIND_LABEL[v.kind] || v.kind}
                    sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 700 }} />
                  {v.parkingSlot && (
                    <Chip size="small" label={`Parks at ${v.parkingSlot}`}
                      sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700 }} />
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {[v.make, v.colour].filter(Boolean).join(' · ') || 'No make or colour saved'}
                  {v.flatLabel ? ` · ${v.flatLabel}` : ''}
                </p>
              </div>
              <Button size="small" color="error" startIcon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={() => remove(v)}>
                Remove
              </Button>
            </Paper>
          ))}
        </div>
      )}

      <AppDialog
        open={adding}
        onClose={() => setAdding(false)}
        busy={saving}
        maxWidth="xs"
        title="Add a vehicle"
        subtitle={`It will be registered to ${flatLabel}.`}
        confirmText="Add it"
        onConfirm={save}
      >
        <TextField autoFocus fullWidth size="small" label="Registration number" value={form.number}
          onChange={e => setForm({ ...form, number: e.target.value.toUpperCase() })}
          placeholder="MH 12 AB 1234"
          helperText="Spacing does not matter — MH12AB1234 and MH 12 AB 1234 are the same vehicle." />

        <FormControl fullWidth size="small">
          <InputLabel>What is it</InputLabel>
          <Select label="What is it" value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>
            {Object.entries(KIND_LABEL).map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
          </Select>
        </FormControl>

        <div className="flex gap-2">
          <TextField fullWidth size="small" label="Make (optional)" value={form.make}
            onChange={e => setForm({ ...form, make: e.target.value })} placeholder="Maruti Swift" />
          <TextField size="small" label="Colour" value={form.colour} className="w-32"
            onChange={e => setForm({ ...form, colour: e.target.value })} placeholder="White" />
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Registering a vehicle does not give you a parking slot. Slots are given out by the society
          office — ask them if you need one.
        </p>
      </AppDialog>
    </div>
  );
}
