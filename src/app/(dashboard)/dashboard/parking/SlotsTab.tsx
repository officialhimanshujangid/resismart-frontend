'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Chip, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Switch, TextField,
} from '@mui/material';
import { Plus, SquareParking, Pencil } from 'lucide-react';
import api from '@/lib/api';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { DataTable, ColumnDef } from '@/components/common/DataTable';
import AppDialog from '@/components/common/AppDialog';
import ErrorState from '@/components/common/ErrorState';
import SearchBox from './SearchBox';
import {
  Slot, Zone, SlotStatus, SlotSize, SlotVehicleKind, SETTABLE_STATUSES, SIZE_LABEL,
  VEHICLE_KIND_LABEL, apiMessage, slotChipSx, squash, tokenFor,
} from './parking-types';

/**
 * Every bay in the society, as a list.
 *
 * The map answers "where", this answers "what have we got" — which is the
 * question somebody setting the place up is actually asking, and the one a
 * treasurer asks when the parking income does not add up.
 */

export default function SlotsTab({
  zones, canManage, zoneId, status, q, onFilter, onBulkCreate, reloadKey,
}: {
  zones: Zone[];
  canManage: boolean;
  zoneId: string;
  status: string;
  q: string;
  onFilter: (patch: Record<string, string>) => void;
  onBulkCreate: () => void;
  reloadKey: number;
}) {
  const { showToast, confirm } = useToastConfirm();
  const [rows, setRows] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  const [editing, setEditing] = useState<Slot | null>(null);
  const [typed, setTyped] = useState(q);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (zoneId) params.set('zoneId', zoneId);
      if (status) params.set('status', status);
      const res = await api.get(`/parking/slots?${params}`);
      setRows(res.data?.data || []);
      setFailed(false);
    } catch (e: any) {
      setFailed(true);
      showToast(apiMessage(e, 'Could not load the slots'), 'error');
    } finally { setLoading(false); }
  }, [zoneId, status, showToast]);

  useEffect(() => { load(); }, [load, reloadKey, tick]);

  const needle = squash(typed);
  const filtered = useMemo(
    () => (needle ? rows.filter(r => squash(r.code).includes(needle) || squash(r.zoneName).includes(needle)) : rows),
    [rows, needle],
  );

  const columns: ColumnDef<Slot>[] = [
    {
      id: 'code', label: 'Slot', alwaysVisible: true,
      sortValue: s => s.code, exportValue: s => s.code,
      render: s => <span className="font-bold text-slate-800">{s.code}</span>,
    },
    {
      id: 'zone', label: 'Area',
      sortValue: s => s.zoneName || '', exportValue: s => s.zoneName || '',
      render: s => <span className="text-sm text-slate-600">{s.zoneName || '—'}</span>,
    },
    {
      id: 'where', label: 'Where', defaultHidden: true,
      sortValue: s => s.row * 1000 + s.col, exportValue: s => `row ${s.row}, column ${s.col}`,
      render: s => <span className="text-xs text-slate-500">Row {s.row}, col {s.col}</span>,
    },
    {
      id: 'kind', label: 'What parks here',
      sortValue: s => VEHICLE_KIND_LABEL[s.vehicleKind],
      exportValue: s => VEHICLE_KIND_LABEL[s.vehicleKind],
      render: s => (
        <span className="text-sm text-slate-600">
          {VEHICLE_KIND_LABEL[s.vehicleKind]}
          <span className="text-slate-400"> · {SIZE_LABEL[s.size]}</span>
        </span>
      ),
    },
    {
      id: 'extras', label: 'Notes',
      exportValue: s => [s.isAccessible && 'easy to reach', s.hasEvCharger && 'charging point'].filter(Boolean).join(', '),
      render: s => (
        <div className="flex gap-1 flex-wrap">
          {s.isAccessible && <Chip size="small" label="Easy to reach" sx={{ bgcolor: '#f1f5f9', color: '#475569' }} />}
          {s.hasEvCharger && <Chip size="small" label="Charging point" sx={{ bgcolor: '#f1f5f9', color: '#475569' }} />}
          {!s.isAccessible && !s.hasEvCharger && <span className="text-slate-300">—</span>}
        </div>
      ),
    },
    {
      id: 'status', label: 'Right now',
      sortValue: s => tokenFor(s.status, s.isActive).label,
      exportValue: s => tokenFor(s.status, s.isActive).label,
      render: s => {
        const t = tokenFor(s.status, s.isActive);
        return <Chip size="small" label={t.label} sx={slotChipSx(t)} />;
      },
    },
  ];

  if (canManage) {
    columns.push({
      id: 'act', label: '', align: 'right', alwaysVisible: true,
      render: s => (
        <Button size="small" startIcon={<Pencil className="w-3.5 h-3.5" />} onClick={() => setEditing(s)}>
          Change
        </Button>
      ),
    });
  }

  if (failed && !loading) {
    return (
      <ErrorState
        title="The slots could not be loaded"
        message="Something went wrong reading the parking inventory."
        hint="If this keeps happening, your society may not have parking switched on — ask the society office."
        onRetry={() => setTick(t => t + 1)}
      />
    );
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        keyExtractor={s => s._id}
        exportFileName="parking-slots"
        columnToggle
        emptyTitle="No parking slots yet"
        emptyText="Create a whole level in one go rather than typing them one at a time — that is what the wizard is for."
        emptyIcon={<SquareParking className="w-6 h-6" />}
        toolbar={
          <>
            <SearchBox value={q} onChange={setTyped} onCommit={v => onFilter({ q: v })}
              placeholder="Slot number or area" className="min-w-56" />
            <FormControl size="small" className="min-w-44">
              <Select displayEmpty value={zoneId} onChange={e => onFilter({ zoneId: e.target.value })}>
                <MenuItem value="">Every area</MenuItem>
                {zones.map(z => <MenuItem key={z._id} value={z._id}>{z.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" className="min-w-44">
              <Select displayEmpty value={status} onChange={e => onFilter({ status: e.target.value })}>
                <MenuItem value="">Any state</MenuItem>
                <MenuItem value="AVAILABLE">Free</MenuItem>
                <MenuItem value="ALLOCATED">Given to a flat</MenuItem>
                <MenuItem value="RESERVED">Kept aside</MenuItem>
                <MenuItem value="VISITOR">For visitors</MenuItem>
                <MenuItem value="BLOCKED">Not usable</MenuItem>
                <MenuItem value="OUT_OF_SERVICE">Out of use</MenuItem>
              </Select>
            </FormControl>
            {canManage && (
              <Button variant="contained" size="small" startIcon={<Plus className="w-4 h-4" />} onClick={onBulkCreate}>
                Create slots
              </Button>
            )}
          </>
        }
      />

      <EditSlotDialog
        slot={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); setTick(t => t + 1); }}
        confirmFn={confirm}
      />
    </>
  );
}

function EditSlotDialog({
  slot, onClose, onSaved, confirmFn,
}: {
  slot: Slot | null;
  onClose: () => void;
  onSaved: () => void;
  confirmFn: (o: any) => Promise<boolean>;
}) {
  const { showToast } = useToastConfirm();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    code: '', status: 'AVAILABLE' as SlotStatus, vehicleKind: 'CAR' as SlotVehicleKind,
    size: 'STANDARD' as SlotSize, isAccessible: false, hasEvCharger: false,
  });

  useEffect(() => {
    if (!slot) return;
    setForm({
      code: slot.code, status: slot.status, vehicleKind: slot.vehicleKind,
      size: slot.size, isAccessible: slot.isAccessible, hasEvCharger: slot.hasEvCharger,
    });
  }, [slot]);

  // A held slot is not editable in the ways that would make the bill and the
  // map disagree. The API refuses it too; saying so here saves a round trip and
  // a sentence nobody expected.
  const held = slot?.status === 'ALLOCATED';

  const save = async () => {
    if (!slot) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        code: form.code.trim().toUpperCase(),
        isAccessible: form.isAccessible,
        hasEvCharger: form.hasEvCharger,
        size: form.size,
      };
      if (!held) {
        body.vehicleKind = form.vehicleKind;
        if (form.status !== slot.status) body.status = form.status;
      }
      const res = await api.patch(`/parking/slots/${slot._id}`, body);
      showToast(res.data?.message || 'Saved.', 'success');
      onSaved();
    } catch (e: any) {
      showToast(apiMessage(e, 'Could not save that slot'), 'error');
    } finally { setBusy(false); }
  };

  const retire = async () => {
    if (!slot) return;
    if (!(await confirmFn({
      title: `Retire ${slot.code}?`,
      message: 'It comes off the map and cannot be given to anybody. Nothing is deleted — who parked there before is kept.',
      confirmText: 'Retire it',
      severity: 'warning',
    }))) return;
    setBusy(true);
    try {
      await api.patch(`/parking/slots/${slot._id}`, { isActive: false });
      showToast(`${slot.code} is retired.`, 'success');
      onSaved();
    } catch (e: any) {
      showToast(apiMessage(e, 'Could not retire that slot'), 'error');
    } finally { setBusy(false); }
  };

  return (
    <AppDialog
      open={!!slot}
      onClose={onClose}
      busy={busy}
      maxWidth="xs"
      title={slot ? `Slot ${slot.code}` : ''}
      subtitle={slot ? `${slot.zoneName || 'Parking'} · row ${slot.row}, column ${slot.col}` : undefined}
      confirmText="Save"
      onConfirm={save}
      extraActions={slot?.isActive && !held
        ? <Button size="small" color="error" onClick={retire} disabled={busy}>Retire it</Button>
        : undefined}
    >
      <TextField fullWidth size="small" label="What is painted on it" value={form.code}
        onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} />

      <div className="flex gap-2">
        <FormControl fullWidth size="small" disabled={held}>
          <InputLabel>What parks here</InputLabel>
          <Select label="What parks here" value={form.vehicleKind}
            onChange={e => setForm({ ...form, vehicleKind: e.target.value as SlotVehicleKind })}>
            {(Object.keys(VEHICLE_KIND_LABEL) as SlotVehicleKind[]).map(k => (
              <MenuItem key={k} value={k}>{VEHICLE_KIND_LABEL[k]}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth size="small">
          <InputLabel>How big</InputLabel>
          <Select label="How big" value={form.size}
            onChange={e => setForm({ ...form, size: e.target.value as SlotSize })}>
            {(Object.keys(SIZE_LABEL) as SlotSize[]).map(k => (
              <MenuItem key={k} value={k}>{SIZE_LABEL[k]}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </div>

      {held ? (
        <Box sx={{ borderRadius: '12px', p: 1.5, bgcolor: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <p className="text-xs text-slate-700 leading-relaxed">
            A flat holds this slot and is billed on what it takes. Take the slot back first if you
            need to change that or put it out of use.
          </p>
        </Box>
      ) : (
        <FormControl fullWidth size="small">
          <InputLabel>What it is for</InputLabel>
          <Select label="What it is for" value={form.status}
            onChange={e => setForm({ ...form, status: e.target.value as SlotStatus })}>
            {SETTABLE_STATUSES.map(s => (
              <MenuItem key={s} value={s}>{tokenFor(s).label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      <FormControlLabel
        control={<Switch checked={form.isAccessible} onChange={e => setForm({ ...form, isAccessible: e.target.checked })} />}
        label={<span className="text-sm">Easy to reach</span>} />
      <FormControlLabel
        control={<Switch checked={form.hasEvCharger} onChange={e => setForm({ ...form, hasEvCharger: e.target.checked })} />}
        label={<span className="text-sm">Has a charging point</span>} />
    </AppDialog>
  );
}
